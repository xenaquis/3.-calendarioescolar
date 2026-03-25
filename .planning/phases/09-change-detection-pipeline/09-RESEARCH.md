# Phase 9: Change Detection Pipeline - Research

**Researched:** 2026-03-25
**Domain:** Python scripting + GitHub REST API + GitHub Actions + DeepSeek API
**Confidence:** HIGH

## Summary

Phase 9 builds a cron-driven pipeline that compares live BCN.cl article hashes against the stored hashes in `data/legal-articles.json`, evaluates any diffs via DeepSeek, and creates a consolidated GitHub Issue for the team when legal text has changed. All technology involved is already in use in Phase 8 (`bcn-extractor.py`), so Phase 9 is primarily integration work rather than research.

The new Python script `scripts/check-bcn-changes.py` can import helper functions directly from `bcn-extractor.py` using stdlib `importlib` (or simple relative import via `sys.path`). The GitHub Issue is created via a single `urllib.request.urlopen` POST to `https://api.github.com/repos/{owner}/{repo}/issues` using `secrets.GITHUB_TOKEN` — no PyGitHub library needed. The GitHub Action mirrors the established `sync-deploy.yml` pattern almost verbatim, adding only `issues: write` to the permissions block.

**Primary recommendation:** Implement `check-bcn-changes.py` as a standalone script that sources helpers from `bcn-extractor.py` via `sys.path` injection, makes all external calls (BCN fetch, DeepSeek, GitHub API) through `urllib.request`, and treats BCN unavailability as a silent skip (no `last_checked` update, exit 0).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- API de evaluacion de impacto: DeepSeek (consistente con Phase 8), modelo `deepseek-chat`
- Variables de entorno del Action: solo `DEEPSEEK_API_KEY` + `GH_TOKEN` (as secrets)
- Cron schedule: lunes 06:00 UTC (`0 6 * * 1`) — igual que sync-deploy.yml existente
- Issue incluye: diff de texto (antes/after) + estado IA (`sin_impacto|requiere_revision|actualizar`) + claims afectados + recomendacion
- Labels: `bcn-change`, `legal-review`
- Si BCN esta caido: fallo silencioso (log de error, no crear Issue de error)
- Si hay error de red: no actualizar `last_checked` (preservar timestamp del ultimo chequeo exitoso)

### Claude's Discretion
- Estructura interna del script (clases vs funciones, orden de operaciones)
- Formato exacto del markdown del Issue (mientras incluya los 4 componentes requeridos)
- Manejo de multiples cambios simultaneos — preferir un Issue consolidado

### Deferred Ideas (OUT OF SCOPE)
- Dashboard web de estado de verificacion legal (Phase 10 o posterior)
- Notificacion por email ademas del GitHub Issue (fuera de alcance v1.2)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHNG-01 | `scripts/check-bcn-changes.py` compara hash actual BCN vs hash en `legal-articles.json` | fetch_norma_json + extract_articles + compute_hash reused from bcn-extractor.py via sys.path injection |
| CHNG-02 | Si hay cambio, llama DeepSeek API para evaluar impacto (`sin_impacto\|requiere_revision\|actualizar`) | DeepSeek OpenAI-compatible pattern already in bcn-extractor.py; new prompt for impact evaluation |
| CHNG-03 | Si hay cambio, crea GitHub Issue con diff, evaluacion IA, claims afectados, recomendacion | GitHub REST API POST /repos/{owner}/{repo}/issues with Bearer token via urllib.request |
| CHNG-04 | `last_checked` se actualiza en cada corrida exitosa independientemente de si hay cambio | Write-back to legal-articles.json on successful BCN fetch; skip write-back on BCN error |
| CHNG-05 | GitHub Action ejecuta `check-bcn-changes.py` en cron semanal + workflow_dispatch | Mirrors sync-deploy.yml pattern; needs issues: write permission; uses setup-python step |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Scripts Python: stdlib-first (`urllib`, `json`, `hashlib`, `argparse`) — import openai dentro de funcion para permitir --dry-run sin SDK
- No agregar dependencias npm; no ES modules; no bundlers (no aplica directamente a Python pero confirma filosofia minimalista)
- Scripts deben vivir en `scripts/` — ruta correcta para `check-bcn-changes.py`
- GitHub Action en `.github/workflows/` — ruta correcta para `check-bcn-changes.yml`
- No poner API keys en codigo — usar secrets del Action (`DEEPSEEK_API_KEY`, `GH_TOKEN`)
- No crear archivos fuera de `public/`, `data/`, `functions/`, `scripts/`, `validacion/` — el script Python esta en `scripts/`, el workflow en `.github/workflows/` (directorio ya existente, no es nuevo)

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python stdlib (urllib, json, hashlib, sys, os, argparse, datetime) | 3.14.2 (env) / 3.x (Actions ubuntu-latest) | BCN fetch, JSON read/write, hash comparison, CLI args | Already established in bcn-extractor.py; zero dependencies |
| openai SDK | 2.20.0 (env) | DeepSeek API calls (OpenAI-compatible) | Already in use in Phase 8; imported lazily inside function |
| GitHub REST API v2022-11-28 | — | Create Issues | No library needed; single urllib POST |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| actions/checkout@v4 | v4 | Checkout repo in Action | Standard — already used in all workflows |
| actions/setup-python@v5 | v5 | Install Python + openai SDK in Action | Needed to run bcn-extractor / check-bcn-changes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| urllib.request for GitHub API | PyGitHub library | PyGitHub requires pip install; urllib.request is stdlib and sufficient for a single POST |
| importlib / sys.path for sharing functions | Duplicating functions in new script | Duplication creates maintenance burden; sys.path injection is stdlib and clean |
| Consolidated single Issue | One Issue per changed claim | Consolidated reduces noise; context.md explicitly prefers consolidated |

**Installation (GitHub Action step):**
```yaml
- name: Setup Python
  uses: actions/setup-python@v5
  with:
    python-version: '3.x'

- name: Install dependencies
  run: pip install openai
```

## Architecture Patterns

### Recommended File Layout
```
scripts/
  bcn-extractor.py          # Phase 8 — functions reused via sys.path
  check-bcn-changes.py      # Phase 9 — new script
data/
  legal-articles.json       # Read (stored hashes) + Write (last_checked, texto_anterior)
  afirmaciones.json         # Read-only — maps data_key -> source_id for claim lookup
.github/workflows/
  check-bcn-changes.yml     # Phase 9 — new workflow
```

### Pattern 1: Import helpers from bcn-extractor.py via sys.path

The new script shares `fetch_norma_json`, `extract_articles`, `extract_text`, `compute_hash`, `get_feriado_claims`, `get_idnorma`, and `find_article_text` without duplicating them.

**What:** Inject the `scripts/` directory into `sys.path`, then import the module.
**When to use:** Any time two scripts share pure functions and no external install is possible.

```python
# Source: established Python stdlib pattern
import sys
import os

# Add scripts/ dir to path so we can import from bcn-extractor.py
_scripts_dir = os.path.dirname(os.path.abspath(__file__))
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)

# Python does not allow hyphens in identifiers — use importlib
import importlib
bcn = importlib.import_module('bcn-extractor')

# Now use: bcn.fetch_norma_json(), bcn.compute_hash(), bcn.get_feriado_claims(), etc.
```

**Why importlib and not a direct import:** Python module names cannot contain hyphens as bare identifiers, so `import bcn-extractor` is a SyntaxError. `importlib.import_module('bcn-extractor')` handles this correctly.

### Pattern 2: Create GitHub Issue via urllib.request

**What:** Single POST to GitHub REST API using stdlib only.
**When to use:** Any Python script running in GitHub Actions that needs to open an Issue.

```python
# Source: https://docs.github.com/en/rest/issues/issues#create-an-issue
import urllib.request
import json
import os

def create_github_issue(title, body, labels):
    """Create a GitHub Issue using GH_TOKEN from environment."""
    gh_token = os.environ.get('GH_TOKEN')
    if not gh_token:
        raise RuntimeError('GH_TOKEN no esta configurada')

    # GITHUB_REPOSITORY is a default Actions env var: "owner/repo"
    repo = os.environ.get('GITHUB_REPOSITORY')
    if not repo:
        raise RuntimeError('GITHUB_REPOSITORY no disponible (se ejecuta fuera de Actions?)')

    url = 'https://api.github.com/repos/{}/issues'.format(repo)
    payload = json.dumps({
        'title': title,
        'body': body,
        'labels': labels,
    }).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            'Authorization': 'Bearer {}'.format(gh_token),
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
        method='POST',
    )
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read().decode('utf-8'))
        return result.get('html_url', '(issue created)')
    except urllib.error.HTTPError as e:
        body_text = e.read().decode('utf-8', errors='replace')
        raise RuntimeError('GitHub API error {}: {}'.format(e.code, body_text))
```

### Pattern 3: DeepSeek impact evaluation prompt

**What:** Send changed text (before + after) to DeepSeek and get one of three states.
**When to use:** When a hash mismatch is detected for a claim.

```python
# Source: bcn-extractor.py identify_articles() pattern, adapted for impact evaluation
def evaluate_impact(client, data_key, claim_text, texto_anterior, texto_nuevo):
    """
    Evalua si el cambio en el articulo legal afecta el claim vinculado.
    Returns: 'sin_impacto' | 'requiere_revision' | 'actualizar'
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
    # Normalize — accept partial match for robustness
    if 'actualizar' in raw:
        return 'actualizar'
    if 'requiere_revision' in raw or 'revision' in raw:
        return 'requiere_revision'
    return 'sin_impacto'
```

**Note on max_tokens=16:** The expected response is a single word (longest is `requiere_revision` = 16 chars). Setting max_tokens low reduces cost and forces the model to not pad the answer.

### Pattern 4: GitHub Action structure for check-bcn-changes.yml

```yaml
# Source: .github/workflows/sync-deploy.yml (established project pattern)
name: Check BCN Legal Changes

on:
  schedule:
    - cron: '0 6 * * 1'    # Lunes 06:00 UTC
  workflow_dispatch:         # Manual trigger for testing

jobs:
  check-changes:
    name: Detectar cambios en articulos BCN
    runs-on: ubuntu-latest
    permissions:
      contents: write        # Para commitear last_checked a legal-articles.json
      issues: write          # Para crear GitHub Issues

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.x'

      - name: Install dependencies
        run: pip install openai

      - name: Check BCN for changes
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: python scripts/check-bcn-changes.py

      - name: Commit updated last_checked
        if: always()
        run: |
          git config user.name "calendarioescolar-bot"
          git config user.email "bot@calendarioescolar.cl"
          git add data/legal-articles.json
          git diff --staged --quiet || git commit -m "chore: update legal-articles last_checked [skip ci]"
          git push origin ${{ github.ref_name }}
```

**Key difference from sync-deploy.yml:** Needs `issues: write` permission in addition to `contents: write`.

### Pattern 5: Diff comparison using legal-articles.json fields

The diff for the Issue body is straightforward: compare `hash_sha256` (stored) vs hash of freshly fetched `texto_verbatim`. When they differ, `texto_anterior` holds the old text (if previously populated) or is `null` for first-time changes.

```python
# Reading the diff inputs from legal-articles.json
stored_entry = legal_articles.get(data_key, {})
stored_hash = stored_entry.get('hash_sha256')
stored_texto = stored_entry.get('texto_verbatim')   # previous verbatim (shown as "antes")

# After fetching from BCN:
new_texto = find_article_text(articles, stored_entry.get('articulo_numero'))
new_hash = compute_hash(new_texto)

if stored_hash and new_hash != stored_hash:
    # Change detected — stored_texto is "antes", new_texto is "despues"
    # texto_anterior may be None on first change (no prior diff stored)
    pass
```

**Important:** `texto_anterior` in the JSON stores the text from the PREVIOUS run (i.e., it is set when a change is first detected). On the very first change, `texto_anterior` will be `null` — the diff should use `stored_texto` (the current `texto_verbatim`) as "antes" and the newly fetched text as "despues".

### Pattern 6: Mapping data_key to claim text via afirmaciones.json

The claim text for the DeepSeek prompt and Issue body comes from `afirmaciones.json`:

```python
# afirmaciones.json structure: {"claims": [{"id": "...", "data_key": "...", "claim": "...", ...}]}
# Build a lookup dict for fast access
claims_by_key = {c['data_key']: c for c in afirmaciones.get('claims', [])}
claim_obj = claims_by_key.get(data_key, {})
claim_text = claim_obj.get('claim', '(sin claim registrado)')
```

### Anti-Patterns to Avoid

- **Updating `last_checked` on BCN error:** If BCN is down, `last_checked` must NOT be updated. The preserved timestamp lets the team know the last time BCN was actually reachable.
- **Creating an error-state Issue when BCN is down:** The locked decision is silent failure — log to stderr, exit 0, skip all writes.
- **One Issue per changed claim:** Consolidate all changes into a single Issue. Multiple claims from the same law often change together (same article), so separate Issues would be redundant noise.
- **Importing bcn-extractor with `import bcn-extractor`:** This is a SyntaxError. Use `importlib.import_module('bcn-extractor')`.
- **Using `${{ secrets.GITHUB_TOKEN }}` as the env var name in script:** The Python script reads `GH_TOKEN` from the environment. The Action maps `GH_TOKEN: ${{ secrets.GH_TOKEN }}` (or `secrets.GITHUB_TOKEN`). These are different names — the env var name in the script must match the Action's `env:` block.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fetching BCN articles | Custom parser | `bcn.fetch_norma_json()` + `bcn.extract_articles()` from Phase 8 | Already handles HTML strip, entity unescape, ordinal matching |
| SHA256 hashing | Custom hash | `bcn.compute_hash()` from Phase 8 | Ensures identical hashing logic between extractor and checker |
| DeepSeek client setup | New client init | `bcn.build_ai_client()` or inline equivalent | Established pattern with lazy import |
| GitHub API HTTP call | Third-party library | `urllib.request` with Bearer header | Single POST — no library worth the dependency |

**Key insight:** 80% of the logic for `check-bcn-changes.py` already exists in `bcn-extractor.py`. The new script is mostly orchestration: detect change → evaluate → create Issue → write-back.

## Common Pitfalls

### Pitfall 1: GITHUB_REPOSITORY not set when testing locally
**What goes wrong:** Script crashes with `RuntimeError: GITHUB_REPOSITORY no disponible` when run outside GitHub Actions.
**Why it happens:** `GITHUB_REPOSITORY` is a GitHub Actions default env var; it does not exist in a local shell.
**How to avoid:** Add a `--dry-run` flag that skips the GitHub Issue creation step. For local testing, set `export GITHUB_REPOSITORY=owner/repo` manually.
**Warning signs:** `KeyError` or `None` when reading `os.environ.get('GITHUB_REPOSITORY')`.

### Pitfall 2: GH_TOKEN vs GITHUB_TOKEN naming confusion
**What goes wrong:** The Action uses `secrets.GH_TOKEN` but the Python script reads `GITHUB_TOKEN`, or vice versa. Issue creation silently fails with 401.
**Why it happens:** The project context uses `GH_TOKEN` as the secret name (matching the locked decision). The auto-token is `secrets.GITHUB_TOKEN`. These are different unless the repo also has a `GH_TOKEN` secret defined as a PAT.
**How to avoid:** In the Action `env:` block use `GH_TOKEN: ${{ secrets.GH_TOKEN }}`. The Python script reads `os.environ.get('GH_TOKEN')`. Be consistent — never mix names.
**Warning signs:** HTTP 401 from GitHub API; empty `GH_TOKEN` in script.

### Pitfall 3: Missing `issues: write` permission
**What goes wrong:** GitHub Action fails with HTTP 403 when creating the Issue, even with a valid token.
**Why it happens:** By default, GITHUB_TOKEN does not have `issues: write`. It must be explicitly declared in the `permissions:` block of the job.
**How to avoid:** Add `issues: write` to the job's `permissions:` block (see Pattern 4 above).
**Warning signs:** HTTP 403 response from `POST /repos/{owner}/{repo}/issues`.

### Pitfall 4: Labels not pre-created cause silent 422
**What goes wrong:** Issue is created without labels even though labels were specified in the API payload.
**Why it happens:** If labels `bcn-change` and `legal-review` do not exist in the repo, GitHub silently drops them (or returns 422 on some API versions).
**How to avoid:** Create the labels in the GitHub repo before first run. Document this as a setup step in the plan. Alternatively, use the GitHub Labels API to create them if missing (add a Wave 0 task for label setup).
**Warning signs:** Issue created with no labels; no error returned.

### Pitfall 5: BCN fetch returns stale cache or HTTP 200 with error body
**What goes wrong:** `fetch_norma_json()` returns HTTP 200 but the body contains an error object (BCN sometimes wraps errors in 200 responses).
**Why it happens:** BCN's SPA backend (`nuevo.leychile.cl`) has been observed returning `{"error": "..."}` or empty `estructura` on some idNorma values.
**How to avoid:** After calling `extract_articles()`, check `if not articles:` and treat as a BCN unavailability (silent skip, no update).
**Warning signs:** `articles` list is empty for a law that previously had articles; `new_texto` is `None` after `find_article_text()`.

### Pitfall 6: `texto_anterior` is null on first-ever change
**What goes wrong:** Issue body shows `(no disponible)` for the "antes" section, which looks like a bug.
**Why it happens:** `texto_anterior` is only populated from the second change onwards. The first change has `texto_anterior: null` but `texto_verbatim` contains the previous text.
**How to avoid:** In the diff section of the Issue, use `stored_entry.get('texto_verbatim')` (the current stored text before overwrite) as "antes", not `stored_entry.get('texto_anterior')`. Only use `texto_anterior` for historical diffs in subsequent changes.
**Warning signs:** "antes" section of Issue body is empty or "(no disponible)" even though there was a prior recorded text.

### Pitfall 7: Committing legal-articles.json triggers deploy.yml
**What goes wrong:** `[skip ci]` is omitted from the commit message, causing `deploy.yml` to trigger a full site rebuild unnecessarily.
**Why it happens:** `deploy.yml` triggers on any push to main.
**How to avoid:** Always include `[skip ci]` in the commit message when committing `legal-articles.json` updates. Already established pattern in `sync-deploy.yml`.
**Warning signs:** deploy.yml running right after check-bcn-changes.yml commits.

## Code Examples

Verified patterns from existing codebase and official sources:

### Full urllib POST to GitHub Issues API
```python
# Source: https://docs.github.com/en/rest/issues/issues#create-an-issue
import urllib.request, urllib.error, json, os

def create_github_issue(title, body, labels=None):
    gh_token = os.environ.get('GH_TOKEN')
    repo = os.environ.get('GITHUB_REPOSITORY')  # "owner/repo" — default Actions env var
    url = 'https://api.github.com/repos/{}/issues'.format(repo)
    payload = json.dumps({
        'title': title,
        'body': body,
        'labels': labels or [],
    }).encode('utf-8')
    req = urllib.request.Request(
        url, data=payload, method='POST',
        headers={
            'Authorization': 'Bearer {}'.format(gh_token),
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    )
    resp = urllib.request.urlopen(req, timeout=30)
    return json.loads(resp.read().decode('utf-8')).get('html_url')
```

### Importing bcn-extractor functions
```python
# Source: Python stdlib importlib — handles hyphenated module names
import sys, os, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
bcn = importlib.import_module('bcn-extractor')
# Available: bcn.fetch_norma_json, bcn.extract_articles, bcn.compute_hash,
#            bcn.get_feriado_claims, bcn.get_idnorma, bcn.find_article_text,
#            bcn.build_ai_client, bcn.IDNORMA_CORRECTIONS
```

### Detecting changed hashes and building consolidated diff
```python
# Source: data/legal-articles.json structure (Phase 8 output)
changes = []
for data_key, stored in legal_articles.items():
    if data_key == '_meta':
        continue
    stored_hash = stored.get('hash_sha256')
    if not stored_hash:
        continue  # unidentified claim, skip
    id_norma = bcn.get_idnorma(afirmaciones, stored['ley_id'])
    try:
        norma_data = bcn.fetch_norma_json(id_norma)
    except RuntimeError as e:
        print('BCN unavailable for {}: {}'.format(data_key, e), file=sys.stderr)
        bcn_available = False
        break  # stop processing, do not update last_checked
    articles = bcn.extract_articles(norma_data)
    new_texto = bcn.find_article_text(articles, stored.get('articulo_numero'))
    if new_texto is None:
        continue  # treat as BCN partial error
    new_hash = bcn.compute_hash(new_texto)
    if new_hash != stored_hash:
        changes.append({
            'data_key': data_key,
            'texto_antes': stored.get('texto_verbatim'),
            'texto_despues': new_texto,
            'new_hash': new_hash,
        })
```

### GitHub Issue markdown body (consolidated)
```python
# Consolidated Issue body — 4 required components per CONTEXT.md
def build_issue_body(changes, evaluations, claims_by_key):
    lines = ['## Cambios detectados en articulos BCN\n']
    lines.append('**Fecha de deteccion:** {}\n'.format(
        datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    ))
    for ch in changes:
        dk = ch['data_key']
        claim_text = claims_by_key.get(dk, {}).get('claim', '(sin claim)')
        estado = evaluations.get(dk, 'requiere_revision')
        lines.append('\n---\n')
        lines.append('### Claim afectado: `{}`\n'.format(dk))
        lines.append('**Afirmacion del sitio:** {}\n'.format(claim_text))
        lines.append('**Evaluacion IA:** `{}`\n'.format(estado))
        lines.append('**Texto anterior:**\n```\n{}\n```\n'.format(
            ch['texto_antes'] or '(sin registro previo)'
        ))
        lines.append('**Texto actual:**\n```\n{}\n```\n'.format(ch['texto_despues']))
        recomendacion = {
            'sin_impacto': 'Sin accion requerida. Verificar igualmente en siguiente ciclo.',
            'requiere_revision': 'Revisar manualmente si el claim sigue siendo correcto.',
            'actualizar': 'ACTUALIZAR el claim — el texto legal ha cambiado sustantivamente.',
        }.get(estado, 'Revisar manualmente.')
        lines.append('**Recomendacion:** {}\n'.format(recomendacion))
    return ''.join(lines)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BCN XML API (`www.bcn.cl/leychile/servicios/exportar?formato=xml`) | BCN JSON API (`nuevo.leychile.cl/servicios/Navegar/get_norma_json`) | ~2022 (SPA migration) | XML endpoint still exists but unreliable; JSON is the stable path — already handled in bcn-extractor.py |
| `Authorization: token XYZ` header | `Authorization: Bearer XYZ` | GitHub API 2022 | Both work but `Bearer` is the documented current form |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.x | check-bcn-changes.py | Yes | 3.14.2 (local) / 3.x (ubuntu-latest) | — |
| openai SDK | DeepSeek API calls | Yes | 2.20.0 (local) | pip install openai in Action |
| urllib (stdlib) | BCN fetch + GitHub API | Yes | stdlib | — |
| DEEPSEEK_API_KEY | AI impact evaluation | Must be set as repo secret | — | No fallback — required |
| GH_TOKEN | GitHub Issue creation | Must be set as repo secret | — | Can use auto GITHUB_TOKEN with issues:write |
| GitHub labels: bcn-change, legal-review | Issue labeling | Must be created in repo | — | Silent drop if missing (no error) |

**Missing dependencies with no fallback:**
- `DEEPSEEK_API_KEY` as a GitHub Actions secret — must be set before workflow runs
- `GH_TOKEN` as a GitHub Actions secret (or use `GITHUB_TOKEN` auto-token with `issues: write` permission)

**Missing dependencies with fallback:**
- GitHub labels `bcn-change` and `legal-review`: if not created, Issues are created without labels (functional but untagged). Create labels as a Wave 0 task.

## Open Questions

1. **GH_TOKEN: PAT or auto-token?**
   - What we know: CONTEXT.md says "GH_TOKEN" as a secret. The auto-token is `secrets.GITHUB_TOKEN`. A PAT stored as `secrets.GH_TOKEN` is also valid.
   - What's unclear: Whether the repo already has a `GH_TOKEN` secret defined as a PAT, or whether to use `GITHUB_TOKEN` with `issues: write`.
   - Recommendation: In the Action, map `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` and declare `issues: write` in permissions. This avoids needing a separate PAT. The Python script reads `GH_TOKEN` regardless.

2. **Label pre-creation**
   - What we know: GitHub silently drops labels that don't exist when creating Issues.
   - What's unclear: Whether `bcn-change` and `legal-review` labels already exist in the repo.
   - Recommendation: Include label creation (via GitHub UI or API) as a Wave 0 task in the plan.

## Sources

### Primary (HIGH confidence)
- `scripts/bcn-extractor.py` — functions to reuse: `fetch_norma_json`, `extract_articles`, `extract_text`, `compute_hash`, `get_feriado_claims`, `get_idnorma`, `find_article_text`, `build_ai_client`
- `data/legal-articles.json` — exact field structure confirmed: `hash_sha256`, `texto_verbatim`, `texto_anterior`, `last_checked`, `ley_id`, `articulo_numero`
- `data/afirmaciones.json` — `claims[].data_key` + `claims[].claim` + `claims[].source_id` structure confirmed
- `.github/workflows/sync-deploy.yml` — Action YAML pattern (checkout, setup-node, env, git commit) directly adapted
- `.github/workflows/check-sources.yml` — confirms `git config user.name "github-actions[bot]"` and `[skip ci]` patterns
- [GitHub REST API — Create an Issue](https://docs.github.com/en/rest/issues/issues#create-an-issue) — endpoint, headers, payload confirmed
- [GitHub Actions — GITHUB_REPOSITORY variable](https://docs.github.com/en/actions/reference/workflows-and-actions/variables) — confirmed format `owner/repo`
- [GitHub Actions — GITHUB_API_URL](https://docs.github.com/en/actions/reference/workflows-and-actions/variables) — confirmed as `https://api.github.com`
- [GitHub Actions — authenticate with GITHUB_TOKEN](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token) — confirmed `issues: write` required, exact curl example verified

### Secondary (MEDIUM confidence)
- Python `importlib.import_module()` for hyphenated module names — standard Python behavior, verified against Python docs pattern

### Tertiary (LOW confidence)
- GitHub label silent-drop behavior on 422 — based on known GitHub API behavior, not directly verified in current docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools already in use in Phase 8 or existing workflows
- Architecture: HIGH — direct extension of Phase 8 patterns; GitHub API endpoint verified
- Pitfalls: HIGH for items 1-4 (verified); MEDIUM for items 5-7 (inferred from known behavior)

**Research date:** 2026-03-25
**Valid until:** 2026-06-25 (stable APIs; GitHub Actions env vars and REST API are very stable)
