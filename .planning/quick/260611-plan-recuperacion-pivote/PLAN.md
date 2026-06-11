# PLAN 2026-06-11 v2 — Recuperación de tráfico + sistema autónomo de resoluciones + pivote

## Diagnóstico actualizado (evidencia 2026-06-11)

### Serie GSC (xlsx, ventana 16-mar → 9-jun)

- Pico: 13-14 abril (3.286 y 3.503 impresiones/día, posición 2.8-3.5).
- Colapso: **15-abr** (163 impr) → desde entonces promedio **~8 impr/día, ~0 clics/día durante 8 semanas**. Sin signo de recuperación.
- Confirma y endurece el diagnóstico del 2026-06-08: democión algorítmica (March 2026 Core Update). Dos meses planos = no es fluctuación.

### SERP en vivo (BrowserOS, 11-jun)

- `vacaciones de invierno 2026 chile`: página 1 = AI Overview (cita mineduc.cl) + prensa fresca de mayo-junio (El Mostrador, Radio Agricultura, Diario Concepción, Rock&Pop, BioBioChile, La Tercera, 24horas) + mineduc.cl + ayudamineduc.cl + gob.cl + Instagram. calendarioescolar.cl **ausente**.
- `calendario escolar ñuble 2026` (long-tail que convertía): página 1 = Mineduc PDF, ayudamineduc, gob.cl, prensa, Instagram TVN, Canal 13, AS Chile. **Ausente también del long-tail**.
- Lectura: el nicho quedó para fuentes oficiales + marcas con frescura editorial. Un agregador estático no vuelve "esperando". Palanca real: **datos únicos + frescura demostrable + automatización**.

### Revisión de contenido del sitio en vivo

| Hallazgo | Página | Gravedad |
|---|---|---|
| **Posible error de datos Aysén**: sitio dice 29 jun → 17 jul; noticia oficial Mineduc (17-dic-2025) dice **6 jul → 24 jul** | `/vacaciones-invierno-2026`, `/region/aysen/`, home FAQ | **CRÍTICA** — Aysén es la región con mejor CTR (4.6%) y la propuesta de valor es exactitud |
| Badge ámbar "Pendiente de verificación" en el bloque principal de fechas | `/vacaciones-invierno-2026` (página #1 histórica, 14.856 impr) | ALTA |
| "Fuentes revisadas hace 85 días" + "5 de 49 datos no verificados" visibles | footer verificación | ALTA — staleness autoinfligida |
| Typo "inviernos más **crúdos**" | `/vacaciones-invierno-2026` | media |
| "Actualizado: abril 2026" en hero (estamos en junio) | `/` | media |

**El caso Aysén es el síntoma exacto del problema estructural**: las resoluciones Mineduc SE MODIFICAN durante el año y el pipeline de extracción corre solo el 15-may y el 31-dic. Si una resolución modificatoria salió después de marzo, el sitio queda publicando datos derogados sin enterarse. Eso es lo que este plan arregla de raíz.

### Estado del repo (bloqueo vigente)

WIP sin commitear en `data/*.json` (~2.777 líneas, núcleo factual) + 23 archivos basura `*-5CD438539F-NBK.*` + fixes de higiene SEO listos sin desplegar. Prerequisito de todo lo demás.

---

## Inventario de automatización existente y sus brechas

| Pieza | Cadencia | Telegram | Brecha |
|---|---|---|---|
| `deploy.yml` | push | no | — |
| `sync-deploy.yml` (Sheet → generate → deploy) | diario 06:00 UTC | no | deploya diario aunque nada cambie; sin alerta de fallo |
| `check-sources.yml` (HTTP 6 fuentes) | lunes 10:00 UTC | sí | solo "fuente viva/muerta", no detecta contenido nuevo |
| `check-bcn-changes.yml` (leyes feriados) | lunes 06:00 UTC | sí | — |
| `verify-content.yml` (claims vs fuentes, IA) | mensual día 1 | sí | cadencia baja → sello "hace 85 días" en el sitio |
| `extract-pdf.yml` (pipeline visual PNG+Gemini) | **2×/año** | sí | la brecha madre: no detecta resoluciones nuevas/modificadas entre corridas; `--fix` solo manual |
| `scripts/extract-from-pdf.js` (RAG texto DeepSeek) | manual | — | tiene auto-discovery del índice Mineduc + `--fix`, pero nadie lo agenda |
| Worker `calendar-monitor` (health + BCN + URL año sgte.) | lunes 08:00 UTC | sí (webhook) | no vigila que los crons de GitHub estén vivos |
| **Nadie** monitorea tráfico GSC | — | — | la caída de abril se descubrió a mano semanas después |
| **Nadie** alerta si un workflow falla o deja de correr | — | — | un cron muerto = silencio indistinguible de "todo OK" |

---

## FRENTE A — Esta semana (ventana invierno: vacaciones parten 22-jun)

1. **Auditar Aysén/Magallanes/Los Lagos/Arica-Tarapacá contra resoluciones vigentes** (incluidas modificatorias posteriores a marzo): correr `extract-pdf.yml` manual con `force_download=true` + verificación humana del PDF de Aysén. Corregir y desplegar si procede.
2. **Ordenar el repo**: revisar/commitear WIP de `data/*.json`, borrar archivos `*-NBK`, pull de commits del bot, desplegar fixes de higiene listos.
3. **Matar staleness**: `verify-content` con `FORCE_ALL=true`; resolver los 5 claims sin verificar o no imprimir el conteo negativo; badge ámbar → verde tras auditoría; "Actualizado: abril 2026" → fecha de build; typo "crúdos".
4. **GSC**: re-inspeccionar + request indexing de `/`, `/vacaciones-invierno-2026`, top 4 regiones tras deploy.

*Expectativa honesta: protege la ventana de invierno y elimina riesgo de publicar datos derogados; no revierte la democión por sí solo.*

## FRENTE B — Sistema autónomo de resoluciones (el corazón del plan)

Objetivo: **una resolución nueva o modificada en Mineduc termina publicada en el sitio sin intervención humana**, con gates que impiden publicar basura, y Telegram informando lo que pasó. Reusa las piezas existentes; lo nuevo es detección continua + orquestación + política de auto-aplicación.

### Arquitectura (pipeline `watch-resoluciones.yml`, cron diario ~07:00 UTC)

```
CAPA 1 — DESCUBRIMIENTO (diaria, barata: solo HTTP, sin LLM)
  ├─ Índice Mineduc resoluciones {AÑO} (ya parseado por discoverPdfs()
  │  de extract-from-pdf.js — extraer a módulo compartido)
  ├─ Ficha ayudamineduc.cl/ficha/calendarios-escolares-{AÑO}
  ├─ Patrón URL año siguiente (hoy lo hace el Worker — se mantiene como redundancia)
  └─ Compara contra data/resoluciones-manifest.json
     { region, url, sha256(pdf), nºresolución, fecha_detección, fecha_última_verificación }
     → PDF nuevo, URL cambiada o hash distinto ⇒ dispara CAPA 2 (solo regiones afectadas)
     → sin cambios ⇒ actualiza fecha_última_verificación y termina (run de ~1 min)

CAPA 2 — EXTRACCIÓN DOBLE (solo si hubo cambio; por región afectada)
  ├─ Pipeline A: visual (pdf-to-png + extract-visual.js, Gemini)  ← extract-pdf.yml actual
  ├─ Pipeline B: texto (extract-from-pdf.js, DeepSeek + OCR)      ← ya existe, hoy sin agendar
  └─ validate-extraction.js --strict sobre ambos

CAPA 3 — DECISIÓN (política de dos niveles)
  ├─ NIVEL VERDE (auto-aplicar sin humano):
  │    • ambos pipelines coinciden en los campos cambiados
  │    • el diff solo mueve fechas dentro del año escolar vigente
  │    • ≤ 6 campos afectados y validate.js pasa tras aplicar
  │    ⇒ aplicar a pages.json/calendar-config.json + claims sync
  │      → generate → validate → commit → deploy → Telegram:
  │      "✅ Resolución modificada [región]: campo X: a → b. Aplicado y desplegado.
  │       Diff: <link commit>. Revertir: git revert <sha>"
  └─ NIVEL AMARILLO (auto-PR, humano decide):
       pipelines discrepan, cambio estructural (régimen, regiones nuevas),
       > 6 campos, o validación falla
       ⇒ branch + PR con tabla de diff + PDFs adjuntos + Telegram con link al PR

CAPA 4 — PROPAGACIÓN DE FRESCURA (gratis, valor SEO)
  ├─ dateModified real en schemas de las páginas regeneradas
  ├─ "Verificado contra Resolución N° X del [fecha]" visible por región
  └─ Sección pública /cambios-calendario-2026: historial fechado de modificaciones
     por región (nadie en Chile tiene esto; es contenido destination-source que
     se escribe solo desde el manifest)
```

### Robustez del sistema de detección (que el vigilante no muera en silencio)

1. **Alerta de fallo de cualquier workflow**: workflow `on: workflow_run` (conclusion: failure) → Telegram con nombre del workflow + link al run. Hoy un cron que falla = silencio.
2. **Dead-man's switch cruzado**: cada cron de GitHub escribe su timestamp en `public/health.json` (campo `lastRuns`); el Worker de Cloudflare (infraestructura independiente) verifica en su corrida que ningún `lastRun` exceda su cadencia ×2 → alerta "cron X no corre hace N días". Y a la inversa: el monitor GSC de GitHub verifica que el Worker haya actualizado su KV/endpoint `/health`. GitHub vigila al Worker, el Worker vigila a GitHub.
3. **Heartbeat semanal** (lunes, consolidando los 3 reportes de los lunes en un digest): "✅ Semana OK — manifest: 16 PDFs sin cambios · fuentes 6/6 · claims 49/49 · GSC: X impr (Δ%) · último deploy [fecha]". El silencio deja de ser ambiguo: si no llega el digest, algo está roto.
4. **Monitor de tráfico GSC** (workflow diario, Search Console API con service account):
   - serie diaria guardada en `data/gsc-history.json`
   - alerta inmediata si impresiones 7d < 50% de las 7d previas, o clics=0 por 3 días con impr>100, o página top-5 desaparece del top-20
   - habría detectado la caída de abril el día 2, no semanas después
5. **Cross-check contra fuentes secundarias** (semanal): fechas del sitio vs feriadosapp API + snippets de ayudamineduc → discrepancia = alerta. Red de seguridad si los PDFs cambian de URL sin cambiar el índice (caso que la Capa 1 no ve).
6. **Cadencia verify-content**: mensual → quincenal, y la fecha se publica en el sitio (la señal de frescura se mantiene sola).
7. **Ajuste a sync-deploy**: hoy deploya todos los días aunque nada cambie; condicionar a cambios reales (los deploys con contenido idéntico no aportan y ensucian el historial). El deploy inmediato post-cambio queda a cargo de watch-resoluciones.

### Por qué esta arquitectura y no "más alertas"

El usuario pidió que las resoluciones nuevas sean automáticas. El diseño de dos pipelines de extracción independientes (visual Gemini + texto DeepSeek) convierte el problema de confianza en un problema de **consenso**: si dos métodos distintos leen lo mismo del mismo PDF, el riesgo de publicar un dato mal extraído es mínimo y se puede auto-aplicar; si discrepan, escala a humano. Eso es lo que permite quitar al humano del camino feliz sin sacrificar la propuesta de valor (exactitud).

## FRENTE C — Pivote "destination source" (2-6 semanas)

1. **`/cambios-calendario-2026`** — sale gratis de la Capa 4 del Frente B. Primera pieza de contenido único.
2. **Calendarios de colegios privados** (scraping): piloto 50-100 colegios grandes (semilla: directorio mime.mineduc.cl). Página por colegio = long-tail sin competencia de prensa ("vacaciones invierno colegio X 2026"). Mismo patrón técnico del Frente B (descubrimiento → hash → extracción LLM/OCR → manifest → generate). Scraping respetuoso: robots.txt, 1 req/s, user-agent identificado, badge "fuente: sitio del colegio, verificado [fecha]".
3. **Export .ics / Google Calendar por región**: archivos estáticos generados por generate-pages.js. Costo bajísimo, retención alta, nadie lo ofrece.
4. **"Todo para el colegio"** (expansión comercial): listas de útiles (Mineduc/JUNAEB + las de los colegios ya scrapeados en C.2) + comparador de precios útiles/uniformes (retailers online). Temporada dic-mar; construir sept-oct. Segunda pata de tráfico (transaccional) y vía de monetización real (afiliados).
5. **`/calendario-escolar-2027` temprano** (julio, marcado "proyectado"): la Capa 1 ya vigila el patrón de URL 2027 → al aparecer resoluciones, el pipeline lo puebla solo. Capturar el ciclo 2027 antes que la prensa.

## FRENTE D — Monetización (condicionada a tráfico)

- AdSense: retomar solicitud cuando haya >100 visitas/día sostenidas. Hoy no aprueba ni rinde.
- Afiliados útiles/uniformes (C.4) > display para intención transaccional.
- Cross-link dolaruf.cl existente; interlink desde contenidos nuevos.

---

## Orden de ejecución

| # | Qué | Cuándo | Esfuerzo |
|---|---|---|---|
| 1 | Frente A completo (auditoría Aysén + repo + staleness + GSC) | hoy-viernes | 0.5-1 día |
| 2 | Watchdogs básicos: alerta workflow-failure + heartbeat + monitor GSC | esta semana | 0.5-1 día |
| 3 | `watch-resoluciones.yml` Capas 1-2 (detección diaria + extracción doble, modo solo-PR) | semana 2 | 1-1.5 días |
| 4 | Capa 3 nivel verde (auto-aplicar + deploy) tras ≥1 semana de PRs correctos en sombra | semana 3 | 0.5 día |
| 5 | Dead-man's switch cruzado + cross-check secundario + /cambios-calendario-2026 | semana 3 | 1 día |
| 6 | Export .ics por región | semana 3-4 | 0.5 día |
| 7 | Scraper colegios privados piloto | semanas 4-6 | 2-3 días |
| 8 | /calendario-escolar-2027 + útiles escolares | julio-sept | 1-2 días |

El paso 4 arranca en "modo sombra" deliberadamente: una semana donde el nivel verde igual abre PR en vez de aplicar, para calibrar los umbrales con casos reales antes de soltarle la mano.

## Métricas de éxito

- 30 días: 0 badges ámbar; resolución modificada simulada (PDF de prueba) recorre el pipeline completo hasta deploy sin humano; alertas probadas con fallo inyectado; digest semanal llegando.
- 90 días: ≥1 modificación real de resolución capturada y publicada automáticamente (o evidencia de que no hubo ninguna); 50+ páginas de colegios indexadas; impresiones long-tail nuevas en GSC; baseline >100 impr/día.
- Próximo core update: el examen real del head term.
