# MILESTONE 360 — Recuperación de tráfico + monetización (2026-06-16)

> Análisis 360 del sitio con swarm Sonnet (6 investigadores) + validadores Opus (adversariales),
> datos reales de Google Search Console (export 12-jun) e inspección en vivo con BrowserOS.
> Objetivo del dueño: **información veraz, rankear, ganarle a la competencia, maximizar
> impresiones/clicks para AdSense, con el MÍNIMO mantenimiento.**

## 1. Diagnóstico (datos duros)

### El problema central: colapso post Core Update
- Tráfico de **3.503 impr/día (14-abr) → ~1-40/día desde 15-abr**. 2 meses sin recuperación.
- Posición media: **3-6 → 20-80**. Causa: Google March 2026 Core Update (penaliza agregadores/utility
  a favor de fuentes destino). El sitio es agregador de datos Mineduc → blanco directo.
- Los **head terms están muertos**: "vacaciones de invierno 2026" = 7.014 impr, **CTR 0,11%**, pos 3,4.
  El click se lo llevan AI Overview + prensa (T13, Meganoticias). Pelearlos es perder el tiempo.

### Dónde SÍ hay retorno (la apuesta)
- **Long-tail de alta intención**, CTR 5-37%, baja competencia:
  - `feriados escolares 2026 chile` CTR 7,2% · `calendario escolar nuble 2026` CTR 8,5%
  - region+año en general 5-11% CTR (Maule, Ñuble, Aysén convierten).
  - `vacaciones de septiembre 2026` **pos 1,14 CTR 28%** (demanda estacional aún dormida en junio).
  - `calendario de efemérides educacionales 2026` **CTR 37%** — sin página dedicada.

### Fugas técnicas confirmadas en GSC
- **Doble indexación por URL**: enlaces internos usan `.html` mientras canonical/sitemap usan pretty-URL
  → `/feriados-2026` (2.052 impr) y `/feriados-2026.html` (705 impr) compiten; `/vacaciones-invierno-2026.html`
  (14.856 impr) gana pero su pretty languidece en pos 15,6. Diluye PageRank en un sitio ya golpeado.
- **12 páginas `/feriados/[mes]-2026/`** existen e indexan, pero el home (máxima autoridad) no las enlaza.
- **Freshness stale**: home dice "Actualizado: abril 2026" (hoy es junio) y `dateModified` 2026-04-23.

### Errores de veracidad (el activo del sitio ES la exactitud)
- Home dice **"15 feriados"** → son **16** (`calendar-config.json`). Único error, alta visibilidad.
- **`llms.txt` con datos gravemente falsos** servidos a crawlers de IA: inicio "2 de marzo" (real 4-mar),
  vacaciones invierno "11-24 jul en 14 regiones" (real 22-jun a 3-jul / 12 días en 11), fin de año **invertido**,
  y lista **Corpus Christi como feriado** que suspende clases (¡el sitio en todo lo demás aclara que NO lo es!).
- `claims.json`: "vacaciones invierno en 14/16 regiones" → son **11** (5 excepciones regionales).
- Riesgo monetización: ~30 páginas con **slots AdSense placeholder** (`1234567890`) que con un pub-ID real
  generan requests a slots inexistentes → riesgo de política de la cuenta.

## 2. Estrategia (decisiones sólidas, bajo mantenimiento)

1. **No pelear head terms.** Doblar la apuesta al long-tail region+mes+intención, que es donde el sitio
   convierte y la competencia (feriados.cl, prensa) es débil o desechable.
2. **Consolidar señales**: una sola URL canónica por página (pretty), enlace interno coherente, huérfanas enlazadas.
3. **Veracidad impecable**: corregir todo dato falso/stale. Es defensa anti-Core-Update y base de E-E-A-T.
4. **Freshness automática**: que la señal de "actualizado" se refresque sola en cada deploy diario (cero mantenimiento).
5. **Páginas nuevas sólo si**: (a) hay demanda GSC probada, (b) el dato es determinístico o estable, (c) no
   duplica una página existente. Nada de fabricar datos (PAES, efemérides masivas sin fuente verificada).

## 3. Backlog priorizado (score = retorno/esfuerzo/mantenimiento, validado por Opus)

### Fase A — Veracidad + freshness (hacer ya; el dueño prioriza datos veraces)
| # | Acción | Score |
|---|--------|-------|
| A1 | Home "15 feriados" → "16" | 90 |
| A2 | `llms.txt`: corregir TODOS los datos (y autogenerar desde JSON para que no recaiga) | 80 |
| A3 | Freshness home: meta/dateModified a junio + label visible auto desde `CALENDAR_CONFIG.generatedDate` | 68 |
| A4 | `claims.json`+`afirmaciones.json`: vacaciones invierno 14/16 → 11 regiones (regenerar) | 50 |

### Fase B — Consolidación SEO (alto impacto sobre tráfico existente)
| # | Acción | Score |
|---|--------|-------|
| B1 | Enlaces internos `.html` → pretty-URL en todo el sitio (index, template→16 regiones, standalone) | 78 |
| B2 | `_redirects`: 301 `.html` → pretty para URLs ya indexadas | 78 |
| B3 | Home: grid de 12 meses (enlazar páginas huérfanas desde la página de máxima autoridad) | 82 |
| B4 | `feriados-2027` canonical/og/hreflang → pretty (coherencia) | 60 |
| B5 | `_headers`: regla cache para `/feriados/*` | 22 |

### Fase C — Mantenimiento (alinea con "mínimo mantenimiento")
| # | Acción | Score |
|---|--------|-------|
| C1 | `generate-feriados-mes.js`: `DATA_KEY_BY_DATE` → por nombre (year-agnostic; evita fallo silencioso 2027) | 52 |
| C2 | `check-feriados.js`: aviso proactivo si falta el solsticio del año+1 (reusa alertas existentes) | 34 |
| C3 | `verify-content.yml`: `continue-on-error` en el commit (evita rojos espurios) | 22 |
| C4 | `ads.js`: no hacer push de slots placeholder (protege la cuenta AdSense) | 70 |

### Fase D — Páginas nuevas de impresiones
| # | Acción | Score | Estado |
|---|--------|-------|--------|
| D1 | `/proximo-feriado` (countdown, estático en build + cliente; cero mantenimiento) | 72 | **HECHO (deploy 17-jun)** — `scripts/generate-proximo-feriado.js` |
| D2 | Optimizar `/feriados/septiembre-2026/` para "vacaciones de septiembre 2026" (title/H1/desc) | 55 | **HECHO** (titleSeo/descSeo en `generate-feriados-mes.js`) |
| D3 | `/efemerides-escolares-2026` (CTR 37%) | 62 | **HECHO (deploy 17-jun)** — `scripts/generate-efemerides.js`, 18 efemérides verificadas con fuente; las que son feriado toman fecha de `calendar-config.json` (corrigió Pueblos Indígenas 24→21 jun) |
| D4 | Semana Santa: sección/ancla en `/feriados/abril-2026/` (98 impr) | 45 | pendiente (no página nueva) |

### RECHAZADO por los validadores (no tocar)
- "Corregir" `trasladoLunes` → introduciría **fechas incorrectas** (la lógica replica la Ley 19.668 y las
  observancias oficiales históricas). Falso positivo.
- Simplificar el `@graph` JSON-LD → quitaría señales E-E-A-T justo cuando más importan.
- Reducir deploy diario → la frescura diaria es barata y deseada (premisa de "cuota Cloudflare" era falsa).
- Páginas `/fechas-paes`, `/semana-santa-2026` nuevas → especulativas, mantenimiento recurrente, fuera de núcleo.
- `feriados-2027` claim-data meta → obligaría a crear 16 claims/año por cero retorno.

## 4. Ideas de mayor alcance (datos públicos mal servidos, alta intención)
- **`/proximo-feriado`** como hub permanente de "¿mañana es feriado?" — countdown siempre fresco.
- **Efemérides escolares** (Día del Profesor 16-oct, Día del Alumno, etc.): fechas mayormente fijas año a año
  → bajo mantenimiento si se cura UNA vez contra el calendario oficial Mineduc. Captura el query de mayor CTR.
- **Receso de Fiestas Patrias** (vacaciones de septiembre): estacional, alta intención, ya cubierto parcialmente
  por la página de septiembre — sólo falta optimizar el targeting.
- Evitar dependencias frágiles: las APIs de feriados chilenas están muertas o tras bot-protection
  (ya documentado). El motor determinístico propio (`check-feriados.js`) es la fuente correcta.

## 5. Acción manual del dueño (no codificable)
- AdSense: pegar slot IDs reales del panel (mientras tanto, `ads.js` ya no hace push de placeholders).
- Cloudflare: verificar "Always Use HTTPS" (consolida los 340 impr de `http://`).
- GSC tras deploy: re-enviar sitemap + Request Indexing en `/`, `/feriados-2026`, `/vacaciones-invierno-2026`,
  `/feriados/septiembre-2026/` y top regiones.
