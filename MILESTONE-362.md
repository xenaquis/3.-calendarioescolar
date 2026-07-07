# MILESTONE 362 — Eliminar el Google Sheet: autonomía total del sitio

**Origen:** decisión del dueño (2026-07-07): el Sheet de control ("Páginas Chicas — Control") deja de existir como pieza del sistema. El repo git es la ÚNICA fuente de verdad de datos Y de estado.

**Contexto que lo hace seguro:** el sync desde el Sheet ya está DESACTIVADO en CI desde 2026-06-12 (el Sheet quedó desactualizado con 14 feriados vs los 16 correctos y un sync los habría pisado — ver BLUEPRINT). El sitio ya se auto-mantiene sin el Sheet: motor determinístico check-feriados.js (build + diario), monitor legal BCN semanal, verify-content mensual, deploy diario con freshness, worker watchdog (3 días), pipeline PDF Mineduc (feb/may/dic). Esta milestone solo REMUEVE el código y la documentación que aún apuntan al Sheet.

**Modo:** autónomo, rama `milestone-362`, commits atómicos `feat(362)/fix(362)/docs(362)`. Gates antes de cada commit que toque data/scripts: `npm run generate && node scripts/validate.js && node scripts/check-feriados.js`. NO mergear a main (lo decide el humano).

---

## Prompt de arranque (copiar tras /clear)

```
Ejecuta la MILESTONE 362 de forma autónoma. Instrucciones:

1. Lee en este orden: BLUEPRINT.md (secciones "Milestone 361" y "Estrategia Feriados" → Auto-mantenimiento), MILESTONE-362.md (plan maestro — síguelo fase por fase).
2. Crea la rama milestone-362 desde main actualizado. Un commit atómico por fase.
3. Gate por fase que toque data/ o scripts/: npm run generate && node scripts/validate.js && node scripts/check-feriados.js — los tres en verde antes de commitear.
4. REGLA DE ORO: el secret GOOGLE_API_KEY NO se elimina ni se renombra — lo usa extract-visual.js (Gemini) en extract-pdf.yml. Solo muere su uso para Sheets.
5. El worker workers/calendar-monitor requiere redeploy tras editarlo: intenta `npx wrangler deploy` desde su directorio (hay sesión OAuth local); si falla, repórtalo como [HUMANO].
6. Las tareas [HUMANO] no las ejecutes: acumúlalas y repórtalas al final.
7. Al terminar: verificación final (gates + grep -ri "sheet" sobre scripts/ config.json .github/ workers/ .claude/ = solo menciones históricas en BLUEPRINT/auditorías), actualiza BLUEPRINT.md y los checkboxes de MILESTONE-362.md, actualiza la memoria persistente (project_state, project_estrategia_feriados, reference_external_systems: el Sheet ya no existe), y entrega resumen + comando de merge. NO mergees.
8. Respeta CLAUDE.md: cero frameworks, cero npm deps, IIFE/var, kebab-case.
Si algo contradice el plan, documenta por qué, sáltalo y sigue.
```

---

## FASE 0 — Preflight

- [ ] Rama `milestone-362` desde main actualizado; baseline de gates en verde.
- [ ] Confirmar que ningún workflow activo invoca sync-from-sheet.js ni claims-to-sheet.js (`grep -rn "sync-from-sheet\|claims-to-sheet" .github/workflows/` = vacío).

## FASE 1 — Eliminar el código solo-Sheet (~1.040 líneas)

- [ ] 1.1 `git rm scripts/sync-from-sheet.js` (363 líneas — lector Sheet→JSON, sin uso en CI desde jun).
- [ ] 1.2 `git rm scripts/claims-to-sheet.js` (557 líneas — escritor claims→Sheet vía service account).
- [ ] 1.3 `git rm data/SHEET-SETUP.md` (120 líneas de instrucciones de configuración).
- [ ] 1.4 `config.json`: eliminar el bloque `sheet` completo (spreadsheetId, tabs, estructuras).
- [ ] 1.5 `scripts/validate.js` (~254-255): eliminar el warning de `PLACEHOLDER_SHEET_ID` (ya no hay bloque sheet que validar).

## FASE 2 — Limpiar referencias en código vivo

- [ ] 2.1 `scripts/notify-telegram.js` (~36-37, 132, 154, 177): SHEET_ID/SHEET_URL hardcodeados y links "Abrir Google Sheet" en las alertas → reemplazar por link al repo (`https://github.com/xenaquis/3.-calendarioescolar`) y la instrucción "editar data/*.json y push a main". Es fallback legacy pero sigue cableado en check-bcn-changes.py.
- [ ] 2.2 `workers/calendar-monitor/index.js` (~277): la instrucción de alerta "Actualizar Google Sheet → disparar sync-deploy.yml" → "Editar data/calendar-config.json o data/pages.json en el repo; el push a main deploya". Buscar TODAS las menciones (`grep -n -i sheet` en el archivo). **Redeploy con wrangler** (regla 5 del prompt).
- [ ] 2.3 `scripts/generate-pages.js` (~406, 414): comentarios estampados en artefactos generados ("editar claims en el Sheet", "datos desde claims.json via Sheet") → "editar data/claims.json / data/afirmaciones.json".
- [ ] 2.4 `.github/workflows/sync-deploy.yml`: reescribir el comentario de cabecera (la historia del sync desactivado se acorta a una línea: "los datos viven en el repo; no hay fuentes externas de sync") y evaluar renombrar el workflow a `daily-deploy.yml` (name: "Verificación diaria + Deploy" ya es correcto; el rename del archivo es opcional — si se hace, revisar que ningún workflow lo referencie por nombre de archivo... verify-content.yml referencia "Check Source Health" por NAME de workflow, no archivo: seguro).
- [ ] 2.5 `data/FUENTES-VERDAD.md`: actualizar el protocolo anual — la edición es directa en `data/pages.json` + `data/calendar-config.json` (o vía pipeline PDF con --fix).

## FASE 3 — Documentación operativa

- [ ] 3.1 `.claude/CLAUDE.md`: (a) sección "Fuente de verdad" → el repo git; el Sheet ELIMINADO 2026-07 (una línea de historia); (b) quitar `sync-from-sheet.js` de Comandos y de la arquitectura; (c) quitar `data/SHEET-SETUP.md` del árbol; (d) actualizar "Fuente de datos" (sin "sync automatico via GitHub Action").
- [ ] 3.2 `.claude/skills/update-data/SKILL.md`: reescribir el flujo de actualización sin Sheet (editar JSONs → generate → validate → push).
- [ ] 3.3 `BLUEPRINT.md`: (a) tabla de estado: fila "Google Sheet Sync" → "ELIMINADO 2026-07 (repo = única fuente de verdad)"; (b) sección "Flujo de datos": rehacer el diagrama sin el Sheet; (c) "Pendientes críticos" #3 (Configurar Google Sheet + API Key) → eliminado/obsoleto; (d) sección nueva "Milestone 362" con el resumen.
- [ ] 3.4 Nota sobre `GOOGLE_API_KEY`: documentar en BLUEPRINT que el secret se CONSERVA solo para Gemini (extract-visual.js).

## FASE 4 — Verificación + entrega

- [ ] 4.1 Gates completos + `bash scripts/build.sh`.
- [ ] 4.2 `grep -ri "sheet" scripts/ config.json .github/workflows/ workers/calendar-monitor/index.js .claude/CLAUDE.md .claude/skills/` → cero referencias operativas (solo históricas permitidas en BLUEPRINT/MILESTONE/AUDITORIA).
- [ ] 4.3 Smoke test local: `npm run dev` + curl al home y una región (nada del flujo de render dependía del Sheet, pero verificar).
- [ ] 4.4 Actualizar memoria persistente: `project_state` (Sheet eliminado), `project_estrategia_feriados` (el pendiente "actualizar Sheet" muere), `reference_external_systems` (quitar URL del Sheet), MEMORY.md.
- [ ] 4.5 Checkboxes de este archivo + reporte final + comando de merge sugerido.

## Checklist [HUMANO]

1. Merge de `milestone-362` a main.
2. En Google Drive: archivar o eliminar el spreadsheet "Páginas Chicas — Control" (ID `160WyrLOm6nV2MAg1cusYvSbVzOWnqYWIt8O5MgXRvF4`). Si otros sitios "Páginas Chicas" lo usan, solo eliminar el tab de calendarioescolar.
3. Si existe el secret `GOOGLE_SERVICE_ACCOUNT_KEY` en GitHub Actions (lo usaba claims-to-sheet.js): eliminarlo. `gh secret list` para confirmar.
4. NO tocar el secret `GOOGLE_API_KEY` (Gemini/extract-visual).

## Qué NO hacer

- NO eliminar `GOOGLE_API_KEY` (dual-use: hoy lo consume Gemini en extract-pdf.yml).
- NO reactivar ningún sync externo — la autonomía es el objetivo.
- NO tocar el motor determinístico (check-feriados.js) ni el pipeline PDF: son los reemplazos del Sheet.
- NO borrar menciones históricas del Sheet en BLUEPRINT/auditorías (son registro de decisiones).
