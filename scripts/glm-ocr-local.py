#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
glm-ocr-local.py — Extraccion local OCR + cross-check contra pipeline visual

Dos modos:
  extract:    Procesa PNGs de tabla via GLM-OCR (Ollama local) y genera JSON
              compatible con validate-extraction.js. Para dev/testing sin API keys.
  crosscheck: Compara resultados GLM-OCR contra visual-extraction.json existente.
              Detecta discrepancias entre pipeline visual (LLM) y OCR local.

Requiere:
  - Ollama corriendo en localhost:11434 con modelo glm-ocr
  - PNGs de tabla en data/snapshots/ (generados por pdf-to-png.py + organize-snapshots.js)

Uso:
  python scripts/glm-ocr-local.py                       # extract: todas las regiones
  python scripts/glm-ocr-local.py --region=aysen         # extract: solo una region
  python scripts/glm-ocr-local.py --crosscheck           # cross-check contra visual-extraction.json
  python scripts/glm-ocr-local.py --crosscheck --region=aysen
  python scripts/glm-ocr-local.py --dry-run              # mostrar que se procesaria, sin OCR

Salida:
  extract:    data/glm-ocr-extraction.json (mismo schema que visual-extraction.json)
  crosscheck: data/glm-ocr-crosscheck.json (reporte de discrepancias)
"""

import base64
import json
import os
import re
import sys
import time
import urllib.request
from html.parser import HTMLParser
from datetime import datetime, timezone

# ── Paths ────────────────────────────────────────────────────────────────

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAPSHOTS_DIR = os.path.join(PROJECT_ROOT, 'data', 'snapshots')
MANIFEST_PATH = os.path.join(SNAPSHOTS_DIR, 'png-manifest.json')
VISUAL_EXTRACTION_PATH = os.path.join(PROJECT_ROOT, 'data', 'visual-extraction.json')
OUTPUT_EXTRACT = os.path.join(PROJECT_ROOT, 'data', 'glm-ocr-extraction.json')
OUTPUT_CROSSCHECK = os.path.join(PROJECT_ROOT, 'data', 'glm-ocr-crosscheck.json')

# ── Config ───────────────────────────────────────────────────────────────

OLLAMA_URL = 'http://localhost:11434/api/generate'
MODEL = 'glm-ocr'
YEAR = 2026
NUM_CTX = 16384
NUM_PREDICT = 8192
OCR_TIMEOUT = 300

# ── Region names ─────────────────────────────────────────────────────────

REGION_NAMES = {
    'arica-y-parinacota': 'Arica y Parinacota',
    'tarapaca': 'Tarapacá',
    'antofagasta': 'Antofagasta',
    'atacama': 'Atacama',
    'coquimbo': 'Coquimbo',
    'valparaiso': 'Valparaíso',
    'metropolitana': 'Región Metropolitana',
    'ohiggins': "O'Higgins",
    'maule': 'Maule',
    'nuble': 'Ñuble',
    'biobio': 'Biobío',
    'araucania': 'La Araucanía',
    'los-rios': 'Los Ríos',
    'los-lagos': 'Los Lagos',
    'aysen': 'Aysén',
    'magallanes': 'Magallanes',
}

# ── Spanish month mapping ────────────────────────────────────────────────

MONTHS_ES = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
}
MONTHS_BY_NUM = {v: k for k, v in MONTHS_ES.items()}

# ── Colors (terminal) ───────────────────────────────────────────────────

USE_COLOR = hasattr(sys.stdout, 'isatty') and sys.stdout.isatty()


def green(s):
    return '\033[32m' + s + '\033[0m' if USE_COLOR else s


def red(s):
    return '\033[31m' + s + '\033[0m' if USE_COLOR else s


def yellow(s):
    return '\033[33m' + s + '\033[0m' if USE_COLOR else s


def bold(s):
    return '\033[1m' + s + '\033[0m' if USE_COLOR else s


# ── CLI parsing ──────────────────────────────────────────────────────────

def parse_args():
    args = sys.argv[1:]
    opts = {
        'crosscheck': '--crosscheck' in args,
        'dry_run': '--dry-run' in args,
        'region': None,
    }
    for a in args:
        if a.startswith('--region='):
            opts['region'] = a.split('=', 1)[1]
    return opts


# ── HTML Table Parser ────────────────────────────────────────────────────

class TableParser(HTMLParser):
    """Parse HTML tables from GLM-OCR output into list of [row, row, ...]."""

    def __init__(self):
        super().__init__()
        self.tables = []
        self._table = []
        self._row = []
        self._cell = ''
        self._in_cell = False

    def handle_starttag(self, tag, attrs):
        t = tag.lower()
        if t == 'table':
            self._table = []
        elif t == 'tr':
            self._row = []
        elif t in ('td', 'th'):
            self._in_cell = True
            self._cell = ''

    def handle_endtag(self, tag):
        t = tag.lower()
        if t == 'table':
            if self._table:
                self.tables.append(self._table)
            self._table = []
        elif t == 'tr':
            if self._row:
                self._table.append(self._row)
        elif t in ('td', 'th'):
            self._in_cell = False
            self._row.append(self._cell.strip())

    def handle_data(self, data):
        if self._in_cell:
            self._cell += data


def parse_html_tables(html):
    p = TableParser()
    p.feed(html)
    return p.tables


# ── Date helpers ─────────────────────────────────────────────────────────

def parse_date_es(text):
    """Parse '4 de marzo' or 'Lunes 02 de marzo' into 'YYYY-MM-DD'."""
    if not text:
        return None
    m = re.search(r'(\d{1,2})\s+de\s+([a-záéíóúñ]+)', text.lower())
    if not m:
        return None
    day = int(m.group(1))
    month_name = m.group(2)
    month_num = MONTHS_ES.get(month_name)
    if not month_num:
        return None
    return '%d-%02d-%02d' % (YEAR, month_num, day)


def extract_day_of_week(text):
    """Extract Spanish day name from text like 'Lunes 02 de marzo'."""
    if not text:
        return None
    days = ['lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo']
    canonical = ['Lunes', 'Martes', 'Miércoles', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Sábado', 'Domingo']
    t = text.lower().strip()
    for i, d in enumerate(days):
        if t.startswith(d):
            return canonical[i]
    return None


def extract_date_range(text):
    """Extract (start_date, end_date) from text like '22 de junio - viernes 03 de julio'."""
    # "DD de mes - [dayname] DD de mes"
    m = re.search(
        r'(\d{1,2})\s*de\s+(\w+)\s*[-–—]\s*(?:\w+\s+)?(\d{1,2})\s*de\s+(\w+)',
        text, re.IGNORECASE
    )
    if m:
        s_month = m.group(2).lower()
        e_month = m.group(4).lower()
        if s_month in MONTHS_ES and e_month in MONTHS_ES:
            start = '%d-%02d-%02d' % (YEAR, MONTHS_ES[s_month], int(m.group(1)))
            end = '%d-%02d-%02d' % (YEAR, MONTHS_ES[e_month], int(m.group(3)))
            return start, end
    # "DD - DD de mes" (same month)
    m = re.search(
        r'(\d{1,2})\s*[-–—]\s*(?:\w+\s+)?(\d{1,2})\s*de\s+(\w+)',
        text, re.IGNORECASE
    )
    if m:
        month = m.group(3).lower()
        if month in MONTHS_ES:
            mn = MONTHS_ES[month]
            return (
                '%d-%02d-%02d' % (YEAR, mn, int(m.group(1))),
                '%d-%02d-%02d' % (YEAR, mn, int(m.group(2))),
            )
    # "DD de mes al DD de mes"
    m = re.search(
        r'(\d{1,2})\s*de\s+(\w+)\s*(?:al|hasta)\s*(?:\w+\s+)?(\d{1,2})\s*de\s+(\w+)',
        text, re.IGNORECASE
    )
    if m:
        s_month = m.group(2).lower()
        e_month = m.group(4).lower()
        if s_month in MONTHS_ES and e_month in MONTHS_ES:
            start = '%d-%02d-%02d' % (YEAR, MONTHS_ES[s_month], int(m.group(1)))
            end = '%d-%02d-%02d' % (YEAR, MONTHS_ES[e_month], int(m.group(3)))
            return start, end
    return None, None


# ── Field extraction from OCR tables ─────────────────────────────────────

# Patterns map label text → field name. First match wins.
# Order matters: more specific patterns before general ones.
LABEL_PATTERNS = [
    # inicio (student start, not teacher start)
    ('inicio', [
        r'ingreso\s*(de)?\s*estudiantes\s*\(?nt',
        r'inicio\s*(del)?\s*a[nñ]o\s*lectivo\s*(de)?\s*nt',
        r'03\.\-?\s*inicio\s*(de)?\s*clases',
        r'05\.\s*inicio\s*(del)?\s*a[nñ]o\s*lectivo',
    ]),
    # vacaciones (range — special handling)
    ('_vacaciones_range', [
        r'receso\s*(de)?\s*invierno\s*r[eé]gimen\s*semestral',
        r'receso\s*(de)?\s*invierno\s*semestral',
        r'receso\s*(de)?\s*invierno(?!\s*trimestral)',
        r'vacaciones\s*(de)?\s*invierno',
        r'10\.\s*vacaciones\s*(de)?\s*invierno',
        r'07\.\-?\s*receso\s*(de)?\s*invierno',
    ]),
    # inicio segundo semestre
    ('inicioSegundoSemestre', [
        r'inicio\s*(de)?\s*clases\s*segundo\s*semestre',
        r'inicio\s*(del)?\s*segundo\s*semestre',
        r'inicio\s*(de)?\s*clases\s*posterior\s*(a|al)?\s*receso\s*semestral',
        r'08\.\-?\s*inicio\s*(de)?\s*clases\s*segundo',
        r'11\.\s*inicio\s*(de)?\s*clases\s*segundo',
    ]),
    # dia del profesor
    ('diaProfesor', [
        r'd[ií]a\s*(del)?\s*profesor',
    ]),
    # fin ano JEC (38 semanas)
    ('finAno', [
        r'[uú]ltimo\s*d[ií]a\s*(de)?\s*clases.*(?:con\s*)?je?c[d]?.*38',
        r'[uú]ltimo\s*d[ií]a\s*(de)?\s*clases\s*(establecimientos?\s*)?con\s*je?c',
        r't[eé]rmino\s*(de)?\s*clases.*con\s*je?c',
        r'establecimientos?\s*educacionales?\s*con\s*jec.*38\s*semanas',
        r'12\.\-?\s*t[eé]rmino\s*(de)?\s*clases',
    ]),
    # fin ano sin JEC (40 semanas)
    ('finAnoSinJEC', [
        r'[uú]ltimo\s*d[ií]a\s*(de)?\s*clases.*sin\s*je?c[d]?.*40',
        r'[uú]ltimo\s*d[ií]a\s*(de)?\s*clases\s*(establecimientos?\s*)?sin\s*je?c',
        r't[eé]rmino\s*(de)?\s*clases.*sin\s*je?c',
        r'establecimientos?\s*educacionales?\s*sin\s*jec.*40\s*semanas',
        r'13\.\-?\s*t[eé]rmino\s*(de)?\s*clases',
    ]),
]


def extract_fields_from_tables(tables, raw_text):
    """
    Extract calendar fields from parsed HTML tables.
    Returns dict with field entries compatible with visual-extraction.json schema.
    """
    semestral = []
    found = set()

    # Flatten all rows from all tables
    all_rows = []
    for table in tables:
        all_rows.extend(table)

    for row in all_rows:
        row_text = ' '.join(row)
        row_lower = row_text.lower()

        for field_name, patterns in LABEL_PATTERNS:
            if field_name in found:
                continue

            matched = False
            for pat in patterns:
                if re.search(pat, row_lower, re.IGNORECASE):
                    matched = True
                    break
            if not matched:
                continue

            # Special: vacation range
            if field_name == '_vacaciones_range':
                start, end = extract_date_range(row_text)
                if start and end:
                    semestral.append({
                        '_field': 'vacaciones',
                        'label': row[0] if len(row) >= 2 else row_text.split('  ')[0].strip(),
                        'date_start': start,
                        'date_end': end,
                        'raw_text': row[-1] if len(row) >= 2 else row_text,
                    })
                    found.add('_vacaciones_range')
                continue

            # Normal field: extract date from last cell with a date
            date_cell = None
            for cell in reversed(row):
                if parse_date_es(cell):
                    date_cell = cell
                    break
            if not date_cell:
                continue

            iso = parse_date_es(date_cell)
            dow = extract_day_of_week(date_cell)
            label = row[0] if len(row) >= 2 else row_text.split('  ')[0].strip()

            entry = {
                '_field': field_name,
                'label': label,
                'date': iso,
                'raw_text': date_cell,
            }
            if dow:
                entry['day_of_week'] = dow
            semestral.append(entry)
            found.add(field_name)

    # Fallback: text-based extraction for anything still missing
    text_lower = raw_text.lower()
    for field_name, patterns in LABEL_PATTERNS:
        if field_name in found:
            continue
        if field_name == '_vacaciones_range':
            for pat in patterns:
                m = re.search(pat, text_lower)
                if m:
                    ctx = raw_text[m.start():m.end() + 200]
                    start, end = extract_date_range(ctx)
                    if start and end:
                        semestral.append({
                            '_field': 'vacaciones',
                            'label': ctx[:60].strip(),
                            'date_start': start,
                            'date_end': end,
                            'raw_text': ctx[:100].strip(),
                        })
                        found.add('_vacaciones_range')
                        break
            continue

        for pat in patterns:
            m = re.search(pat, text_lower)
            if m:
                after = raw_text[m.end():m.end() + 120]
                dm = re.search(r'(\d{1,2})\s*de\s+([a-záéíóúñ]+)', after.lower())
                if dm:
                    day = int(dm.group(1))
                    month = MONTHS_ES.get(dm.group(2))
                    if month:
                        iso = '%d-%02d-%02d' % (YEAR, month, day)
                        semestral.append({
                            '_field': field_name,
                            'label': raw_text[m.start():m.end()].strip(),
                            'date': iso,
                            'raw_text': after[:60].strip(),
                        })
                        found.add(field_name)
                        break

    return semestral, found


# ── Ollama API ───────────────────────────────────────────────────────────

def call_ollama(png_path):
    """Call GLM-OCR via Ollama. Returns (response_text, duration_ms)."""
    with open(png_path, 'rb') as f:
        img_b64 = base64.b64encode(f.read()).decode('utf-8')

    payload = json.dumps({
        'model': MODEL,
        'prompt': 'Table Recognition:',
        'images': [img_b64],
        'stream': False,
        'options': {'num_predict': NUM_PREDICT, 'num_ctx': NUM_CTX},
    }).encode('utf-8')

    req = urllib.request.Request(
        OLLAMA_URL, data=payload,
        headers={'Content-Type': 'application/json'},
    )

    start = time.time()
    resp = urllib.request.urlopen(req, timeout=OCR_TIMEOUT)
    data = json.loads(resp.read().decode('utf-8'))
    ms = int((time.time() - start) * 1000)
    return data.get('response', ''), ms


# ── Check Ollama connectivity ────────────────────────────────────────────

def check_ollama():
    """Verify Ollama is running and glm-ocr is loaded."""
    try:
        req = urllib.request.Request(
            'http://localhost:11434/api/tags',
            headers={'Content-Type': 'application/json'},
        )
        resp = urllib.request.urlopen(req, timeout=5)
        data = json.loads(resp.read().decode('utf-8'))
        models = [m.get('name', '') for m in data.get('models', [])]
        for m in models:
            if 'glm-ocr' in m:
                return True
        print(red('ERROR: modelo glm-ocr no encontrado en Ollama.'))
        print('  Modelos disponibles: %s' % ', '.join(models))
        print('  Ejecuta: ollama pull glm-ocr')
        return False
    except Exception as e:
        print(red('ERROR: No se puede conectar a Ollama en localhost:11434'))
        print('  %s' % e)
        print('  Asegurate de que Ollama esta corriendo.')
        return False


# ── Load manifest ────────────────────────────────────────────────────────

def load_manifest(region_filter=None):
    """Load png-manifest.json and return {slug: [png_paths]}."""
    if not os.path.isfile(MANIFEST_PATH):
        # Fallback: scan for tabla PNGs directly
        tabla_files = {}
        for fname in sorted(os.listdir(SNAPSHOTS_DIR)):
            if '-tabla-' in fname and fname.endswith('.png'):
                slug = fname.split('-tabla-')[0]
                if region_filter and slug != region_filter:
                    continue
                if slug not in tabla_files:
                    tabla_files[slug] = []
                tabla_files[slug].append(os.path.join(SNAPSHOTS_DIR, fname))
        return tabla_files

    with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    result = {}
    for slug, info in manifest.get('regions', {}).items():
        if region_filter and slug != region_filter:
            continue
        pngs = []
        for png_name in info.get('table_pngs', []):
            p = os.path.join(SNAPSHOTS_DIR, png_name)
            if os.path.isfile(p):
                pngs.append(p)
        if pngs:
            result[slug] = pngs
    return result


# ── MODE: Extract ────────────────────────────────────────────────────────

def mode_extract(opts):
    """Run GLM-OCR on tabla PNGs and output visual-extraction.json-compatible JSON."""
    regions = load_manifest(opts['region'])
    if not regions:
        print(red('No hay PNGs de tabla para procesar.'))
        return 1

    print(bold('GLM-OCR Local Extract'))
    print('Regiones: %d | PNGs: %d' % (len(regions), sum(len(v) for v in regions.values())))
    print()

    if opts['dry_run']:
        for slug in sorted(regions):
            pngs = regions[slug]
            print('  %s: %s' % (slug, ', '.join(os.path.basename(p) for p in pngs)))
        print('\n(--dry-run: sin OCR)')
        return 0

    output = {
        '_meta': {
            'pipeline': 'glm-ocr-local',
            'date': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            'model': MODEL,
            'note': 'Extraccion OCR local via Ollama. Para dev/testing sin API keys.',
        },
        'regions': {},
    }

    total_ms = 0
    total_pages = 0
    errors = []

    for slug in sorted(regions):
        pngs = regions[slug]
        name = REGION_NAMES.get(slug, slug)
        print(bold('%-25s' % name), end='', flush=True)

        all_html = []
        region_ms = 0

        for png_path in pngs:
            try:
                resp, ms = call_ollama(png_path)
                all_html.append(resp)
                region_ms += ms
                total_pages += 1
            except Exception as e:
                errors.append({'region': slug, 'file': os.path.basename(png_path), 'error': str(e)})
                print(red(' ERROR: %s' % e))

        total_ms += region_ms

        # Parse tables from all pages
        combined = '\n'.join(all_html)
        tables = []
        for html in all_html:
            tables.extend(parse_html_tables(html))

        semestral, found = extract_fields_from_tables(tables, combined)

        output['regions'][slug] = {
            '_meta': {
                'region': name,
                'regionSlug': slug,
                'source_pdf': 'mineduc-%s.pdf' % slug,
                'extracted_by': 'glm-ocr-local',
                'extracted_date': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                'ocr_time_ms': region_ms,
                'pages_processed': len(pngs),
            },
            'year': YEAR,
            'semestral': semestral,
            'trimestral': [],
        }

        # Summary
        n_fields = len(found - {'_vacaciones_range'}) + (1 if '_vacaciones_range' in found else 0)
        print(' %s  %d campos  %dms' % (
            green('%d/%d pags' % (len(pngs), len(pngs))),
            n_fields,
            region_ms,
        ))

    # Write output
    with open(OUTPUT_EXTRACT, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print()
    print(bold('Resultado:'))
    print('  Archivo:  %s' % os.path.relpath(OUTPUT_EXTRACT, PROJECT_ROOT))
    print('  Regiones: %d' % len(output['regions']))
    print('  Paginas:  %d' % total_pages)
    print('  Tiempo:   %.1fs' % (total_ms / 1000))
    if errors:
        print(red('  Errores:  %d' % len(errors)))
        for e in errors:
            print('    %s/%s: %s' % (e['region'], e['file'], e['error']))

    print()
    print('Validar con: node scripts/validate-extraction.js --input=data/glm-ocr-extraction.json')
    return 0


# ── MODE: Cross-check ────────────────────────────────────────────────────

def iso_to_day_month(iso):
    """Convert 'YYYY-MM-DD' to (month, day) tuple for comparison."""
    if not iso:
        return None
    m = re.match(r'\d{4}-(\d{2})-(\d{2})', iso)
    if m:
        return (int(m.group(1)), int(m.group(2)))
    return None


def extract_flat_dates(region_data):
    """Extract flat {field: iso_date} from extraction JSON region entry.
    Uses _field tags if present (glm-ocr-extraction.json), falls back to
    label pattern matching (visual-extraction.json)."""
    flat = {}
    for entry in region_data.get('semestral', []):
        field = entry.get('_field')
        label = entry.get('label', '').lower()

        # If tagged, use the tag directly
        if field == 'vacaciones' or (not field and (
            re.search(r'receso\s*(de)?\s*invierno', label) or
            re.search(r'vacaciones\s*(de)?\s*invierno', label)
        )):
            if 'vacacionesInicio' not in flat:
                flat['vacacionesInicio'] = entry.get('date_start')
            if 'vacacionesFin' not in flat:
                flat['vacacionesFin'] = entry.get('date_end')
            continue

        if field:
            # Tagged entry — use directly
            if field not in flat:
                flat[field] = entry.get('date')
            continue

        # Fallback: pattern match label (for visual-extraction.json which has no _field)
        for field_name, patterns in LABEL_PATTERNS:
            if field_name in flat or field_name == '_vacaciones_range':
                continue
            for pat in patterns:
                if re.search(pat, label, re.IGNORECASE):
                    flat[field_name] = entry.get('date')
                    break

    return flat


def mode_crosscheck(opts):
    """Compare GLM-OCR extraction against visual-extraction.json."""
    # Load visual extraction (ground truth from LLM pipeline)
    if not os.path.isfile(VISUAL_EXTRACTION_PATH):
        print(red('ERROR: %s no existe.' % VISUAL_EXTRACTION_PATH))
        print('Ejecuta primero: node scripts/extract-visual.js')
        return 1

    with open(VISUAL_EXTRACTION_PATH, 'r', encoding='utf-8') as f:
        visual = json.load(f)

    visual_regions = visual.get('regions', {})

    # Load or generate OCR extraction
    if os.path.isfile(OUTPUT_EXTRACT):
        print('Usando extraccion OCR existente: %s' % os.path.relpath(OUTPUT_EXTRACT, PROJECT_ROOT))
        with open(OUTPUT_EXTRACT, 'r', encoding='utf-8') as f:
            ocr_data = json.load(f)
    else:
        print('No existe extraccion OCR. Ejecutando extract primero...\n')
        opts_extract = dict(opts)
        opts_extract['crosscheck'] = False
        ret = mode_extract(opts_extract)
        if ret != 0:
            return ret
        with open(OUTPUT_EXTRACT, 'r', encoding='utf-8') as f:
            ocr_data = json.load(f)

    ocr_regions = ocr_data.get('regions', {})

    print()
    print(bold('Cross-check: GLM-OCR vs Pipeline Visual'))
    print('=' * 60)

    compare_fields = ['inicio', 'vacacionesInicio', 'vacacionesFin',
                      'inicioSegundoSemestre', 'diaProfesor', 'finAno', 'finAnoSinJEC']

    report = {
        'date': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        'visual_source': visual.get('_meta', {}).get('date', '?'),
        'ocr_source': ocr_data.get('_meta', {}).get('date', '?'),
        'regions': {},
        'summary': {'total_fields': 0, 'matches': 0, 'mismatches': 0, 'missing': 0},
    }

    all_mismatches = []

    slugs = sorted(set(visual_regions.keys()) | set(ocr_regions.keys()))
    if opts['region']:
        slugs = [s for s in slugs if s == opts['region']]

    for slug in slugs:
        name = REGION_NAMES.get(slug, slug)
        v_data = visual_regions.get(slug, {})
        o_data = ocr_regions.get(slug, {})

        if not v_data:
            print(yellow('  %-25s SKIP (sin datos visual)' % name))
            continue
        if not o_data:
            print(yellow('  %-25s SKIP (sin datos OCR)' % name))
            continue

        # Extract flat dates from both
        v_flat = extract_flat_dates(v_data)
        o_flat = extract_flat_dates(o_data)

        region_result = {'matches': {}, 'mismatches': [], 'missing': []}
        match_count = 0
        mismatch_count = 0
        missing_count = 0

        for field in compare_fields:
            v_date = v_flat.get(field)
            o_date = o_flat.get(field)

            report['summary']['total_fields'] += 1

            if not o_date:
                region_result['missing'].append(field)
                missing_count += 1
                report['summary']['missing'] += 1
            elif not v_date:
                # OCR found it but visual didn't — note it
                region_result['matches'][field] = {'ocr': o_date, 'visual': None, 'note': 'solo en OCR'}
                missing_count += 1
                report['summary']['missing'] += 1
            elif iso_to_day_month(v_date) == iso_to_day_month(o_date):
                region_result['matches'][field] = True
                match_count += 1
                report['summary']['matches'] += 1
            else:
                region_result['mismatches'].append({
                    'field': field,
                    'visual': v_date,
                    'ocr': o_date,
                })
                mismatch_count += 1
                report['summary']['mismatches'] += 1
                all_mismatches.append('%s/%s: visual=%s  ocr=%s' % (slug, field, v_date, o_date))

        report['regions'][slug] = region_result

        # Print summary line
        if mismatch_count > 0:
            status = red('MISMATCH (%d)' % mismatch_count)
        elif missing_count > 0:
            status = yellow('PARTIAL (%d missing)' % missing_count)
        else:
            status = green('OK (%d/%d)' % (match_count, len(compare_fields)))

        print('  %-25s %s' % (name, status))

    # Write report
    with open(OUTPUT_CROSSCHECK, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # Summary
    s = report['summary']
    print()
    print(bold('Resumen:'))
    print('  Campos comparados: %d' % s['total_fields'])
    print('  Coincidencias:     %s' % green(str(s['matches'])))
    if s['mismatches']:
        print('  Discrepancias:     %s' % red(str(s['mismatches'])))
        print()
        print(red('  DISCREPANCIAS DETECTADAS:'))
        for m in all_mismatches:
            print('    %s' % m)
    else:
        print('  Discrepancias:     0')
    if s['missing']:
        print('  Campos faltantes:  %s' % yellow(str(s['missing'])))
    print()
    print('Reporte: %s' % os.path.relpath(OUTPUT_CROSSCHECK, PROJECT_ROOT))
    return 1 if s['mismatches'] > 0 else 0


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    opts = parse_args()

    if not opts['dry_run'] and not check_ollama():
        return 1

    if opts['crosscheck']:
        return mode_crosscheck(opts)
    else:
        return mode_extract(opts)


if __name__ == '__main__':
    sys.exit(main())
