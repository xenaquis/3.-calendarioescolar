# Phase 9: Change Detection Pipeline - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Crear el pipeline automático que detecta cambios en articulado BCN y alerta al equipo. Incluye:
- `scripts/check-bcn-changes.py`: compara hashes BCN actuales vs `legal-articles.json`, llama DeepSeek para evaluar impacto, crea GitHub Issue si hay cambio
- `.github/workflows/check-bcn-changes.yml`: GitHub Action con cron semanal + workflow_dispatch
- Actualización de `last_checked` en `legal-articles.json` después de cada corrida exitosa

</domain>

<decisions>
## Implementation Decisions

### AI y Configuración del Pipeline
- API de evaluación de impacto: DeepSeek (consistente con Phase 8), modelo `deepseek-chat`
- Variables de entorno del Action: solo `DEEPSEEK_API_KEY` + `GH_TOKEN` como secrets
- Cron schedule: lunes 06:00 UTC (`0 6 * * 1`) — igual que sync-deploy.yml existente

### Comportamiento del GitHub Issue
- Issue incluye: diff de texto (antes/after) + estado IA (`sin_impacto|requiere_revision|actualizar`) + claims afectados + recomendación
- Labels: `bcn-change`, `legal-review`
- Si BCN está caído: fallo silencioso (log de error, no crear Issue de error)
- Si hay error de red: no actualizar `last_checked` (preservar timestamp del último chequeo exitoso)

### Claude's Discretion
- Estructura interna del script (clases vs funciones, orden de operaciones)
- Formato exacto del markdown del Issue (mientras incluya los 4 componentes requeridos)
- Manejo de múltiples cambios simultáneos (un Issue por cambio o uno consolidado — preferir consolidado)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/bcn-extractor.py` — fetch_norma_json(), extract_articles(), extract_text(), compute_hash(), get_feriado_claims(), get_idnorma() — reutilizar todos
- `data/legal-articles.json` — fuente de verdad de hashes actuales, actualizar `last_checked` al final
- `data/afirmaciones.json` — claims con source_id para mapear data_key → ley

### Established Patterns
- DeepSeek via openai SDK: `openai.OpenAI(api_key=..., base_url='https://api.deepseek.com/v1')`, model='deepseek-chat'
- DEEPSEEK_API_KEY env var (no ANTHROPIC_API_KEY)
- GitHub Action pattern: ver `.github/workflows/sync-deploy.yml` para estructura (schedule + workflow_dispatch, secrets.GH_TOKEN)
- Script Python stdlib-first: urllib, json, hashlib, argparse — import openai dentro de función

### Integration Points
- Lee `data/legal-articles.json` (hash almacenado) y `data/afirmaciones.json` (claims)
- Escribe de vuelta a `legal-articles.json` (actualiza `last_checked`, opcionalmente `texto_anterior`)
- Crea GitHub Issue via GitHub API (`GH_TOKEN` secret)
- GitHub Action en `.github/workflows/check-bcn-changes.yml`

</code_context>

<specifics>
## Specific Ideas

- El script debe reutilizar las funciones de fetch/extract/hash de bcn-extractor.py (importar o duplicar las necesarias)
- Los tres estados de evaluación IA son exactamente: `sin_impacto | requiere_revision | actualizar`
- El campo `texto_anterior` en legal-articles.json ya está diseñado para almacenar el texto previo cuando hay cambio
- Si hay cambio detectado: actualizar `texto_anterior` + nuevo `texto_verbatim` + nuevo `hash_sha256` + `last_checked` en legal-articles.json, Y crear el Issue
- El Action debe poder ejecutarse manualmente (workflow_dispatch) para testing

</specifics>

<deferred>
## Deferred Ideas

- Dashboard web de estado de verificación legal (pertenece a Phase 10 o posterior)
- Notificación por email además del GitHub Issue (fuera de alcance v1.2)

</deferred>
