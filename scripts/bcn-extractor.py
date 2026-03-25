#!/usr/bin/env python3
"""
bcn-extractor.py — Extrae articulos legales de BCN.cl para claims de feriados.

Fases secuenciales:
  1. Lee claims BCN de data/afirmaciones.json
  2. Obtiene JSON de cada ley desde nuevo.leychile.cl
  3. Extrae texto de articulos (strip HTML + unescape entities)
  4. Usa DeepSeek API para identificar que articulos respaldan cada claim
  5. Guarda resultado verbatim en data/legal-articles.json con SHA256 hashes

Uso:
  python scripts/bcn-extractor.py              -> ejecuta completo (requiere DEEPSEEK_API_KEY)
  python scripts/bcn-extractor.py --dry-run    -> fetch + mostrar articulos, sin AI ni escritura
  python scripts/bcn-extractor.py --force      -> re-identifica todos los claims, incluso los ya mapeados

Salida: data/legal-articles.json
"""

import urllib.request
import urllib.error
import json
import re
import html as html_module
import hashlib
import os
import sys
import time
import argparse
from datetime import datetime

# Base URL del API de BCN (SPA backend — no usar www.bcn.cl/leychile directamente)
BCN_API_BASE = 'https://nuevo.leychile.cl/servicios'

# Version del script para trazabilidad en legal-articles.json
SCRIPT_VERSION = '1.0.0'

# Correcciones de idNorma: afirmaciones.json tiene valores erroneos para estas leyes
# bcn-ley-20148: api_endpoint tenia 257742 (HTTP 500), correcto es 257080
IDNORMA_CORRECTIONS = {
    'bcn-ley-20148': '257080',
}


def get_idnorma(afirmaciones, source_id):
    """
    Extrae idNorma para una fuente BCN desde afirmaciones.json, aplicando correcciones.

    Si source_id esta en IDNORMA_CORRECTIONS, devuelve el valor corregido.
    De lo contrario, extrae el idNorma del campo api_endpoint con regex.

    Args:
        afirmaciones: dict cargado desde afirmaciones.json
        source_id: string como 'bcn-ley-2977'

    Returns:
        string con el idNorma (ej: '23639')

    Raises:
        ValueError: si no se encuentra idNorma en api_endpoint
    """
    if source_id in IDNORMA_CORRECTIONS:
        return IDNORMA_CORRECTIONS[source_id]
    source = afirmaciones.get('sources', {}).get(source_id, {})
    endpoint = source.get('api_endpoint', '')
    match = re.search(r'idNorma=(\d+)', endpoint)
    if not match:
        raise ValueError('No idNorma encontrado para source_id: {}'.format(source_id))
    return match.group(1)


def fetch_norma_json(id_norma, timeout=30):
    """
    Obtiene el JSON de una norma desde la API de BCN.

    Endpoint: https://nuevo.leychile.cl/servicios/Navegar/get_norma_json?idNorma=XXXXX

    Args:
        id_norma: string o int con el idNorma
        timeout: segundos de timeout para la conexion (default 30)

    Returns:
        dict con la estructura JSON de la norma (campos: html, estructura, metadatos, ...)

    Raises:
        RuntimeError: si hay error HTTP o de conexion
    """
    url = '{}/Navegar/get_norma_json?idNorma={}'.format(BCN_API_BASE, id_norma)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        raise RuntimeError(
            'BCN API error para idNorma={}: HTTP {} — {}'.format(id_norma, e.code, e.reason)
        )
    except urllib.error.URLError as e:
        raise RuntimeError(
            'BCN no disponible para idNorma={}: {}'.format(id_norma, e.reason)
        )


def extract_articles(norma_data):
    """
    Extrae articulos de la respuesta JSON de get_norma_json.

    Usa el array 'estructura' para identificar articulos (partes cuyo nombre contiene 'art').
    Extrae el texto del array 'html' indexado por item_id ('i').

    Args:
        norma_data: dict con la respuesta de fetch_norma_json

    Returns:
        list de dicts: [{'numero': str, 'item_id': int, 'texto': str}, ...]
    """
    estructura = norma_data.get('estructura', [])
    html_list = norma_data.get('html', [])
    # Crear dict para lookup rapido: item_id -> html_string
    html_items = {item['i']: item['t'] for item in html_list if 'i' in item and 't' in item}

    articles = []
    for part in estructura:
        name = part.get('n', '')
        item_id = part.get('i')
        # Incluir solo partes que son articulos (no Encabezado, Promulgacion, etc.)
        if 'art' in name.lower() and item_id and item_id in html_items:
            raw_html = html_items[item_id]
            texto = extract_text(raw_html)
            articles.append({
                'numero': name,
                'item_id': item_id,
                'texto': texto,
            })
    return articles


def extract_text(html_string):
    """
    Limpia texto HTML: strip de tags y unescape de entidades.

    Proceso:
      1. Elimina tags HTML con regex
      2. Unescape entidades HTML (&amp;, &#xFA;, &nbsp;, etc.)
      3. Normaliza espacios en blanco

    Args:
        html_string: string con HTML del BCN

    Returns:
        string con texto limpio
    """
    # Reemplaza tags HTML por espacio (evita concatenacion de palabras)
    text = re.sub(r'<[^>]+>', ' ', html_string)
    # Unescape entidades HTML (&nbsp; -> espacio, &#xFA; -> u con acento, etc.)
    text = html_module.unescape(text)
    # Normaliza multiples espacios/saltos de linea en uno solo
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def compute_hash(text):
    """
    Calcula SHA256 del texto en UTF-8.

    El texto debe ser el resultado de extract_text() para consistencia.

    Args:
        text: string con texto normalizado

    Returns:
        string hexadecimal de 64 caracteres (SHA256)
    """
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def get_feriado_claims(afirmaciones):
    """
    Filtra y agrupa claims de feriados con fuente BCN desde afirmaciones.json.

    Criterio de inclusion:
      - claim['id'].startswith('feriado')
      - claim.get('source_id', '').startswith('bcn-')

    Excluye los 2 claims derivados sin fuente BCN:
      - feriadosEnClases (source_id: null)
      - feriadosSinImpacto (source_id: null)

    Args:
        afirmaciones: dict cargado desde afirmaciones.json

    Returns:
        dict: {source_id: [claim, ...], ...} — 4 keys (una por ley BCN)
    """
    by_law = {}
    for claim in afirmaciones.get('claims', []):
        claim_id = claim.get('id') or ''
        source_id = claim.get('source_id') or ''
        if claim_id.startswith('feriado') and source_id.startswith('bcn-'):
            law = claim['source_id']
            by_law.setdefault(law, []).append(claim)
    return by_law


def build_ai_client():
    """
    Construye cliente OpenAI apuntando a DeepSeek API (OpenAI-compatible).

    Lee DEEPSEEK_API_KEY del entorno. Si no esta definida, imprime instrucciones y sale.

    Returns:
        openai.OpenAI instance configurado para DeepSeek
    """
    # Importacion aqui (dentro de funcion) para permitir --dry-run sin el SDK
    import openai

    api_key = os.environ.get('DEEPSEEK_API_KEY')
    if not api_key:
        print('ERROR: DEEPSEEK_API_KEY no esta configurada.', file=sys.stderr)
        print('  Ejecutar: export DEEPSEEK_API_KEY=sk-...', file=sys.stderr)
        sys.exit(1)
    return openai.OpenAI(api_key=api_key, base_url='https://api.deepseek.com/v1')


def identify_articles(client, ley_id, articles, claims):
    """
    Usa DeepSeek API para identificar que articulos respaldan cada claim de una ley.

    Envio batch por ley: un prompt con todos los articulos + todos los claims de esa ley.
    DeepSeek devuelve JSON mapeando data_key -> {articulo_numero, inciso}.

    Args:
        client: openai.OpenAI instance configurado para DeepSeek
        ley_id: string como 'bcn-ley-2977'
        articles: list de {numero, item_id, texto}
        claims: list de {data_key, claim, source_reference, ...}

    Returns:
        dict: {data_key: {'articulo_numero': str, 'inciso': str|null}, ...}
    """
    articles_block = '\n'.join(
        '{}: {}'.format(a['numero'], a['texto']) for a in articles
    )
    claims_block = '\n'.join(
        '- {} | "{}" | hint: {}'.format(
            c['data_key'], c['claim'], c.get('source_reference', '')
        )
        for c in claims
    )
    prompt = (
        'Ley: {ley_id}\n\n'
        'Articulos de la ley:\n{articles_block}\n\n'
        'Claims que debes mapear a articulos:\n{claims_block}\n\n'
        'Para cada claim, identifica el articulo que lo respalda.\n'
        'Responde SOLO con JSON valido, sin texto adicional:\n'
        '{{"data_key_1": {{"articulo_numero": "PRIMERO", "inciso": "2"}}, ...}}\n'
        'Si no puedes identificar el articulo para un claim, usa null para ambos campos.'
    ).format(ley_id=ley_id, articles_block=articles_block, claims_block=claims_block)

    try:
        response = client.chat.completions.create(
            model='deepseek-chat',
            max_tokens=1024,
            messages=[{'role': 'user', 'content': prompt}],
        )
        response_text = response.choices[0].message.content
    except Exception as e:
        raise RuntimeError('DeepSeek API error para {}: {}'.format(ley_id, e))

    # Parsear JSON de la respuesta (con fallback si Claude agrega preambulo)
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        # Intentar extraer bloque JSON con regex
        match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        print(
            'WARNING: DeepSeek no devolvio JSON valido para {}. Respuesta: {}'.format(
                ley_id, response_text[:200]
            ),
            file=sys.stderr,
        )
        return {}


def update_entry(existing, new_texto, new_hash, ley_id, articulo_numero, inciso):
    """
    Actualiza o crea una entrada en legal-articles.json para un claim.

    Si el hash cambio, preserva el texto anterior en 'texto_anterior'.
    Si el hash es igual, no modifica el texto (operacion idempotente).

    Args:
        existing: dict existente de legal-articles.json (o None si es nuevo)
        new_texto: string con el texto verbatim del articulo
        new_hash: string SHA256 del texto
        ley_id: string como 'bcn-ley-2977'
        articulo_numero: string como 'PRIMERO' o None
        inciso: string como '2' o None

    Returns:
        dict actualizado con todos los campos requeridos
    """
    if existing is None:
        entry = {
            'ley_id': ley_id,
            'articulo_numero': articulo_numero,
            'inciso': inciso,
            'texto_verbatim': None,
            'hash_sha256': None,
            'last_checked': None,
            'texto_anterior': None,
        }
    else:
        entry = dict(existing)

    # Detectar cambio de texto
    old_hash = entry.get('hash_sha256')
    if old_hash and old_hash != new_hash:
        # Texto cambio — preservar version anterior
        entry['texto_anterior'] = entry.get('texto_verbatim')

    # Actualizar campos
    entry['texto_verbatim'] = new_texto
    entry['hash_sha256'] = new_hash
    entry['last_checked'] = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    entry['ley_id'] = ley_id
    entry['articulo_numero'] = articulo_numero
    entry['inciso'] = inciso
    # Limpiar status de corridas previas — ahora tenemos texto valido
    entry.pop('status', None)

    return entry


def find_article_text(articles, articulo_numero):
    """
    Busca el texto de un articulo en la lista de articulos extraidos.

    Intenta matching por nombre exacto, luego por equivalencia ordinal<->numerico,
    luego fallback a primer articulo si solo hay uno.

    Args:
        articles: list de {numero, item_id, texto}
        articulo_numero: string como 'PRIMERO', '1', 'UNICO'

    Returns:
        string con el texto del articulo, o None si no se encuentra
    """
    if not articulo_numero:
        return None

    # Mapa de ordinales <-> numericos para matching flexible
    ORDINAL_EQUIVALENTS = {
        'primero': ['1', 'primero', 'primer'],
        '1': ['1', 'primero', 'primer'],
        'segundo': ['2', 'segundo'],
        '2': ['2', 'segundo'],
        'tercero': ['3', 'tercero'],
        '3': ['3', 'tercero'],
        'unico': ['unico', 'u\u00eanico', '\u00fanico', 'unico'],
        '\u00fanico': ['unico', '\u00fanico', 'unico'],
    }

    query_lower = articulo_numero.lower().strip()
    # Obtener alias equivalentes para este query
    aliases = ORDINAL_EQUIVALENTS.get(query_lower, [query_lower])

    # Matching: buscar cualquier alias en el nombre del articulo
    for art in articles:
        art_name_lower = art['numero'].lower()
        for alias in aliases:
            if alias in art_name_lower:
                return art['texto']

    # Fallback: si solo hay un articulo, devolver ese
    if len(articles) == 1:
        return articles[0]['texto']

    return None


def main():
    """
    Funcion principal del extractor BCN.

    Fases:
      1. Parse argumentos
      2. Cargar afirmaciones.json
      3. Cargar legal-articles.json existente (si existe)
      4. Agrupar claims por ley
      5. Para cada ley: fetch JSON + extraer articulos
      6. Si no --dry-run: usar Claude para identificar articulos por claim
      7. Escribir legal-articles.json
    """
    parser = argparse.ArgumentParser(
        description='Extrae articulos legales de BCN.cl para claims de feriados.'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Fetch y mostrar articulos pero sin escritura ni Claude API',
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Re-identificar todos los claims, incluso los ya mapeados',
    )
    args = parser.parse_args()

    # Resolver paths relativos al script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, '..', 'data')

    # Cargar afirmaciones.json
    afirmaciones_path = os.path.join(data_dir, 'afirmaciones.json')
    with open(afirmaciones_path, 'r', encoding='utf-8') as f:
        afirmaciones = json.load(f)

    # Cargar legal-articles.json existente (para actualizacion idempotente)
    output_path = os.path.join(data_dir, 'legal-articles.json')
    existing_data = {}
    if os.path.exists(output_path):
        with open(output_path, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)

    # Agrupar claims de feriados por ley
    by_law = get_feriado_claims(afirmaciones)
    total_claims = sum(len(claims) for claims in by_law.values())
    print('Found {} BCN-sourced feriado claims across {} laws'.format(
        total_claims, len(by_law)
    ))

    if args.dry_run:
        print('(--dry-run: no Claude API, no file writes)')

    output = {}
    ai_client = None  # Lazy init — solo si se necesita

    for source_id in sorted(by_law.keys()):
        claims = by_law[source_id]
        print()
        print('Processing {}...'.format(source_id))

        # Obtener idNorma (con correcciones)
        try:
            id_norma = get_idnorma(afirmaciones, source_id)
        except ValueError as e:
            print('  ERROR: {}'.format(e), file=sys.stderr)
            sys.exit(1)

        # Fetch JSON de la norma desde BCN API
        try:
            norma_data = fetch_norma_json(id_norma)
        except RuntimeError as e:
            print('  ERROR fetching {}: {}'.format(source_id, e), file=sys.stderr)
            sys.exit(1)

        # Extraer articulos
        articles = extract_articles(norma_data)
        print('  {} — {} articles extracted'.format(source_id, len(articles)))

        if args.dry_run:
            for art in articles:
                preview = art['texto'][:80].replace('\n', ' ')
                print('    [{}] {}...'.format(art['numero'], preview))
            # Delay entre leyes aun en dry-run (respeto al servidor)
            time.sleep(1)
            continue

        # Determinar que claims necesitan identificacion
        claims_needing_id = []
        for claim in claims:
            data_key = claim['data_key']
            existing_entry = existing_data.get(data_key)
            needs_id = (
                args.force or
                existing_entry is None or
                not existing_entry.get('articulo_numero')
            )
            if needs_id:
                claims_needing_id.append(claim)

        # Identificar articulos con Claude (si hay claims que necesitan ID)
        identification = {}
        if claims_needing_id:
            if ai_client is None:
                ai_client = build_ai_client()
            print('  Identifying {} claims with DeepSeek API...'.format(len(claims_needing_id)))
            try:
                identification = identify_articles(
                    ai_client, source_id, articles, claims_needing_id
                )
                print('  Identification results: {}'.format(
                    {k: v for k, v in identification.items()}
                ))
            except RuntimeError as e:
                print('  WARNING: {}'.format(e), file=sys.stderr)
                print('  Continuando con claims sin identificar para esta ley...', file=sys.stderr)

        # Construir entradas para cada claim de esta ley
        for claim in claims:
            data_key = claim['data_key']
            existing_entry = existing_data.get(data_key)

            # Determinar articulo y inciso
            if data_key in identification:
                mapping = identification[data_key] or {}
                articulo_numero = mapping.get('articulo_numero') if mapping else None
                inciso = mapping.get('inciso') if mapping else None
            elif existing_entry and existing_entry.get('articulo_numero'):
                # Preservar identificacion existente
                articulo_numero = existing_entry['articulo_numero']
                inciso = existing_entry.get('inciso')
            else:
                articulo_numero = None
                inciso = None

            # Fallback: si AI no identifico el articulo, intentar extraerlo
            # del campo source_reference ("Art. 1 — ...", "Art. unico — ...")
            # Si no hay source_reference util, usar el primer articulo de la ley (Art. 1 / PRIMERO)
            if not articulo_numero:
                source_ref = claim.get('source_reference', '') or ''
                ref_match = re.search(r'art(?:iculo)?\.?\s+([^\s\u2014\-]+)', source_ref, re.IGNORECASE)
                if ref_match:
                    articulo_numero = ref_match.group(1).strip('.')
                    print('  INFO: Usando source_reference "{}" -> articulo_numero={}'.format(
                        source_ref, articulo_numero))
                elif articles:
                    # Fallback final: usar primer articulo de la ley
                    articulo_numero = articles[0]['numero']
                    print('  INFO: Fallback a primer articulo ({}) para {}'.format(
                        articulo_numero, data_key))

            # Obtener texto del articulo identificado
            article_texto = find_article_text(articles, articulo_numero)

            if article_texto is None:
                # Claim sin articulo identificado — marcar como unidentified
                print('  WARNING: No se pudo identificar articulo para {}'.format(data_key))
                output[data_key] = {
                    'ley_id': source_id,
                    'articulo_numero': None,
                    'inciso': None,
                    'texto_verbatim': None,
                    'hash_sha256': None,
                    'last_checked': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'texto_anterior': None,
                    'status': 'unidentified',
                }
                continue

            # Calcular hash y actualizar entrada
            new_hash = compute_hash(article_texto)
            entry = update_entry(
                existing=existing_entry,
                new_texto=article_texto,
                new_hash=new_hash,
                ley_id=source_id,
                articulo_numero=articulo_numero,
                inciso=inciso,
            )
            output[data_key] = entry

        # Delay entre leyes para evitar rate limiting
        time.sleep(1)

    if args.dry_run:
        print()
        print('--dry-run complete. {} laws processed.'.format(len(by_law)))
        sys.exit(0)

    # Verificar claims no identificados
    unidentified = [k for k, v in output.items() if v.get('status') == 'unidentified']
    if unidentified:
        print()
        print('WARNING: {} claims sin identificar: {}'.format(len(unidentified), unidentified))

    # Construir _meta
    content_keys = [k for k in output if k != '_meta']
    now_iso = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    output['_meta'] = {
        'generated_at': now_iso,
        'script_version': SCRIPT_VERSION,
        'total_claims': len(content_keys),
    }

    # Escribir legal-articles.json
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print()
    print('legal-articles.json written: {} claims'.format(len(content_keys)))
    print('  Path: {}'.format(output_path))
    if unidentified:
        print('  WARNING: {} claims unidentified — revisar manualmente'.format(len(unidentified)))

    sys.exit(0)


if __name__ == '__main__':
    main()
