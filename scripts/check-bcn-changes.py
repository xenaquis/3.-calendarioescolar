#!/usr/bin/env python3
"""
check-bcn-changes.py — Pipeline de deteccion de cambios en articulos legales BCN.

Compara los hashes SHA256 de los articulos legales en BCN.cl contra los hashes
almacenados en data/legal-articles.json. Si detecta cambios:
  1. Evalua impacto con DeepSeek API (sin_impacto|requiere_revision|actualizar)
  2. Crea un GitHub Issue consolidado con diff, evaluacion IA, claims y recomendacion

Siempre actualiza last_checked en legal-articles.json despues de una corrida exitosa.
Si BCN esta caido: fallo silencioso (exit 0), sin actualizacion de last_checked.

Uso:
  python scripts/check-bcn-changes.py              -> corrida completa (requiere DEEPSEEK_API_KEY + GH_TOKEN)
  python scripts/check-bcn-changes.py --dry-run    -> fetch BCN + comparar hashes, sin DeepSeek ni GitHub Issue
"""

import sys
import os
import importlib
import json
import argparse
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
SCRIPT_VERSION = '1.0.0'


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


def create_github_issue(title, body, labels):
    """
    Crea un GitHub Issue via GitHub REST API con el token GH_TOKEN del entorno.

    Args:
        title: string con el titulo del Issue
        body: string con el cuerpo markdown del Issue
        labels: list de strings con los labels a asignar

    Returns:
        string con la URL HTML del Issue creado

    Raises:
        RuntimeError: si GH_TOKEN o GITHUB_REPOSITORY no estan disponibles
        RuntimeError: si la API de GitHub retorna error HTTP
    """
    gh_token = os.environ.get('GH_TOKEN')
    if not gh_token:
        raise RuntimeError(
            'GH_TOKEN no esta configurada. '
            'Asegurarse de que el Action mapea GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}'
        )

    repo = os.environ.get('GITHUB_REPOSITORY')
    if not repo:
        raise RuntimeError(
            'GITHUB_REPOSITORY no disponible. '
            'Esta variable es automatica en GitHub Actions. '
            'Para pruebas locales: export GITHUB_REPOSITORY=owner/repo'
        )

    url = 'https://api.github.com/repos/{}/issues'.format(repo)
    payload = json.dumps({
        'title': title,
        'body': body,
        'labels': labels,
    }).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=payload,
        method='POST',
        headers={
            'Authorization': 'Bearer {}'.format(gh_token),
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    )

    try:
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read().decode('utf-8'))
        return result.get('html_url', '(Issue creado sin URL)')
    except urllib.error.HTTPError as e:
        body_text = e.read().decode('utf-8', errors='replace')
        raise RuntimeError('GitHub API error {}: {}'.format(e.code, body_text))


def build_issue_body(changes, evaluations, claims_by_key):
    """
    Construye el cuerpo markdown del GitHub Issue con todos los cambios detectados.

    Incluye 4 componentes por cambio:
      1. Diff (texto anterior vs texto actual en bloques de codigo)
      2. Evaluacion IA (sin_impacto|requiere_revision|actualizar)
      3. Claims afectados (data_key + texto del claim)
      4. Recomendacion basada en el estado de evaluacion

    Args:
        changes: list de dicts con data_key, texto_antes, texto_despues, new_hash
        evaluations: dict {data_key: estado} con los resultados de DeepSeek
        claims_by_key: dict {data_key: claim_obj} del afirmaciones.json

    Returns:
        string con el cuerpo markdown del Issue
    """
    now_iso = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    lines = []
    lines.append('## Cambios detectados en articulos BCN\n\n')
    lines.append('**Fecha de deteccion:** {}\n'.format(now_iso))
    lines.append('**Total de cambios:** {}\n'.format(len(changes)))

    for ch in changes:
        dk = ch['data_key']
        claim_obj = claims_by_key.get(dk, {})
        claim_text = claim_obj.get('claim', '(sin claim registrado)')
        estado = evaluations.get(dk, 'requiere_revision')

        # Mapa de recomendaciones por estado
        recomendaciones = {
            'sin_impacto': 'Sin accion requerida. El cambio es formal o tipografico — el claim sigue siendo correcto. Verificar igualmente en el siguiente ciclo.',
            'requiere_revision': 'Revisar manualmente si el claim sigue siendo correcto. Hay un cambio sustantivo en el texto legal que podria afectar la afirmacion.',
            'actualizar': 'ACCION REQUERIDA: Actualizar el claim en el sitio. El texto legal ha cambiado sustantivamente y el claim actual es incorrecto.',
        }
        recomendacion = recomendaciones.get(estado, 'Revisar manualmente.')

        lines.append('\n---\n\n')
        lines.append('### Claim afectado: `{}`\n\n'.format(dk))
        lines.append('**Afirmacion del sitio:** {}\n\n'.format(claim_text))
        lines.append('**Evaluacion IA:** `{}`\n\n'.format(estado))
        lines.append('**Texto anterior:**\n')
        lines.append('```\n{}\n```\n\n'.format(
            ch['texto_antes'] or '(sin registro previo)'
        ))
        lines.append('**Texto actual (BCN):**\n')
        lines.append('```\n{}\n```\n\n'.format(ch['texto_despues']))
        lines.append('**Recomendacion:** {}\n'.format(recomendacion))

    return ''.join(lines)


def main():
    """
    Funcion principal del pipeline de deteccion de cambios.

    Flujo:
      1. Parse argumentos (--dry-run)
      2. Cargar legal-articles.json y afirmaciones.json
      3. Agrupar claims por ley para evitar fetches redundantes (4 leyes, 15 claims)
      4. Para cada ley: fetch BCN + extraer articulos + comparar hashes
      5. Si hay cambios y no --dry-run: evaluar con DeepSeek + crear GitHub Issue
      6. Actualizar last_checked en legal-articles.json (solo si BCN disponible)
      7. Escribir legal-articles.json actualizado
    """
    parser = argparse.ArgumentParser(
        description='Detecta cambios en articulos legales BCN.cl comparando hashes SHA256.'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Fetch BCN y comparar hashes pero sin llamar a DeepSeek ni crear GitHub Issues',
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
        print('(--dry-run: no DeepSeek API, no GitHub Issue creation)')

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

        # Construir Issue consolidado
        n_changes = len(changes)
        title = 'Cambio detectado en articulado BCN ({} claim(s))'.format(n_changes)
        body = build_issue_body(changes, evaluations, claims_by_key)
        labels = ['bcn-change', 'legal-review']

        print()
        print('Creating GitHub Issue...')
        try:
            issue_url = create_github_issue(title, body, labels)
            print('Issue created: {}'.format(issue_url))
        except RuntimeError as e:
            print('ERROR creating GitHub Issue: {}'.format(e), file=sys.stderr)
            # Continuar — actualizar last_checked igualmente

        # Actualizar legal_articles con los cambios detectados
        for ch in changes:
            dk = ch['data_key']
            if dk in legal_articles:
                # Preservar texto anterior (el verbatim actual antes de sobreescribir)
                legal_articles[dk]['texto_anterior'] = legal_articles[dk].get('texto_verbatim')
                legal_articles[dk]['texto_verbatim'] = ch['texto_despues']
                legal_articles[dk]['hash_sha256'] = ch['new_hash']

    elif changes and args.dry_run:
        print()
        print('--dry-run: {} change(s) detected (no DeepSeek, no Issue created):'.format(len(changes)))
        for ch in changes:
            print('  - {} (stored hash differs from BCN current)'.format(ch['data_key']))

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
