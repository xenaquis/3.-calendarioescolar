# Phase 8: BCN Legal Extractor - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Script Python (`scripts/bcn-extractor.py`) que descarga el XML de BCN.cl para las 4 leyes de feriado, extrae todos sus artículos, usa Claude API para identificar qué artículos respaldan cada claim `feriado-*`, y guarda el resultado verbatim en `data/legal-articles.json` con hash SHA256, `last_checked`, y `texto_anterior` cuando hay cambio. 15 claims feriado elegibles (excluye 2 derivados sin fuente BCN). Corre una vez como setup; idempotente para re-ejecuciones.

</domain>

<decisions>
## Implementation Decisions

### Script Architecture
- Script único `scripts/bcn-extractor.py` — fases secuenciales: fetch XML → parse artículos → identificar con Claude → guardar JSON
- HTTP via `urllib.request` (stdlib, sin dependencias adicionales)
- Idempotente: actualiza solo si hash SHA256 cambia respecto al guardado; preserva `texto_anterior` cuando hay cambio
- Output file: `data/legal-articles.json` (nombre exacto del spec)

### Claude API Integration
- Modelo: `claude-haiku-4-5` (económico, suficiente para tarea estructurada de identificación)
- Prompting batch por ley: un prompt que recibe todos los artículos de la ley + todos los claims feriado de esa ley → Claude devuelve mapping `claim_data_key → [articulo_numero, inciso]`
- Re-identificación: solo si el campo `articulo_numero` está vacío/null — preserva trabajo anterior
- Si Claude no puede identificar: guardar `articulo_numero: null, status: "unidentified"` — logging para revisión manual

### Estructura de legal-articles.json
- Clave primaria: por `data_key` (e.g., `feriado_viernes_santo`) — mismo key que usa el frontend
- Campos por entry: `ley_id, articulo_numero, inciso, texto_verbatim, hash_sha256, last_checked, texto_anterior`
- Claims derivados (`feriadosEnClases`, `feriadosSinImpacto`) excluidos — no tienen fuente BCN
- Metadatos globales: `_meta: {generated_at, script_version, total_claims}`

### Error Handling
- Si BCN.cl no responde: exit code 1 con mensaje claro — es script de setup, usuario reintenta
- Si ANTHROPIC_API_KEY falta: exit code 1 con instrucciones claras (`export ANTHROPIC_API_KEY=...`)
- Timeout HTTP: 30 segundos con mensaje de error descriptivo

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `data/afirmaciones.json` — 17 claims feriado; 15 con fuente BCN (bcn-ley-2977, bcn-ley-19668, bcn-ley-20148, bcn-ley-21357); 2 derivados sin fuente
- `data/afirmaciones.json → sources` — ya tiene `api_endpoint` para las 4 leyes BCN con formato `https://www.bcn.cl/leychile/servicios/exportar?idNorma=XXXXX&formato=xml`
- `scripts/pdf-to-png.py` — ejemplo de script Python en este proyecto (PyMuPDF, argparse, JSON output)

### Established Patterns
- Scripts Python en `scripts/` con shebang `#!/usr/bin/env python3`
- Datos en `data/` como JSON plano
- ANTHROPIC_API_KEY como variable de entorno (patrón ya usado en scripts de extracción visual)
- JSON files con `_meta` block para trazabilidad (ver afirmaciones.json → `_meta`)

### Integration Points
- Input: `data/afirmaciones.json` (lee claims feriado y api_endpoint de cada ley)
- Output: `data/legal-articles.json` (nuevo archivo, consumido por Phase 9 check-bcn-changes.py)
- Phase 9 depende de los campos `hash_sha256` y `last_checked` de este JSON
- Phase 10 depende del campo `texto_verbatim` para el tooltip CSS

</code_context>

<specifics>
## Specific Ideas

- Los 4 `api_endpoint` de BCN ya están en `afirmaciones.json → sources` — el script debe leerlos desde ahí, no hardcodearlos
- La estructura de claims en afirmaciones.json usa array (no objeto) — el script debe iterar el array y filtrar por `id.startsWith('feriado')` AND `source_id` que empiece con `bcn-`
- El campo `source_reference` existente en afirmaciones.json (e.g., "Art. 1 — Viernes Santo") puede usarse como hint en el prompt de Claude para validar la identificación

</specifics>

<deferred>
## Deferred Ideas

- Ninguna — la discusión se mantuvo dentro del scope de la fase

</deferred>
