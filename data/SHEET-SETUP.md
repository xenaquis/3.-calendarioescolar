# Configuración del Google Sheet — calendarioescolar.cl

## Pasos para activar el sync automático

### 1. Crear el Google Sheet

1. Ir a https://sheets.google.com → crear hoja nueva
2. Renombrar el documento: **"Páginas Chicas — Control"**
3. Copiar el ID del Sheet desde la URL:
   `https://docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`
4. Pegar ese ID en `config.json` → `sheet.spreadsheetId`

### 2. Hacer el Sheet público (solo lectura)

Para que el sync funcione sin credenciales complejas:
- Click "Compartir" → "Cualquier persona con el enlace" → **"Lector"**
- Esto permite leer via API key sin OAuth

### 3. Obtener API Key de Google Sheets

1. Ir a https://console.cloud.google.com
2. Crear proyecto (o usar uno existente)
3. Habilitar **Google Sheets API**
4. Crear credencial: **API Key** (no OAuth — solo lectura)
5. Restringir la API key a: Google Sheets API + referrer calendarioescolar.cl
6. Guardar como GitHub Secret: `GOOGLE_API_KEY`

---

## Estructura del Sheet

### Tab: "Regiones"

> Fila 1 = encabezados (no editar). Filas 2–17 = una región por fila.

| Col | Campo | Ejemplo |
|-----|-------|---------|
| A | slug | `region/metropolitana` |
| B | region | `Metropolitana` |
| C | regionSlug | `metropolitana` |
| D | inicio | `2 de marzo` |
| E | vacacionesInicio | `11 de julio` |
| F | vacacionesFin | `24 de julio` |
| G | fiestasPatriasInicio | `14 de septiembre` |
| H | fiestasPatriasFin | `18 de septiembre` |
| I | finAno | `11 de diciembre` |
| J | diasVacacionesInvierno | `14` |
| K | diasFiestasPatrias | `5` |
| L | title | `Calendario Escolar 2026 — Región Metropolitana` |
| M | description | `Fechas del calendario escolar 2026 para...` |
| N | priority | `0.9` |

**Nota sobre regiones del sur:** Aysén y Magallanes tienen más días de vacaciones de invierno (21 días, inicio 4 de julio) y fin de año el 4 de diciembre. Verificar siempre con la resolución Mineduc.

---

### Tab: "Config"

> Configuración del año escolar. Actualizar cada noviembre con los datos del año siguiente.

Estructura (fila 1 = headers `KEY | VALUE | NOTAS`):

| Fila | KEY | VALUE | NOTAS |
|------|-----|-------|-------|
| 2 | year | 2026 | Año escolar |
| 3 | schoolStart | 2026-03-02 | Formato YYYY-MM-DD |
| 4 | winterStart | 2026-07-11 | Inicio vacaciones invierno (mayoría de regiones) |
| 5 | winterEnd | 2026-07-25 | Fin vacaciones invierno |
| 6 | schoolEnd | 2026-12-12 | Fin año escolar |
| 8 | FERIADOS | | Marcador de sección — no editar |
| 9 | DATE | NOMBRE | Header de la tabla de feriados |
| 10 | 2026-04-03 | Viernes Santo | |
| 11 | 2026-05-01 | 1 de mayo | |
| 12 | 2026-05-21 | Glorias Navales | |
| 13 | 2026-06-08 | Corpus Christi | |
| 14 | 2026-06-29 | San Pedro y San Pablo | |
| 15 | 2026-10-12 | Enc. Dos Mundos | |
| 16 | 2026-12-08 | 8 de diciembre | |

---

## GitHub Secrets requeridos

| Secret | Valor | Descripción |
|--------|-------|-------------|
| `GOOGLE_API_KEY` | `AIza...` | API Key de Google Cloud con Sheets API |
| `CF_API_TOKEN` | `...` | Token de Cloudflare Pages |
| `CF_ACCOUNT_ID` | `...` | ID de cuenta Cloudflare |

| Variable (GitHub Variables, no Secret) | |
|----|----|
| `CF_PROJECT_NAME` | Nombre del proyecto en Cloudflare Pages |

---

## Flujo de actualización anual (cada noviembre)

1. **Mineduc publica resolución** (~noviembre) → descargar PDF
2. **Actualizar el Sheet**: tab "Regiones" + tab "Config" con datos del año nuevo
3. **GitHub Action se ejecuta** automáticamente cada lunes → o disparar manualmente desde GitHub Actions
4. El action: sync → generate → validate → deploy
5. Verificar en `https://calendarioescolar.cl/health.json` que `generatedDate` es reciente y `dataYear` es el año correcto

---

## Comandos manuales (si se prefiere no usar Sheet)

```bash
# Editar directamente los JSON
nano data/pages.json
nano data/calendar-config.json

# Regenerar y validar
npm run generate
node scripts/validate.js
npm run build

# Deploy
npm run deploy
```
