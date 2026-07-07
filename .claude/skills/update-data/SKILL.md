---
name: update-data
description: Actualizar datos del calendario escolar (data/*.json en el repo, fuente Mineduc)
---

# Actualizar datos del calendario escolar

Los datos viven en el repo git (única fuente de verdad desde milestone 362).

## Flujo normal

1. Editar `data/pages.json` — datos por región (16 regiones)
2. Editar `data/calendar-config.json` — fechas del año escolar y feriados
3. Ejecutar `node scripts/generate-pages.js`
4. Validar: `node scripts/validate.js` + `node scripts/check-feriados.js`
5. Si todo OK: `npm run build` y preguntar si hacer push a main (el push deploya)

## Flujo asistido (pipeline PDF Mineduc)

1. Disparar workflow `extract-pdf.yml` (manual o cron 15-feb / 15-may / 31-dic)
2. Revisar `data/pdf-extraction-report.json` — discrepancias extraídas vs JSON
3. Con `--fix`: auto-corrige los JSON y regenera páginas
4. Mismos gates: generate + validate + check-feriados

## Campos que pueden cambiar cada año

### data/pages.json (una entrada por región)
- `inicio` — inicio clases (ej: "4 de marzo")
- `vacacionesInicio`, `vacacionesFin` — vacaciones invierno
- `fiestasPatriasInicio`, `fiestasPatriasFin` — Fiestas Patrias
- `finAno` — fin del año escolar
- `diasVacacionesInvierno`, `diasFiestasPatrias` — dias corridos
- `resolucion` — número y URL del PDF REX de la Seremi
- `title`, `description` — actualizar el año en el texto

### data/calendar-config.json
- `year` — año escolar
- `schoolStart`, `winterStart`, `winterEnd`, `schoolEnd` — formato YYYY-MM-DD
- `feriados` / `feriadosCompletos` — array con `date` (YYYY-MM-DD) y `nombre`

### scripts/check-feriados.js
- Extender tabla SOLSTICIO antes de cargar un año nuevo (falla a propósito
  si el año no está — verificar contra fuente oficial Ley 21.357)

## Regiones especiales
- **Aysén** y **Magallanes**: vacaciones invierno más largas — verificar REX regional
- Las resoluciones Mineduc SE MODIFICAN durante el año (ej: REX 632 modificó
  REX 618 de Aysén) — revisar data/resoluciones-modificatorias/
- Siempre verificar con resolución Mineduc

## Fuente oficial
- https://www.mineduc.cl/resoluciones-de-calendarios-escolares-regionales-{AÑO}/
- Buscar "Resolución Exenta" del año correspondiente (~noviembre)
- PDFs regionales por Seremi (URLs en pages.json → resolucion.url)

## Verificación post-update
- `public/health.json` → confirmar `dataYear` y `generatedDate`
- Revisar páginas de región críticas: Metropolitana, Aysén, Magallanes
- Las landings estáticas NO se regeneran automáticamente:
  - `vacaciones-invierno-2026.html` → actualizar año en title/H1/meta manualmente
  - `cuando-empiezan-clases-2026.html` → ídem

## En caso de error
- Si `validate.js` falla: corregir el error específico antes de continuar
- Si `check-feriados.js` falla: discrepancia entre calendar-config.json y el
  cálculo legal determinístico — verificar contra BCN antes de tocar nada
- Si faltan regiones: el validador lo detecta (espera exactamente 16)
