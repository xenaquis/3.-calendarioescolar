# Phase 8: BCN Legal Extractor - Research

**Researched:** 2026-03-25
**Domain:** BCN.cl leychile JSON API + Python HTTP + Anthropic SDK + JSON storage
**Confidence:** HIGH

## Summary

Phase 8 builds a Python script that fetches the text of 4 Chilean holiday laws from BCN.cl, uses Claude API to identify which specific articles back each of 15 holiday claims, and stores the verbatim text with SHA256 hashes in `data/legal-articles.json`. This phase is the data-gathering foundation for Phase 9 (change detection) and Phase 10 (verification tooltips).

The critical research finding is that the BCN.cl endpoint documented in `afirmaciones.json` (`/servicios/exportar?idNorma=XXXXX&formato=xml`) does NOT return XML — the entire `www.bcn.cl/leychile` domain is now a JavaScript SPA that serves `index.html` for every route. The actual JSON API backend is at `https://nuevo.leychile.cl/servicios/Navegar/get_norma_json?idNorma=XXXXX`. This endpoint returns structured JSON with HTML-encoded article text, and works for 3 of the 4 laws. Ley 20148 additionally has a wrong `idNorma` in `afirmaciones.json` (stored as `257742`, correct value is `257080`).

The Anthropic Python SDK (v0.71.0) is already installed on this machine. The `claude-haiku-4-5` model string is valid per the SDK's `ModelParam` type definition.

**Primary recommendation:** Use `https://nuevo.leychile.cl/servicios/Navegar/get_norma_json?idNorma=XXXXX` as the fetch endpoint. Parse the `html` array from the JSON response. Strip HTML tags to get verbatim text. Fix the ley 20148 idNorma to `257080` in the script (or afirmaciones.json).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Script architecture:** Single script `scripts/bcn-extractor.py` — phases secuenciales: fetch XML → parse artículos → identificar con Claude → guardar JSON
- **HTTP:** via `urllib.request` (stdlib, sin dependencias adicionales)
- **Idempotente:** actualiza solo si hash SHA256 cambia respecto al guardado; preserva `texto_anterior` cuando hay cambio
- **Output file:** `data/legal-articles.json` (nombre exacto del spec)
- **Modelo Claude:** `claude-haiku-4-5` (económico, suficiente para tarea estructurada de identificación)
- **Prompting:** batch por ley — un prompt que recibe todos los artículos de la ley + todos los claims feriado de esa ley → Claude devuelve mapping `claim_data_key → [articulo_numero, inciso]`
- **Re-identificación:** solo si el campo `articulo_numero` está vacío/null — preserva trabajo anterior
- **Si Claude no puede identificar:** guardar `articulo_numero: null, status: "unidentified"` — logging para revisión manual
- **Clave primaria en JSON:** por `data_key` (e.g., `feriado_viernes_santo`) — mismo key que usa el frontend
- **Campos por entry:** `ley_id, articulo_numero, inciso, texto_verbatim, hash_sha256, last_checked, texto_anterior`
- **Claims derivados excluidos** (`feriadosEnClases`, `feriadosSinImpacto`) — no tienen fuente BCN
- **Metadatos globales:** `_meta: {generated_at, script_version, total_claims}`
- **Error handling:** exit code 1 con mensaje claro si BCN no responde o si falta ANTHROPIC_API_KEY
- **Timeout HTTP:** 30 segundos

### Claude's Discretion

- Ninguna — todas las decisiones fueron tomadas durante la discusión

### Deferred Ideas (OUT OF SCOPE)

- Ninguna — la discusión se mantuvo dentro del scope de la fase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BCN-01 | `scripts/bcn-extractor.py` obtiene el XML de cada ley de feriado desde BCN.cl y extrae el texto de todos sus artículos | API endpoint verified: `nuevo.leychile.cl/servicios/Navegar/get_norma_json`. Returns JSON with `html` array of article objects. Parse HTML tags to get verbatim text. |
| BCN-02 | Para cada claim `feriado-*` en `afirmaciones.json`, Claude API identifica qué artículos son relevantes | SDK v0.71.0 installed, `claude-haiku-4-5` model verified valid. Batch prompt pattern: one call per law, all articles + all claims for that law. |
| BCN-03 | `data/legal-articles.json` almacena por claim: artículos verbatim, hash SHA del texto, `last_checked`, y texto anterior cuando hay cambio | Pure stdlib: `hashlib.sha256`, `json`, `datetime`. Schema fully defined in CONTEXT.md decisions. |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Python:** `#!/usr/bin/env python3` shebang, script in `scripts/` directory
- **CERO dependencias npm:** script es Python puro, no toca node_modules
- **No API keys in frontend code:** `ANTHROPIC_API_KEY` solo como variable de entorno
- **Output en `data/`:** `data/legal-articles.json` — cumple la convención
- **No crear archivos fuera de `public/`, `data/`, `functions/`, `scripts/`, `validacion/`:** cumple
- **Actualizacion de BLUEPRINT.md** después de cada cambio importante

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `urllib.request` | stdlib | HTTP requests to BCN API | Locked decision — no external deps |
| `xml.etree.ElementTree` | stdlib | HTML parsing fallback | Available, but not needed for JSON path |
| `hashlib` | stdlib | SHA256 hashing | Standard — `hashlib.sha256(text.encode()).hexdigest()` |
| `json` | stdlib | Read afirmaciones.json, write legal-articles.json | Standard |
| `re` | stdlib | Strip HTML tags from BCN JSON response | `re.sub(r'<[^>]+>', '', text)` |
| `html` | stdlib | Unescape HTML entities (`&amp;`, `&#xFA;`, etc.) | `html.unescape(text)` |
| `datetime` | stdlib | Generate `last_checked` ISO timestamp | `datetime.utcnow().isoformat() + 'Z'` |
| `anthropic` | 0.71.0 (installed) | Claude API client | Already installed, `claude-haiku-4-5` valid |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sys` | stdlib | Exit codes, stderr output | `sys.exit(1)` on fatal error |
| `os` | stdlib | Read env var `ANTHROPIC_API_KEY` | `os.environ.get('ANTHROPIC_API_KEY')` |
| `argparse` | stdlib | Optional `--dry-run` or `--force` flags | Pattern from pdf-to-png.py |

**Installation:**
```bash
# No installation needed — all stdlib + anthropic already installed
# Verify:
python3 -c "import anthropic; print(anthropic.__version__)"
# Expected: 0.71.0
```

---

## Architecture Patterns

### Recommended Project Structure

```
scripts/
└── bcn-extractor.py        # New — single script, sequential phases

data/
├── afirmaciones.json       # Input — read claims + api_endpoint (NOTE: ley-20148 idNorma wrong)
└── legal-articles.json     # Output — created/updated by this script
```

### Pattern 1: BCN JSON API Fetch

**What:** `nuevo.leychile.cl/servicios/Navegar/get_norma_json?idNorma=XXXXX` returns JSON with `html` array of article objects.

**When to use:** This is the ONLY working endpoint. The `servicios/exportar?idNorma=XXXXX&formato=xml` endpoint in `afirmaciones.json` serves an HTML SPA, not XML.

**Response structure:**
```python
{
  "html": [
    {"i": 8275810, "t": "<div>...Encabezado HTML...</div>"},
    {"i": 8275811, "t": "<div>...Article 1 HTML...</div>", "v": []},
    {"i": 8275812, "t": "<div>...Article 2 HTML...</div>", "v": ["MODIFICACION"]},
    # ...
  ],
  "estructura": [
    {"n": "Encabezado", "i": 8275810},
    {"n": "Artículo PRIMERO", "i": 8275811, "t": 6},
    {"n": "Artículo 2", "i": 8275812, "t": 6},
    # ...
  ],
  "metadatos": {"tipos_numeros": [...], "titulo_norma": "..."},
  "proyectos": [], "jurisprudencia": [], ...
}
```

**Example fetch:**
```python
# Source: verified against BCN SPA bundle + live testing 2026-03-25
import urllib.request
import json

def fetch_norma(id_norma, timeout=30):
    url = 'https://nuevo.leychile.cl/servicios/Navegar/get_norma_json?idNorma={}'.format(id_norma)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    resp = urllib.request.urlopen(req, timeout=timeout)
    return json.loads(resp.read().decode('utf-8'))
```

### Pattern 2: Article Text Extraction

**What:** Strip HTML tags and unescape HTML entities from the `t` field of each `html` array item.

**Critical detail:** The `estructura` array maps article names to item IDs (`i`). Use it to identify which `html` items are articles (those with `t` field in `estructura`, or whose `n` starts with "Art").

```python
# Source: verified by parsing live BCN responses
import re
import html as html_module

def extract_article_text(html_string):
    """Strip HTML tags and unescape entities from BCN html field."""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', html_string)
    # Unescape HTML entities (&nbsp; &#xFA; &quot; etc.)
    text = html_module.unescape(text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text
```

### Pattern 3: Claude API Batch Identification

**What:** One API call per law: send all article texts + all claim `source_reference` hints → Claude returns JSON mapping `data_key → {articulo_numero, inciso}`.

**Model:** `claude-haiku-4-5` (verified valid in SDK v0.71.0 `ModelParam` type)

```python
# Source: anthropic SDK v0.71.0 pattern
import anthropic
import os

def identify_articles_for_law(client, ley_id, articles, claims):
    """
    articles: list of {numero, texto} dicts
    claims: list of {data_key, claim, source_reference} dicts
    Returns: dict mapping data_key -> {articulo_numero, inciso}
    """
    articles_text = '\n'.join(
        'Artículo {}: {}'.format(a['numero'], a['texto'])
        for a in articles
    )
    claims_text = '\n'.join(
        '- data_key: {} | claim: {} | hint: {}'.format(
            c['data_key'], c['claim'], c.get('source_reference', '')
        )
        for c in claims
    )

    prompt = '''Ley: {}

Artículos de la ley:
{}

Claims que debes mapear a artículos:
{}

Para cada claim, identifica el artículo que lo respalda.
Responde SOLO con JSON válido, sin texto adicional:
{{
  "data_key_1": {{"articulo_numero": "PRIMERO", "inciso": "2"}},
  "data_key_2": {{"articulo_numero": "UNICO", "inciso": null}},
  ...
}}
Si no puedes identificar el artículo para un claim, usa null para ambos campos.'''.format(
        ley_id, articles_text, claims_text
    )

    message = client.messages.create(
        model='claude-haiku-4-5',
        max_tokens=1024,
        messages=[{'role': 'user', 'content': prompt}]
    )

    return json.loads(message.content[0].text)
```

### Pattern 4: Idempotent JSON Update

**What:** Read existing `legal-articles.json` → for each claim, compare new text hash to stored hash → only update if different, preserving `texto_anterior`.

```python
def update_entry(existing, new_texto, new_hash, ley_id, articulo_numero, inciso):
    """Update a claim entry, preserving texto_anterior if text changed."""
    entry = existing or {
        'ley_id': ley_id,
        'articulo_numero': articulo_numero,
        'inciso': inciso,
        'texto_verbatim': None,
        'hash_sha256': None,
        'last_checked': None,
        'texto_anterior': None,
    }

    old_hash = entry.get('hash_sha256')
    if old_hash and old_hash != new_hash:
        # Text changed — preserve previous
        entry['texto_anterior'] = entry.get('texto_verbatim')

    entry['texto_verbatim'] = new_texto
    entry['hash_sha256'] = new_hash
    entry['last_checked'] = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    return entry
```

### Pattern 5: Filtering Claims from afirmaciones.json

**What:** Iterate the `claims` array (not an object — it's a list), filter by `id.startswith('feriado')` AND `source_id` starting with `bcn-`.

```python
def get_feriado_claims(afirmaciones):
    """Return BCN-sourced feriado claims grouped by source_id."""
    by_law = {}
    for claim in afirmaciones.get('claims', []):
        if (claim['id'].startswith('feriado') and
                claim.get('source_id', '').startswith('bcn-')):
            law = claim['source_id']
            by_law.setdefault(law, []).append(claim)
    return by_law

def get_law_norma_id(afirmaciones, source_id):
    """Extract idNorma from api_endpoint URL in sources."""
    source = afirmaciones.get('sources', {}).get(source_id, {})
    endpoint = source.get('api_endpoint', '')
    # URL format: https://www.bcn.cl/leychile/servicios/exportar?idNorma=XXXXX&formato=xml
    import re
    match = re.search(r'idNorma=(\d+)', endpoint)
    return match.group(1) if match else None
```

### Anti-Patterns to Avoid

- **Using `afirmaciones.json` api_endpoint directly:** That URL format (`/servicios/exportar?idNorma=X&formato=xml`) serves an HTML SPA, not XML. Always use `nuevo.leychile.cl/servicios/Navegar/get_norma_json?idNorma=X` instead.
- **Using `var` in this Python script:** Project uses `var` for JS compatibility only — Python code uses standard Python conventions.
- **Hardcoding norma IDs:** Read them from `afirmaciones.json → sources → api_endpoint`, then apply the ley-20148 correction at runtime.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML entity unescaping | Custom entity map | `html.unescape()` | stdlib, handles all entities |
| HTTP with timeout | Custom socket code | `urllib.request.urlopen(req, timeout=30)` | stdlib, sufficient |
| SHA256 | Custom hash | `hashlib.sha256(text.encode('utf-8')).hexdigest()` | stdlib, deterministic |
| JSON parsing | Custom parser | `json.loads()` / `json.dumps(..., ensure_ascii=False, indent=2)` | stdlib |
| Anthropic API auth | HTTP headers by hand | `anthropic.Anthropic(api_key=...)` | SDK handles auth, retries, rate limits |

**Key insight:** This is a pure data-fetching script. The only non-stdlib dependency is the Anthropic SDK, which is already installed. No HTML parsing library (BeautifulSoup etc.) is needed — `re.sub(r'<[^>]+>', ' ', text)` is sufficient for the simple HTML structure from BCN.

---

## Critical Data Corrections

### ley-20148 idNorma is Wrong in afirmaciones.json

**Finding (HIGH confidence — verified by live API testing):**

`afirmaciones.json → sources → bcn-ley-20148 → api_endpoint` contains `idNorma=257742`.

That ID returns HTTP 500 from `get_norma_json`. The correct `idNorma` for Ley 20.148 is **`257080`**, verified by:
1. BCN search API (`buscarjson`) returns `IDNORMA: 257080` for "Ley 20148"
2. `get_norma_json?idNorma=257080` returns the correct law: "DECLARA FERIADO EL DIA 16 DE JULIO DE CADA AÑO, EN QUE SE CELEBRA Y HONRA A LA VIRGEN DEL CARMEN..."

**Action required in script:** The script must override the idNorma for `bcn-ley-20148` from `257742` to `257080`. This can be done with a hardcoded correction map in the script, OR by fixing `afirmaciones.json` directly. Recommend fixing `afirmaciones.json` as part of Wave 0 so the source of truth is correct.

### BCN API Endpoint Mismatch

**Finding (HIGH confidence — verified):**

The `api_endpoint` field in `afirmaciones.json` uses the old export URL format which no longer serves XML. The correct endpoint for programmatic access is:

```
OLD (broken): https://www.bcn.cl/leychile/servicios/exportar?idNorma=XXXXX&formato=xml
NEW (working): https://nuevo.leychile.cl/servicios/Navegar/get_norma_json?idNorma=XXXXX
```

The script should NOT use the `api_endpoint` field value directly — it should only extract the `idNorma` parameter from it, then build the correct `nuevo.leychile.cl` URL.

---

## Law Coverage Summary

| ley_id | Law | idNorma (correct) | Articles | Claims |
|--------|-----|-------------------|----------|--------|
| bcn-ley-2977 | Ley 2.977 — Feriados base | 23639 | 4 articles | ~11 claims |
| bcn-ley-19668 | Ley 19.668 — Traslado a lunes | 160270 | 1 article (único) | ~2 claims |
| bcn-ley-20148 | Ley 20.148 — Virgen del Carmen | **257080** (not 257742) | 2 articles | 1 claim |
| bcn-ley-21357 | Ley 21.357 — Pueblos Indígenas | 1161743 | 2 articles (único + transitorio) | 1 claim |

**Note on afirmaciones.json:** 15 feriado claims have BCN sources. The 2 excluded claims are `feriadosEnClases` and `feriadosSinImpacto` (derived, no BCN source).

---

## Article Text Quality

BCN JSON `html` array items contain:
- **Useful content:** Article number in article text itself (e.g., "ARTICULO PRIMERO.-", "ART. 2°.-")
- **`estructura` array:** Maps article names to item IDs — use to identify which items are articles vs header/promulgation
- **HTML tags to strip:** `<div>`, `<span>`, `<a>` (footnote links), `<br>` — simple structure, `re.sub` sufficient
- **HTML entities:** `&nbsp;`, `&#xFA;` (ú), `&#xF3;` (ó), `&#xE1;` (á), etc. — use `html.unescape()`
- **Inline footnotes:** `<span class="n">LEY 4127 ART. 1°.-</span>` — these are interpolated modification markers. Strip them with HTML tag removal. They indicate the original text was modified.
- **Item with `v: ["MODIFICACION"]`:** The `v` field indicates the article was modified by another law. The text shown is the consolidated (current) version.

---

## Common Pitfalls

### Pitfall 1: BCN API Returns HTML SPA for All Routes
**What goes wrong:** Fetching `www.bcn.cl/leychile/servicios/exportar?idNorma=X&formato=xml` returns an HTML page, not XML.
**Why it happens:** BCN migrated to an Angular SPA around 2022-2024. All routes on `www.bcn.cl/leychile/` serve `index.html`.
**How to avoid:** Always use `https://nuevo.leychile.cl/servicios/Navegar/get_norma_json?idNorma=X`.
**Warning signs:** `Content-Type: text/html` in response, response starts with `<!doctype html>`.

### Pitfall 2: Wrong idNorma for Ley 20148
**What goes wrong:** `get_norma_json?idNorma=257742` returns HTTP 500.
**Why it happens:** `afirmaciones.json` stores the wrong norma ID for this law.
**How to avoid:** Use `257080` for bcn-ley-20148. Add a correction map at the top of the script.
**Warning signs:** HTTP 500 response from `nuevo.leychile.cl`.

### Pitfall 3: Claude Returns Non-JSON Response
**What goes wrong:** `json.loads(message.content[0].text)` fails with JSONDecodeError.
**Why it happens:** Claude may add preamble like "Here is the mapping:" before the JSON block.
**How to avoid:** Wrap the parse in try/except. Use a JSON extraction regex as fallback: `re.search(r'\{.*\}', text, re.DOTALL)`.
**Warning signs:** `json.JSONDecodeError` on Claude response.

### Pitfall 4: SHA256 Encoding Inconsistency
**What goes wrong:** Same text produces different hash on different runs.
**Why it happens:** SHA256 is computed on bytes — must encode text to UTF-8 first, and normalize whitespace consistently before hashing.
**How to avoid:** Always: `hashlib.sha256(normalized_text.encode('utf-8')).hexdigest()` where `normalized_text` is the output of `extract_article_text()` with consistent whitespace normalization.
**Warning signs:** False positives in change detection (Phase 9).

### Pitfall 5: Claude Identification Rate vs. Timeout
**What goes wrong:** Prompt with too many articles causes slow response or token limit issues.
**Why it happens:** Ley 2977 has the most articles (~4) and most claims (~11). Total token count is small but worth checking.
**How to avoid:** Batch by law (4 prompts total), not by individual claim. Keep `max_tokens=1024` which is sufficient for JSON mapping of 15 claims.
**Warning signs:** `anthropic.APITimeoutError` or response truncated mid-JSON.

### Pitfall 6: afirmaciones.json claims Array (Not Object)
**What goes wrong:** Iterating `afirmaciones['claims']` assuming it's a dict fails.
**Why it happens:** `claims` is a JSON array (`[...]`), not an object. Each element has an `id` field.
**How to avoid:** Iterate with `for claim in afirmaciones['claims']`, not `.items()`.

---

## Code Examples

### Complete Fetch + Parse Pattern
```python
#!/usr/bin/env python3
# Source: verified by live testing against BCN API 2026-03-25
import urllib.request
import urllib.error
import json
import re
import html as html_module
import hashlib
import os
import sys

BCN_API_BASE = 'https://nuevo.leychile.cl/servicios'

# Correction map for wrong idNorma values in afirmaciones.json
IDNORMA_CORRECTIONS = {
    'bcn-ley-20148': '257080',  # afirmaciones.json has 257742 (wrong)
}

def get_idnorma(afirmaciones, source_id):
    """Extract idNorma from afirmaciones.json api_endpoint, applying corrections."""
    if source_id in IDNORMA_CORRECTIONS:
        return IDNORMA_CORRECTIONS[source_id]
    source = afirmaciones.get('sources', {}).get(source_id, {})
    endpoint = source.get('api_endpoint', '')
    match = re.search(r'idNorma=(\d+)', endpoint)
    if not match:
        raise ValueError('No idNorma found for source {}'.format(source_id))
    return match.group(1)

def fetch_norma_json(id_norma, timeout=30):
    """Fetch law article JSON from BCN API."""
    url = '{}/Navegar/get_norma_json?idNorma={}'.format(BCN_API_BASE, id_norma)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        raise RuntimeError('BCN API error for idNorma={}: HTTP {}'.format(id_norma, e.code))
    except urllib.error.URLError as e:
        raise RuntimeError('BCN unreachable for idNorma={}: {}'.format(id_norma, e.reason))

def extract_articles(norma_data):
    """
    Extract article text from get_norma_json response.
    Returns list of {numero, item_id, texto} dicts.
    Only returns items identified as articles by estructura.
    """
    estructura = norma_data.get('estructura', [])
    html_items = {item['i']: item['t'] for item in norma_data.get('html', [])}

    articles = []
    for part in estructura:
        name = part.get('n', '')
        item_id = part.get('i')
        # Include only article parts (not Encabezado or Promulgación)
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
    """Strip HTML and normalize whitespace."""
    text = re.sub(r'<[^>]+>', ' ', html_string)
    text = html_module.unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def compute_hash(text):
    """SHA256 of UTF-8 encoded text."""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()
```

### Claude API Call Pattern
```python
# Source: anthropic SDK v0.71.0 + verified model name
import anthropic

def build_claude_client():
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        print('ERROR: ANTHROPIC_API_KEY not set.', file=sys.stderr)
        print('  Run: export ANTHROPIC_API_KEY=sk-ant-...', file=sys.stderr)
        sys.exit(1)
    return anthropic.Anthropic(api_key=api_key)

def identify_articles(client, ley_id, articles, claims):
    """
    Batch identify articles for all claims of a law in one API call.
    Returns dict: {data_key: {articulo_numero, inciso}} or {data_key: null}
    """
    articles_block = '\n'.join(
        '{}: {}'.format(a['numero'], a['texto'])
        for a in articles
    )
    claims_block = '\n'.join(
        '- {} | "{}" | hint: {}'.format(
            c['data_key'], c['claim'], c.get('source_reference', '')
        )
        for c in claims
    )
    prompt = (
        'Ley: {}\n\nArtículos:\n{}\n\nClaims a mapear:\n{}\n\n'
        'Responde SOLO con JSON válido. Para cada data_key indica '
        'articulo_numero e inciso (null si no aplica):\n'
        '{{"data_key": {{"articulo_numero": "PRIMERO", "inciso": "2"}}}}'
    ).format(ley_id, articles_block, claims_block)

    resp = client.messages.create(
        model='claude-haiku-4-5',
        max_tokens=1024,
        messages=[{'role': 'user', 'content': prompt}],
    )
    response_text = resp.content[0].text

    # Extract JSON even if Claude adds preamble
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise
```

### legal-articles.json Schema
```json
{
  "_meta": {
    "generated_at": "2026-03-25T12:00:00Z",
    "script_version": "1.0.0",
    "total_claims": 15
  },
  "feriado_ano_nuevo": {
    "ley_id": "bcn-ley-2977",
    "articulo_numero": "PRIMERO",
    "inciso": "2",
    "texto_verbatim": "ARTICULO PRIMERO.- Desde la fecha de la presente lei, solo se consideraran...",
    "hash_sha256": "abc123...",
    "last_checked": "2026-03-25T12:00:00Z",
    "texto_anterior": null
  },
  "feriado_virgen_carmen": {
    "ley_id": "bcn-ley-20148",
    "articulo_numero": "1",
    "inciso": null,
    "texto_verbatim": "Artículo 1°.- Declárase feriado el día 16 de julio de cada año...",
    "hash_sha256": "def456...",
    "last_checked": "2026-03-25T12:00:00Z",
    "texto_anterior": null
  }
}
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Python 3 | Script runtime | Yes | 3.12.10 (also 3.14.2) | — |
| `anthropic` SDK | Claude API calls | Yes | 0.71.0 | — |
| `ANTHROPIC_API_KEY` | Claude API auth | Runtime env var | N/A | Script exits with helpful message |
| `nuevo.leychile.cl` | Fetch law text | Yes — tested live | — | No fallback; exit code 1 |
| `pip3` | (install if needed) | Yes | 25.3 | — |

**No blocking dependencies missing.** The script needs no `pip install` steps — the Anthropic SDK is already installed. BCN API is reachable.

**`python` vs `python3`:** Both `python3` (3.14.2) and `python` (3.12.10) are available. The `anthropic` SDK is installed under `python` / `python3.12`. Use `#!/usr/bin/env python3` (which resolves to 3.14.2) — but test that the SDK import works. If it fails, use `python` explicitly. The `pip3` version confirms SDK is under `python3.12`.

**Practical note:** Run the script as `python scripts/bcn-extractor.py` (not `python3`) to ensure it uses the Python installation where the SDK is installed (3.12.10).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BCN served XML via `/servicios/exportar?idNorma=X&formato=xml` | BCN SPA serves HTML; actual data via `nuevo.leychile.cl/servicios/Navegar/get_norma_json?idNorma=X` (JSON) | ~2022-2024 migration | **afirmaciones.json api_endpoint is now only useful for extracting idNorma** |
| Parse XML with ElementTree | Parse JSON article array | Current | Simpler — no XML parsing needed |

**Deprecated/outdated:**
- `www.bcn.cl/leychile/servicios/exportar?...`: Serves Angular SPA, not data
- `idNorma=257742` for Ley 20148: Wrong value, use `257080`

---

## Open Questions

1. **Should afirmaciones.json be fixed as part of this phase?**
   - What we know: `bcn-ley-20148` has `idNorma=257742` (wrong) and `api_endpoint` URLs are now obsolete as direct endpoints
   - What's unclear: Whether the plan should patch `afirmaciones.json` or just handle the correction internally in the script
   - Recommendation: Fix `afirmaciones.json` in Wave 0 (change `api_endpoint` idNorma for bcn-ley-20148 from 257742 to 257080) — keeps source of truth accurate for Phase 9 which also reads this file

2. **Python version to use in shebang**
   - What we know: `python3` resolves to 3.14.2; SDK installed under 3.12.10 (via `pip3`)
   - What's unclear: Does 3.14.2 find the SDK? (Cross-version pip installs don't share packages by default)
   - Recommendation: Task 1 should verify with `python3 -c "import anthropic"` and use `python` if `python3` fails. If needed, reinstall SDK: `pip install anthropic`.

3. **Rate limits on BCN API**
   - What we know: The API is public, no auth required, returns JSON successfully for the tested laws
   - What's unclear: Whether rapid sequential calls (4 in a row) trigger rate limiting
   - Recommendation: Add a small delay between requests (0.5–1 second) as a precaution

---

## Sources

### Primary (HIGH confidence)
- Live BCN API testing (2026-03-25): `nuevo.leychile.cl/servicios/Navegar/get_norma_json` returns structured JSON for idNorma 23639, 160270, 257080, 1161743
- BCN SPA bundle analysis (`main.f2d5f913295c408af980.bundle.js`): confirms `u: "https://nuevo.leychile.cl/servicios"` as backend base URL
- `pip show anthropic` output: SDK v0.71.0 installed, `claude-haiku-4-5` in `model_param.py` valid model list

### Secondary (MEDIUM confidence)
- BCN `buscarjson` search API: confirmed IDNORMA=257080 for "Ley 20148"
- Live HTML export test (`nuevo.leychile.cl/servicios/Consulta/Exportar?formato=html`): returns HTML but with empty content (article text commented out — only PDF is populated, and even PDF returns 0 bytes for some normas)

### Tertiary (LOW confidence)
- None — all critical claims verified by live testing

---

## Metadata

**Confidence breakdown:**
- BCN API endpoint discovery: HIGH — verified by live HTTP testing and JS bundle analysis
- idNorma correction for ley-20148: HIGH — verified via buscarjson search + successful get_norma_json fetch
- Anthropic SDK usage pattern: HIGH — SDK v0.71.0 installed, model name verified in type definitions
- Article text parsing: HIGH — inspected live JSON responses for all 4 laws
- afirmaciones.json data structure: HIGH — read the file directly

**Research date:** 2026-03-25
**Valid until:** 2026-06-25 (BCN API is stable but could change; Anthropic SDK model names are stable)
