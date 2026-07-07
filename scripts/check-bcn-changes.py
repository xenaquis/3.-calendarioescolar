#!/usr/bin/env python3
"""
check-bcn-changes.py — Pipeline de deteccion de cambios en articulos legales BCN.

Compara los hashes SHA256 de los articulos legales en BCN.cl contra los hashes
almacenados en data/legal-articles.json. Si detecta cambios:
  1. Evalua impacto con DeepSeek API (sin_impacto|requiere_revision|actualizar)
  2. Notifica via GitHub issue (gh + GITHUB_TOKEN); fallback: Telegram

Los hashes nuevos SOLO se persisten si la notificacion salio con exito — si
fallo, el cambio se re-detecta en la proxima corrida (no se pierde).
Siempre actualiza last_checked en legal-articles.json despues de una corrida exitosa.
Si BCN esta caido: fallo silencioso (exit 0), sin actualizacion de last_checked.

Uso:
  python scripts/check-bcn-changes.py              -> corrida completa (requiere DEEPSEEK_API_KEY + TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
  python scripts/check-bcn-changes.py --dry-run    -> fetch BCN + comparar hashes, sin llamar a DeepSeek ni enviar Telegram
"""

import sys
import os
import importlib
import json
import argparse
import subprocess
import urllib.request
import urllib.error
from datetime import datetime

# Agregar directorio de scripts al path para importar bcn-extractor
_scripts_dir = os.path.dirname(os.path.abspath(__file__))
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)

# Importar bcn-extractor via importlib (Python no permite import con guiones)
bcn = importlib.import_module('bcn-extractor')

# Version del script para trazabilidad
SCRIPT_VERSION = '2.0.0'


def evaluate_impact(client, data_key, claim_text, texto_anterior, texto_nuevo):
    """
    Evalua si el cambio en el articulo legal afecta la afirmacion del sitio.

    Llama a DeepSeek con el texto anterior y nuevo del articulo, mas el claim del sitio.
    Retorna uno de tres estados exactos.

    Args:
        client: openai.OpenAI instance configurado para DeepSeek
        data_key: string identificador del claim (ej: 'feriado_ano_nuevo')
        claim_text: string con la afirmacion del sitio (ej: '1 de enero es feriado')
        texto_anterior: string con el texto previo del articulo (puede ser None)
        texto_nuevo: string con el texto actual del articulo desde BCN

    Returns:
        string: 'sin_impacto' | 'requiere_revision' | 'actualizar'
    """
    prompt = (
        'Ley chilena — evaluacion de impacto en claim.\n\n'
        'Claim: {data_key}\n'
        'Afirmacion del sitio: "{claim_text}"\n\n'
        'Texto anterior del articulo legal:\n{texto_anterior}\n\n'
        'Texto actual del articulo legal:\n{texto_nuevo}\n\n'
        'Evalua si el cambio en el articulo legal afecta la veracidad del claim.\n'
        'Responde SOLO con una de estas tres palabras exactas (sin texto adicional):\n'
        'sin_impacto   -> el cambio es formal/tipografico, el claim sigue siendo correcto\n'
        'requiere_revision -> hay cambio sustantivo, revisar manualmente\n'
        'actualizar    -> el claim es definitivamente incorrecto con el texto nuevo\n'
    ).format(
        data_key=data_key,
        claim_text=claim_text,
        texto_anterior=texto_anterior or '(no disponible)',
        texto_nuevo=texto_nuevo,
    )

    response = client.chat.completions.create(
        model='deepseek-chat',
        max_tokens=16,
        messages=[{'role': 'user', 'content': prompt}],
    )
    raw = response.choices[0].message.content.strip().lower()

    # Normalizar respuesta — aceptar coincidencia parcial para robustez
    if 'actualizar' in raw:
        return 'actualizar'
    if 'requiere_revision' in raw or 'revision' in raw:
        return 'requiere_revision'
    return 'sin_impacto'


def send_github_issue_notification(changes, evaluations, claims_by_key, total_claims):
    """
    Crea (o comenta) un issue de GitHub con los cambios legales detectados.

    Usa el CLI `gh` con GH_TOKEN/GITHUB_TOKEN del runner — patron probado en
    sync-deploy.yml. Lanza RuntimeError si no se pudo notificar, para que el
    caller NO persista los hashes (el cambio se re-detecta la proxima corrida).
    """
    repo = os.environ.get('GITHUB_REPOSITORY')
    if not repo:
        raise RuntimeError('GITHUB_REPOSITORY no definido — no se puede crear issue')

    now_iso = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    lines = [
        'Cambios detectados en articulos legales BCN ({}).'.format(now_iso),
        '',
        'Claims verificados: {}'.format(total_claims),
        '',
    ]
    for ch in changes:
        dk = ch['data_key']
        claim_obj = claims_by_key.get(dk, {})
        lines.append('## {}'.format(dk))
        lines.append('- Evaluacion IA: **{}**'.format(evaluations.get(dk, 'requiere_revision')))
        lines.append('- Claim del sitio: {}'.format(claim_obj.get('claim', '(sin claim registrado)')))
        lines.append('- Texto anterior:')
        lines.append('  > {}'.format((ch['texto_antes'] or '(no disponible)')[:500]))
        lines.append('- Texto nuevo:')
        lines.append('  > {}'.format((ch['texto_despues'] or '')[:500]))
        lines.append('')
    lines.append('Accion: revisar los claims afectados en data/afirmaciones.json y el contenido del sitio.')
    body = '\n'.join(lines)

    # Buscar issue abierto existente para no duplicar
    result = subprocess.run(
        ['gh', 'issue', 'list', '--repo', repo, '--state', 'open',
         '--search', 'ALERTA cambio legal BCN in:title',
         '--json', 'number', '--jq', '.[0].number // empty'],
        capture_output=True, text=True, timeout=30,
    )
    existing = result.stdout.strip() if result.returncode == 0 else ''

    if existing:
        cmd = ['gh', 'issue', 'comment', existing, '--repo', repo, '--body', body]
    else:
        title = 'ALERTA cambio legal BCN {}'.format(datetime.utcnow().strftime('%Y-%m-%d'))
        cmd = ['gh', 'issue', 'create', '--repo', repo, '--title', title, '--body', body]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError('gh issue fallo: {}'.format(result.stderr.strip()))
    if result.stdout:
        print(result.stdout)


def send_telegram_notification(changes, evaluations, claims_by_key, total_claims, dry_run=False):
    """
    Envia notificacion de cambios via Telegram llamando a notify-telegram.js.

    Construye el JSON de entrada y lo pasa via stdin a notify-telegram.js.
    En --dry-run, pasa el flag --dry-run a notify-telegram.js tambien.
    """
    now_iso = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    payload = {
        'changes': [],
        'total_claims_checked': total_claims,
        'detection_date': now_iso,
    }
    for ch in changes:
        dk = ch['data_key']
        claim_obj = claims_by_key.get(dk, {})
        payload['changes'].append({
            'data_key': dk,
            'texto_antes': ch['texto_antes'],
            'texto_despues': ch['texto_despues'],
            'evaluacion': evaluations.get(dk, 'requiere_revision'),
            'claim_text': claim_obj.get('claim', '(sin claim registrado)'),
        })

    # Resolver path a notify-telegram.js relativo al script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    notify_script = os.path.join(script_dir, 'notify-telegram.js')

    cmd = ['node', notify_script]
    if dry_run:
        cmd.append('--dry-run')

    result = subprocess.run(
        cmd,
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        timeout=30,
    )

    if result.stdout:
        print(result.stdout)
    if result.returncode != 0:
        print('ERROR notify-telegram.js: {}'.format(result.stderr), file=sys.stderr)
        raise RuntimeError('notify-telegram.js exited with code {}'.format(result.returncode))


def main():
    """
    Funcion principal del pipeline de deteccion de cambios.

    Flujo:
      1. Parse argumentos (--dry-run)
      2. Cargar legal-articles.json y afirmaciones.json
      3. Agrupar claims por ley para evitar fetches redundantes (4 leyes, 15 claims)
      4. Para cada ley: fetch BCN + extraer articulos + comparar hashes
      5. Si hay cambios y no --dry-run: evaluar con DeepSeek + enviar notificacion Telegram
      6. Actualizar last_checked en legal-articles.json (solo si BCN disponible)
      7. Escribir legal-articles.json actualizado
    """
    parser = argparse.ArgumentParser(
        description='Detecta cambios en articulos legales BCN.cl comparando hashes SHA256.'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Fetch BCN y comparar hashes pero sin llamar a DeepSeek ni enviar Telegram',
    )
    args = parser.parse_args()

    # Resolver paths relativos al script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, '..', 'data')

    # Cargar afirmaciones.json
    afirmaciones_path = os.path.join(data_dir, 'afirmaciones.json')
    with open(afirmaciones_path, 'r', encoding='utf-8') as f:
        afirmaciones = json.load(f)

    # Cargar legal-articles.json
    legal_articles_path = os.path.join(data_dir, 'legal-articles.json')
    with open(legal_articles_path, 'r', encoding='utf-8') as f:
        legal_articles = json.load(f)

    # Construir lookup de claims por data_key para acceso rapido
    claims_by_key = {c['data_key']: c for c in afirmaciones.get('claims', [])}

    # Agrupar entradas de legal-articles.json por ley para evitar fetches redundantes
    # Cada ley se fetcha una sola vez, aunque tenga multiples claims
    entries_by_law = {}
    for data_key, stored in legal_articles.items():
        if data_key == '_meta':
            continue
        if not stored.get('hash_sha256'):
            # Claim sin hash almacenado (unidentified) — omitir
            continue
        ley_id = stored.get('ley_id')
        if not ley_id:
            continue
        if ley_id not in entries_by_law:
            entries_by_law[ley_id] = []
        entries_by_law[ley_id].append((data_key, stored))

    total_claims = sum(len(entries) for entries in entries_by_law.values())
    print('Checking {} claims across {} BCN laws...'.format(
        total_claims, len(entries_by_law)
    ))

    if args.dry_run:
        print('(--dry-run: no DeepSeek API, no Telegram notification)')

    changes = []
    bcn_error = False

    # Iterar por cada ley (fetch una vez por ley)
    for ley_id in sorted(entries_by_law.keys()):
        entries = entries_by_law[ley_id]
        print()
        print('Fetching {}...'.format(ley_id))

        # Obtener idNorma (con correcciones de bcn-extractor)
        try:
            id_norma = bcn.get_idnorma(afirmaciones, ley_id)
        except ValueError as e:
            print('  ERROR: {}'.format(e), file=sys.stderr)
            bcn_error = True
            break

        # Fetch JSON de la norma desde BCN API
        try:
            norma_data = bcn.fetch_norma_json(id_norma)
        except RuntimeError as e:
            print('  BCN unavailable for {}: {}'.format(ley_id, e), file=sys.stderr)
            bcn_error = True
            break

        # Extraer articulos
        articles = bcn.extract_articles(norma_data)
        if not articles:
            # BCN retorno respuesta vacia — tratar como error parcial, omitir esta ley
            print('  WARNING: No articles extracted for {} — treating as BCN partial error'.format(
                ley_id
            ), file=sys.stderr)
            bcn_error = True
            break

        print('  {} articles extracted from {}'.format(len(articles), ley_id))

        # Comparar hash para cada claim de esta ley
        for data_key, stored in entries:
            articulo_numero = stored.get('articulo_numero')
            stored_hash = stored.get('hash_sha256')

            # Buscar texto del articulo en la respuesta de BCN
            new_texto = bcn.find_article_text(articles, articulo_numero)
            if new_texto is None:
                print('  WARNING: Could not find article {} for {} — skipping'.format(
                    articulo_numero, data_key
                ), file=sys.stderr)
                continue

            # Calcular hash del texto actual
            new_hash = bcn.compute_hash(new_texto)

            if new_hash != stored_hash:
                print('  CHANGE DETECTED: {} (hash mismatch)'.format(data_key))
                # Usar texto_verbatim actual como "antes" (NO texto_anterior — ver Pitfall 6)
                changes.append({
                    'data_key': data_key,
                    'texto_antes': stored.get('texto_verbatim'),
                    'texto_despues': new_texto,
                    'new_hash': new_hash,
                })
            else:
                print('  OK: {} (hash matches)'.format(data_key))

    # Si hubo error de BCN: fallo silencioso, sin actualizar last_checked
    if bcn_error:
        print()
        print('WARNING: BCN unavailable for one or more laws.', file=sys.stderr)
        print('last_checked NOT updated (preserving last successful check timestamp).', file=sys.stderr)
        print('Exiting silently (exit 0).')
        sys.exit(0)

    # Procesar cambios detectados
    if changes and not args.dry_run:
        print()
        print('{} change(s) detected. Evaluating impact with DeepSeek...'.format(len(changes)))

        # Construir cliente DeepSeek (importacion lazy dentro de bcn.build_ai_client)
        client = bcn.build_ai_client()

        # Evaluar impacto de cada cambio
        evaluations = {}
        for ch in changes:
            dk = ch['data_key']
            claim_obj = claims_by_key.get(dk, {})
            claim_text = claim_obj.get('claim', '(sin claim registrado)')
            estado = evaluate_impact(
                client,
                dk,
                claim_text,
                ch['texto_antes'],
                ch['texto_despues'],
            )
            evaluations[dk] = estado
            print('  {} -> {}'.format(dk, estado))

        # Notificar via GitHub issue (canal primario), con fallback Telegram.
        # CRITICO: los hashes SOLO se persisten si la notificacion salio con
        # exito. Antes el fallo se tragaba y el hash se sobreescribia igual →
        # un cambio legal detectado se perdia PERMANENTEMENTE en silencio.
        print()
        notification_ok = False
        print('Creating GitHub issue notification...')
        try:
            send_github_issue_notification(changes, evaluations, claims_by_key, total_claims)
            print('GitHub issue notification sent successfully.')
            notification_ok = True
        except (RuntimeError, OSError, subprocess.TimeoutExpired) as e:
            print('ERROR creating GitHub issue: {}'.format(e), file=sys.stderr)
            print('Trying Telegram fallback...')
            try:
                send_telegram_notification(changes, evaluations, claims_by_key, total_claims)
                print('Telegram notification sent successfully.')
                notification_ok = True
            except (RuntimeError, OSError, subprocess.TimeoutExpired) as e2:
                print('ERROR sending Telegram notification: {}'.format(e2), file=sys.stderr)

        if notification_ok:
            # Actualizar legal_articles con los cambios detectados
            for ch in changes:
                dk = ch['data_key']
                if dk in legal_articles:
                    # Preservar texto anterior (el verbatim actual antes de sobreescribir)
                    legal_articles[dk]['texto_anterior'] = legal_articles[dk].get('texto_verbatim')
                    legal_articles[dk]['texto_verbatim'] = ch['texto_despues']
                    legal_articles[dk]['hash_sha256'] = ch['new_hash']
        else:
            print('NOTIFICATION FAILED — hashes NOT updated; el cambio se '
                  're-detectara en la proxima corrida.', file=sys.stderr)

    elif changes and args.dry_run:
        print()
        print('--dry-run: {} change(s) detected. Telegram message preview:'.format(len(changes)))
        # Build minimal evaluations dict for dry-run preview
        evaluations = {ch['data_key']: 'requiere_revision' for ch in changes}
        try:
            send_telegram_notification(changes, evaluations, claims_by_key, total_claims, dry_run=True)
        except RuntimeError as e:
            print('WARNING: notify-telegram.js dry-run failed: {}'.format(e), file=sys.stderr)

    else:
        print()
        print('0 changes detected. All hashes match.')

    # Actualizar last_checked para TODAS las entradas (corrida exitosa)
    now_iso = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    for data_key in legal_articles:
        if data_key == '_meta':
            continue
        legal_articles[data_key]['last_checked'] = now_iso

    # Actualizar _meta
    if '_meta' in legal_articles:
        legal_articles['_meta']['last_checked_at'] = now_iso
    else:
        legal_articles['_meta'] = {
            'last_checked_at': now_iso,
            'script_version': SCRIPT_VERSION,
        }

    # Escribir legal-articles.json actualizado
    with open(legal_articles_path, 'w', encoding='utf-8') as f:
        json.dump(legal_articles, f, ensure_ascii=False, indent=2)

    print()
    print('{} changes detected, {} claims checked. last_checked updated.'.format(
        len(changes), total_claims
    ))

    sys.exit(0)


if __name__ == '__main__':
    main()
