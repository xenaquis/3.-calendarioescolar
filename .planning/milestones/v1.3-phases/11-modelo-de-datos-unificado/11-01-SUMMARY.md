---
phase: 11-modelo-de-datos-unificado
plan: 01
subsystem: data
tags: [data-model, claims, merge, legal-articles, afirmaciones]
dependency_graph:
  requires: [data/afirmaciones.json, data/legal-articles.json]
  provides: [data/claims.json, scripts/merge-claims.js]
  affects: [Phase 12, Phase 13]
tech_stack:
  added: []
  patterns: [CommonJS require, var-style Node.js script]
key_files:
  created:
    - scripts/merge-claims.js
    - data/claims.json
  modified: []
decisions:
  - "PREGUNTA_MAP object at script top for all 50 known claim IDs — avoids complex heuristic logic, fallback to claim text if id unknown"
  - "fuente_tipo copied from sources[].type to each claim — enriches downstream consumers without extra lookup"
  - "All legal-articles fields (articulo_numero, inciso, texto_anterior) copied as null for unenriched claims — consistent schema"
metrics:
  duration: "2 min"
  completed_date: "2026-03-25"
  tasks: 2
  files: 2
requirements: [JSON-01, JSON-02, JSON-03]
---

# Phase 11 Plan 01: Modelo de Datos Unificado — Summary

## One-liner

Merge script unifying afirmaciones.json (50 claims) + legal-articles.json (15 BCN verbatim entries) into claims.json v2.0.0 with pregunta/respuesta/fuente_url fields.

## What Was Built

- `scripts/merge-claims.js`: Node.js CommonJS script (var/require, no dependencies) that reads both source files and produces `data/claims.json`
- `data/claims.json`: Unified claims model v2.0.0 with 50 claims, 15 enriched with BCN verbatim extracts + SHA-256 hashes

## Output Structure

`data/claims.json` model v2.0.0:
- `_meta`: version, generatedAt, totalClaims=50, model="claim-centric-unified", merged_from
- `sources`: copied from afirmaciones.json (6 sources)
- `claims[50]`: each claim has pregunta, respuesta, fuente_url, fuente_tipo, extracto_verbatim, hash_sha256, last_checked, articulo_numero, inciso, texto_anterior

## Validation Results

All acceptance criteria passed:
- 50 claims total (matches `_meta.totalClaims`)
- 15 claims enriched with `extracto_verbatim` + `hash_sha256` from legal-articles.json
- 35 claims have null for legal-articles fields (non-feriado claims)
- All 50 claims have `pregunta`, `respuesta`, `fuente_url` fields
- `_meta.model` = "claim-centric-unified", version "2.0.0"
- Spot checks:
  - feriado-ano-nuevo: hash `6af996a86e7cd0f1cef48767fc423c58ca2e73f396003abc9d088ba29dcddc30` ✓
  - fecha-inicio-clases: extracto_verbatim = null, fuente_url contains "mineduc.cl" ✓
  - feriado-pueblos-indigenas: hash `0e50a44a501faed46d5cb79427de90cc1a3ec6247e534938ff535e588d33c289` ✓
- 18 BCN claims all have `fuente_url` starting with `https://www.bcn.cl/` ✓

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| PREGUNTA_MAP object with all 50 explicit mappings | Clean and maintainable; fallback to claim text for any future unknown IDs |
| fuente_tipo included per claim | Downstream consumers can distinguish pdf/xml/html sources without looking up sources table |
| Null-fill all legal-articles fields for unenriched claims | Consistent schema — all 50 claims have identical field set |

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| Task 1 | Create merge-claims.js + generate claims.json | dd8835d |
| Task 2 | Validate output (no new files — validation only) | dd8835d |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — claims.json is fully populated from real source data. All 50 claims are wired from afirmaciones.json with 15 enriched from legal-articles.json.

## Self-Check: PASSED
