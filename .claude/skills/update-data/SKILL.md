---
name: update-data
description: Actualizar datos del calendario escolar desde Google Sheet o Mineduc
---

# Actualizar datos del calendario escolar

## Flujo normal (con Google Sheet configurado)

1. Verificar que `config.json → sheet.spreadsheetId` no es placeholder
2. Verificar que `GOOGLE_API_KEY` está disponible en el entorno
3. Ejecutar sync: `node scripts/sync-from-sheet.js`
4. Si hubo cambios: ejecutar `node scripts/generate-pages.js`
5. Validar: `node scripts/validate.js`
6. Si todo OK: `npm run build` y preguntar si hacer deploy

## Flujo manual (sin Sheet o emergencia)

1. Editar `data/pages.json` — datos por región (16 regiones)
2. Editar `data/calendar-config.json` — fechas del año escolar y feriados
3. Ejecutar `node scripts/generate-pages.js`
4. Validar: `node scripts/validate.js`
5. Si todo OK: `npm run build` y preguntar si hacer deploy

## Campos que pueden cambiar cada año

### data/pages.json (una entrada por región)
- `inicio` — inicio clases (ej: "2 de marzo")
- `vacacionesInicio`, `vacacionesFin` — vacaciones invierno
- `fiestasPatriasInicio`, `fiestasPatriasFin` — Fiestas Patrias
- `finAno` — fin del año escolar
- `diasVacacionesInvierno`, `diasFiestasPatrias` — dias corridos
- `title`, `description` — actualizar el año en el texto

### data/calendar-config.json
- `year` — año escolar
- `schoolStart`, `winterStart`, `winterEnd`, `schoolEnd` — formato YYYY-MM-DD
- `feriados` — array con `date` (YYYY-MM-DD) y `nombre`

## Regiones especiales
- **Aysén** y **Magallanes**: vacaciones invierno más largas (~21 días, inicio ~4 jul)
- **Resto del país**: ~14 días vacaciones invierno (inicio ~11 jul)
- Siempre verificar con resolución Mineduc

## Fuente oficial
- https://www.mineduc.cl → Documentos → Calendario Escolar
- Buscar "Resolución Exenta" del año correspondiente (~noviembre)
- Documento PDF con tabla por regiones

## Verificación post-update
- `public/health.json` → confirmar `dataYear` y `generatedDate`
- Revisar páginas de región críticas: Metropolitana, Aysén, Magallanes
- Las landings estáticas NO se regeneran automáticamente:
  - `vacaciones-invierno-2026.html` → actualizar año en title/H1/meta manualmente
  - `cuando-empiezan-clases-2026.html` → ídem

## En caso de error
- Si `validate.js` falla: corregir el error específico antes de continuar
- Si el Sheet no responde: usar datos existentes en el repo, NO commitear datos vacíos
- Si faltan regiones: el validador lo detecta (espera exactamente 16)
