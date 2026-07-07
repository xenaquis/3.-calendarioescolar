# MILESTONE 361 — Recuperación AdSense + Alertas + Competencia feriados

**Origen:** `AUDITORIA-360-2026-07.md` (auditoría 360 del 2026-07-06: 22 agentes Fable, 12 hallazgos critical/high confirmados adversarialmente). Leer ese informe ANTES de ejecutar — este plan es su implementación.

**Objetivo:** dejar el sitio en condiciones de re-postular a AdSense (eliminar toda causa de "low value content"), resucitar la infraestructura de alertas (hoy 100% muerta), y posicionar la lane competitiva "¿hay clases el feriado X?" donde ya somos #1.

**Modo de ejecución:** autónomo, en rama `milestone-361`, commits atómicos por tarea (`feat(361): ...` / `fix(361): ...`). NO mergear a main ni pushear la rama sin verificación final completa (Fase 9). El deploy a producción ocurre al mergear a main — eso lo decide el humano.

---

## Prompt de arranque (copiar tras /clear)

```
Ejecuta la MILESTONE 361 de forma autónoma. Instrucciones:

1. Lee en este orden: BLUEPRINT.md, AUDITORIA-360-2026-07.md, MILESTONE-361.md (el plan maestro — síguelo fase por fase, en orden).
2. Crea la rama milestone-361 desde main y trabaja ahí. Un commit atómico por tarea con prefijo feat(361)/fix(361)/docs(361).
3. Después de CADA fase que toque data/ o templates: npm run generate && node scripts/validate.js && node scripts/check-feriados.js — los tres deben pasar antes de commitear.
4. Las line-numbers citadas en el plan vienen de la auditoría del 06-jul: verifícalas leyendo el archivo antes de editar (pueden haber driftado).
5. Los datos factuales nuevos (REX regionales, fechas históricas, contenido de meses) DEBEN verificarse contra fuente oficial (mineduc.cl, BCN) vía WebFetch/WebSearch antes de escribirse, y registrarse en data/afirmaciones.json + meta claim-data. Si una fuente no se puede verificar, marca el dato como PENDIENTE-VERIFICACION en el texto del commit y NO lo publiques en el HTML.
6. Las tareas marcadas [HUMANO] no las ejecutes: acumúlalas y repórtalas al final.
7. Al terminar: Fase 9 completa (verificación final + BrowserOS local), actualiza BLUEPRINT.md y MILESTONE-361.md (checkboxes), y entrega resumen con: tareas completadas, pendientes [HUMANO], y el comando de merge sugerido. NO mergees a main.
8. Respeta CLAUDE.md: cero frameworks, cero npm deps, IIFE/var, tokens.css intocable en estructura, kebab-case.
Si una tarea resulta inviable o la evidencia contradice el plan, documenta por qué, sáltala y sigue — no bloquees la milestone entera.
```

---

## Reglas transversales (aplican a TODAS las fases)

- **Nunca editar HTML generado** (`public/region/*`, `public/feriados/*`, `public/proximo-feriado*`, `public/efemerides*`): el fix va en `data/template*.html`, `scripts/generate-*.js` o `data/*.json`, y se regenera.
- **Todo dato factual nuevo** → claim en `data/afirmaciones.json` + data_key en el `<meta name="claim-data">` de la página. El build falla si falta.
- **Gate por fase:** `npm run generate && node scripts/validate.js && node scripts/check-feriados.js` en verde antes de cada commit que toque datos/templates.
- **Line numbers de la auditoría = hipótesis**, no verdad: leer el archivo antes de editar.
- **Español es-CL con tildes** en todo contenido visible.

---

## FASE 0 — Preflight

- [ ] `git status` limpio; crear rama `milestone-361` desde main actualizado.
- [ ] Baseline en verde: `npm run generate`, `node scripts/validate.js`, `node scripts/check-feriados.js`, `bash scripts/build.sh` (en Git Bash o WSL — recordar que build.sh es LF).
- [ ] Confirmar existencia de: `data/resoluciones-modificatorias/` (PDFs REX), `public/ads.txt`, `sync-deploy.yml` con su patrón de issue+GITHUB_TOKEN (referencia para Fase 1).
- [ ] [HUMANO] **Decisión billing**: hacer el repo público (recomendado por la auditoría: contenido ya público, secrets no se exponen, minutos ilimitados — elimina la clase de apagón del 23-30 jun) O subir spending limit + revisar método de pago. Sin esto, los crons pueden volver a morir en silencio.

## FASE 1 — P0: Resucitar alertas (los crons hoy alertan a la nada)

Contexto: secrets `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` **no existen** en Actions. Todo paso curl-Telegram es no-op silencioso. Patrón que SÍ funciona: issue+`GITHUB_TOKEN` en `sync-deploy.yml` (issue #8 probada).

- [ ] 1.1 `check-sources.yml`: reemplazar paso curl-Telegram por creación/actualización de issue vía `GITHUB_TOKEN` (copiar patrón de sync-deploy.yml). Si se conserva curl como opción, agregar `-f` + check de token no-vacío para que falle VISIBLE.
- [ ] 1.2 `verify-content.yml` (alerta ~líneas 70-73): mismo cambio a issue.
- [ ] 1.3 `extract-pdf.yml`: mismo cambio a issue + corregir condición de alerta — hoy referencia `steps.extract.outcome` con `continue-on-error` y queda SKIPPED en casi cualquier fallo; usar `if: failure()` o dar `id` al step de validación y chequear su outcome.
- [ ] 1.4 `scripts/check-bcn-changes.py` (~líneas 301-315): **el hash solo se actualiza si la notificación se envió con éxito**. Hoy el try/except traga el fallo y sobreescribe el hash → un cambio legal detectado se pierde permanentemente. Reestructurar: detectar cambio → notificar (issue) → solo si OK, persistir hash.
- [ ] 1.5 Verificación de fase: `workflow_dispatch` de check-sources en la rama NO es posible sin push — en su lugar, validar sintaxis YAML (`node -e` con yaml no disponible: usar revisión manual + actionlint si está instalado, o al menos `git diff` cuidadoso) y dejar nota en el reporte final para dispatch manual post-merge.

## FASE 2 — P0: Limpieza de código AdSense (prerequisito para re-postular)

Contexto: 72 unidades `<ins>` con slots falsos (1234567890/0987654321/1122334455); loader en 5 páginas dead-end; script hardcodeado en head de templates que anula el guard de `ads.js` y provocaría doble carga con slots reales.

- [ ] 2.1 Quitar `<script adsbygoogle>` + `<meta name="google-adsense-account">` de: `public/contacto.html`, `public/about.html`, `public/privacidad.html`, `public/avisolegal.html`, `public/quienes-somos.html`. La meta de verificación se conserva SOLO en `public/index.html` (agregarla ahí si no está).
- [ ] 2.2 Quitar el `<script adsbygoogle>` hardcodeado del head de `data/template.html` (~línea 36) y `data/template-mes.html` (~línea 38). `public/js/ads.js` queda como ÚNICO cargador (su guard anti-placeholder ya protege).
- [ ] 2.3 Quitar TODAS las unidades `<ins class="adsbygoogle">` con slot placeholder de: `data/template.html` (~166, 268, 323), `data/template-mes.html` (~145), y las standalone `feriados-2026.html`, `feriados-2027.html`, `corpus-christi-2026.html`, `cuando-empiezan-clases-2026.html`, `vacaciones-invierno-2026.html`. Conservar los contenedores `.ad-slot` solo si quedan vacíos sin `<ins>` — mejor eliminarlos completos (y quitar `aria-hidden="true"` donde sobreviva alguno).
- [ ] 2.4 CSP en `public/_headers` (~línea 8): agregar `https://*.adtrafficquality.google`, `https://www.google.com` y `https://fundingchoices.google.com` a `script-src`/`frame-src`/`connect-src` según corresponda (hoy la CSP bloquea el iframe sodar en producción — error de consola activo).
- [ ] 2.5 Regenerar y verificar: `grep -r "adsbygoogle" public/ | grep -v ads.js` debe devolver solo lo intencional (idealmente nada fuera de index meta); `grep -rn "1234567890\|0987654321\|1122334455" public/ data/` = vacío.
- [ ] 2.6 Documentar en `config.json` o BLUEPRINT que `config.json → adsense` es hoy config muerta (generate-pages.js no la lee). Opcional-plus: hacer que generate-pages.js inyecte slots desde config.json como fuente única — solo si el cambio es pequeño y testeable.

## FASE 3 — P0: Veracidad (contradicciones factuales activas)

- [ ] 3.1 **Aysén 11-dic vs 23-dic**: leer la REX 632 (PDF en `data/resoluciones-modificatorias/`; si el dato no está ahí, buscar la REX en mineduc.cl). Determinar el término real del año escolar de Aysén y corregir la fuente PERDEDORA: `data/pages.json`+index O el texto curado `MES_EXTRA` de julio/diciembre en `scripts/generate-feriados-mes.js` (~181-184, incluye su FAQPage JSON-LD). Nota BLUEPRINT histórico: "Aysén fin año 23 dic" (sección datos 2026-03-18) vs pages.json — resolver con el PDF, no con memoria.
- [ ] 3.2 `data/template.html` (~145): "Lunes · 2026" hardcodeado → placeholder `{{inicioDiaSemana}}` calculado en `scripts/generate-pages.js` desde la fecha real de inicio de cada región.
- [ ] 3.3 `scripts/validate.js`: agregar check de consistencia — el `finAno` de cada región en pages.json debe coincidir con toda mención curada (al menos: greps dirigidos a los textos MES_EXTRA que citan fechas de término regional). Si es complejo, un check mínimo: Aysén/Magallanes en MES_EXTRA vs pages.json.
- [ ] 3.4 Tildes/typos visibles: "Sabado" sin tilde (3×) en `scripts/generate-proximo-feriado.js`.

## FASE 4 — P1: Schema cleanup (markup muerto o no conforme)

Contexto verificado con docs oficiales: FAQPage eliminado de Google Search el 07-may-2026; HowTo deprecado desde 2023; rich result Event solo existe en 8 países que NO incluyen Chile y exige eventos reservables.

- [ ] 4.1 Retirar del `@graph` de `public/index.html`: `FAQPage`, `HowTo`, `Event`. Conservar: WebSite, Organization, Person, WebApplication, ItemList. El TEXTO visible del FAQ se queda (lo leen usuarios y AI Overviews).
- [ ] 4.2 Retirar `FAQPage` + `Event` de `data/template.html` (~62-104); conservar BreadcrumbList + Article.
- [ ] 4.3 Retirar `FAQPage` de la generación en `scripts/generate-feriados-mes.js` (~322-331). Texto FAQ visible se queda.
- [ ] 4.4 Retirar FAQPage/HowTo/Event de las landings standalone que los tengan (`vacaciones-invierno-2026.html`, `cuando-empiezan-clases-2026.html`, `feriados-2026.html`, `feriados-2027.html`, `corpus-christi-2026.html` — verificar cada una).
- [ ] 4.5 `scripts/generate-proximo-feriado.js`: agregar JSON-LD (Article + BreadcrumbList, con `dateModified` = buildDate real). Hoy la página de mejor freshness tiene CERO structured data.
- [ ] 4.6 Explorar `Dataset` schema para los datos de fechas (opcional; solo si cabe limpio en index o feriados-2026).
- [ ] 4.7 Verificación: `grep -rn '"FAQPage"\|"HowTo"\|"@type": "Event"' public/ data/ scripts/` = solo apariciones intencionalmente conservadas (idealmente cero).

## FASE 5 — P1: Diferenciar las 16 regiones (LA remediación del thin content) — la fase más larga

Contexto: 93-96% de texto idéntico entre páginas hermanas; cero prosa regional. Es el hallazgo #1 de la auditoría.

- [ ] 5.1 **Investigación por región** (WebSearch/WebFetch sobre mineduc.cl — portal `resoluciones-de-calendarios-escolares-regionales-2026` y sitios `[region].mineduc.cl`): para cada una de las 16 regiones, obtener N° y fecha de la REX regional 2026 + link al PDF. Ya conocidas: Aysén REX 632 (modifica REX 618, calidad del aire Coyhaique). Si una REX no se encuentra en línea, registrarla como `resolucion: null` y NO inventar número.
- [ ] 5.2 `data/pages.json` — agregar campos por región:
  - `resolucion`: `{ numero, fecha, url }` (verificada) o `null`.
  - `notaRegional`: 2-3 párrafos ÚNICOS por región (por qué sus fechas difieren o no de la pauta nacional; contexto real: clima/zona extrema en Aysén-Magallanes, vacaciones extendidas, historial de modificaciones del año, régimen semestral/trimestral). Redactar a mano por región — cero frases plantilla compartidas; criterio de aceptación: ≥120 palabras únicas por región que no aparezcan en ninguna hermana.
  - `comparativa`: 1 párrafo — qué regiones comparten sus fechas y de cuáles difiere (derivable de pages.json mismo: generarlo con datos + redacción variada).
- [ ] 5.3 `data/template.html`: nueva sección `Particularidades de {{region}}` (H2 semántico, antes del FAQ) que renderiza `notaRegional` + `comparativa` + cita de la REX con link cuando exista. CSS: reutilizar componentes existentes (`.home-section`, cards) — cero CSS nuevo si es posible; si hace falta, BEM-lite con tokens.
- [ ] 5.4 Claims: registrar en `data/afirmaciones.json` los data_keys de REX por región (con URL de fuente) y actualizar `claim-data` del template.
- [ ] 5.5 Verificación de unicidad (criterio de la auditoría): script ad-hoc o manual — tokens únicos por página región ≥120 (antes: 16-20). Comparar 3 pares (aysén/magallanes, metropolitana/valparaíso, arica/tarapacá).
- [ ] 5.6 Regenerar + gates + commit.

## FASE 6 — P1: Contenido de meses flacos + landing inicio de clases + reposicionamiento "¿hay clases?"

- [ ] 6.1 `scripts/generate-feriados-mes.js` → `MES_EXTRA`: subir enero, febrero, marzo y noviembre a ≥120 palabras únicas cada uno con contenido verificable: enero (matrícula/SAE, cierre año escolar anterior), febrero (por qué no hay feriados en febrero — Ley 2.977; preparación año escolar), marzo (inicio 4-mar, evaluaciones diagnósticas), noviembre (PAES/DEMRE con fechas verificadas, cierre 4° medio). Cada dato → claim.
- [ ] 6.2 Reposicionar el ángulo competitivo en TODAS las páginas de mes: title/H1/intro orientados a "feriados de [mes] 2026: ¿hay clases?" — el puente feriado×escolar es la única lane donde el dominio ayuda y ya somos #1 comprobado ('"hay clases" feriado "16 de julio"'). Ajustar en `data/template-mes.html` + `generate-feriados-mes.js` sin romper las queries que ya rankean ("feriados [mes] 2026" se mantiene en title).
- [ ] 6.3 `public/cuando-empiezan-clases-2026.html`: expandir a >600 palabras de prosa original — tabla histórica de inicios 2022-2026 (verificar cada año contra fuente: resoluciones/prensa oficial; si no se verifica, no se publica), qué pasa la primera semana, fechas conexas (SAE, matrícula), diferencia particulares pagados. Eliminar la repetición 5× de la misma respuesta. Claims para cada fecha histórica.
- [ ] 6.4 `/proximo-feriado` formato Q&A completo en `scripts/generate-proximo-feriado.js`: por cada feriado próximo, responder determinísticamente ¿es irrenunciable? (flag ya existe en calendar-config.json) ¿hay clases ese día? (cruce con calendario escolar) ¿aplica a comercio? (regla irrenunciable). Sin datos nuevos no verificables.
- [ ] 6.5 Exhibir el diferenciador BCN: en páginas de feriados (hub + meses), hacer visible el verbatim legal + SHA256 que ya existe en `data/legal-articles.json` (hoy nadie en la SERP lo tiene). Reusar el sistema de tooltips/claims existente si está operativo.

## FASE 7 — P1: Sitemap lastmod selectivo + señales de verificación positivas

- [ ] 7.1 `scripts/generate-pages.js` (+ `build.sh` ~23-27 si re-estampa): lastmod SOLO cambia si el contenido de la página cambió (hash del HTML generado vs anterior) o para páginas genuinamente dinámicas (`/proximo-feriado`). Hoy el deploy diario re-estampa TODO → Google aprende a ignorar la señal (doc oficial: lastmod debe ser "consistently and verifiably accurate").
- [ ] 7.2 `public/js/verificacion.js` (~72-127): copy a afirmación positiva — "Fechas según Resoluciones Exentas Mineduc 2026, revisada el DD-MM" — y suprimir del frontend "X de Y fuentes accesibles" / "N datos aún no verificados" (detalle queda en health.json/verificacion.json para uso interno). Quitar el badge "Pendiente de verificación" del template o resolver los 5 claims pendientes.

## FASE 8 — P2: Consolidación institucional, crons restantes, worker

- [ ] 8.1 Fusionar `about.html` → `quienes-somos.html` (o viceversa: elegir la de mejor URL, 301 en `public/_redirects` para la otra). Unificar identidad: lo visible vs Person JSON-LD deben coincidir. [HUMANO-DECISIÓN] nivel de identidad a exponer (la auditoría advierte el riesgo de declarar empleador judicial en sitio monetizado — por defecto: alinear a "Carlos S." también en el JSON-LD, es decir REDUCIR el schema, no ampliar lo visible). Corregir "no usamos rastreadores de terceros" (falso: GA4 + AdSense).
- [ ] 8.2 `public/privacidad.html`: agregar link a policies.google.com/technologies/partner-sites + mención de web beacons/IPs (requisito AdSense). Nota de plan: CMP de Google (Privacy & messaging) aplica a tráfico EEA — activarlo es [HUMANO] en el panel AdSense post-aprobación; dejar la CSP ya lista (hecho en 2.4). Documentar en BLUEPRINT el plan de banner de consentimiento antes de dic-2026 (Ley 21.719).
- [ ] 8.3 `extract-pdf.yml` reparación estructural: (a) paso de descarga de PDFs (hoy `data/snapshots/*.pdf` está gitignoreado y el workflow no descarga nada → "Generate PNGs" falla); (b) `permissions: contents: write` (el push falló con 403 el 15-may); (c) agregar cron `0 14 15 2 *` (15-feb: las REX se modifican antes del inicio de clases — caso REX 632). NO hacer dispatch desde la rama; anotar para post-merge.
- [ ] 8.4 `scripts/check-feriados.js` (~30-36): extender tabla SOLSTICIO con los años del anexo de la Ley 21.357 (verificar contra BCN — idNorma de la ley; transcribir años disponibles, típicamente hasta 2033+). Mantener el fail-a-propósito para años fuera de tabla.
- [ ] 8.5 `sync-deploy.yml`: eliminar ejecución duplicada de check-feriados (~línea 51, ya corre en build.sh) + agregar `concurrency: { group: pages-deploy, cancel-in-progress: false }` aquí y en `deploy.yml`.
- [ ] 8.6 Worker `workers/calendar-monitor/index.js`: (a) bajar umbral watchdog de health.json de 30 → 3 días (~línea 334 — habría detectado el apagón de junio en 72h); (b) eliminar el flujo BCN/apply-update basado en `SITE_FERIADOS` stale (~59-67; incluye Corpus Christi como feriado y omite Virgen del Carmen — podría commitear datos que check-feriados rechaza) O regenerar SITE_FERIADOS desde calendar-config.json; (c) cron en `wrangler.toml` a `0 8 * * THU` (el actual `0 8 * * 1` es DOMINGO en Cloudflare, no lunes; jueves da cobertura de mitad de semana). El redeploy (`npx wrangler deploy`) es [HUMANO] o ejecutable si hay credenciales wrangler locales — intentar y reportar.
- [ ] 8.7 Bump `actions/checkout@v5`, `actions/setup-node@v5`, `actions/setup-python@v6` en los 6 YAML (deadline Node20: 16-sep-2026).

## FASE 9 — Verificación final + entrega

- [ ] 9.1 Gates completos: `npm run generate` → `node scripts/validate.js` → `node scripts/check-feriados.js` → `bash scripts/build.sh` (todo verde).
- [ ] 9.2 Greps de no-regresión: cero slots placeholder; cero FAQPage/HowTo/Event no intencionales; cero "adsbygoogle" en dead-end; tildes OK; `{{placeholders}}` del template intactos; IDs críticos de DOM intactos (tabla en BLUEPRINT).
- [ ] 9.3 BrowserOS sobre preview local (`npm run dev`): home, 2 regiones (aysén + metropolitana — verificar sección "Particularidades" renderizada y distinta entre sí), /feriados/julio-2026/, /proximo-feriado, cuando-empiezan-clases. Consola limpia, dark mode OK.
- [ ] 9.4 Actualizar `BLUEPRINT.md` (sección nueva "Milestone 361") + marcar checkboxes de este archivo.
- [ ] 9.5 Reporte final: tareas hechas (con commits), pendientes [HUMANO], y comando de merge sugerido. **NO mergear a main.**

## Checklist [HUMANO] (acumulado — reportar al final)

1. Repo público o spending limit (Fase 0) — SIN ESTO LOS CRONS PUEDEN VOLVER A MORIR.
2. Merge de `milestone-361` a main → deploy automático.
3. Post-merge: `workflow_dispatch` de check-sources y extract-pdf para validar las alertas nuevas; verificar que crean issue.
4. Re-postular AdSense SOLO después del merge + 1-2 semanas de contenido nuevo indexado. Al aprobar: crear unidades reales, pegar slot IDs (máximo 1 unidad por página de región; mantener la de meses), min-height fijo por CLS.
5. GSC: re-enviar sitemap + Request Indexing en las 16 regiones renovadas + meses reposicionados.
6. Worker: `npx wrangler deploy` desde workers/calendar-monitor si no se pudo en 8.6.
7. Decisión identidad autor (8.1) si el default (reducir JSON-LD a lo visible) no convence.
8. Panel AdSense: activar CMP Privacy & messaging (tráfico EEA) tras aprobación.

## Qué NO hacer (guardrails de la auditoría)

- NO agregar Event schema "porque la competencia lo tiene" — refutado con doc oficial (no elegible en Chile).
- NO "arreglar" /proximo-feriado porque el HTML en git parece viejo — se regenera a diario en el deploy sin commitear; verificar SIEMPRE en producción.
- NO borrar las páginas de mes flacas — son el activo de mejor CTR (5-8%); se profundizan, no se eliminan.
- NO reactivar el sync del Google Sheet (pisaría los 16 feriados con los 14 viejos del Sheet).
- NO depender de APIs de feriados externas (todas muertas o con bot-protection) — el motor determinístico check-feriados.js es la fuente.
- NO pelear head terms ("feriados 2026") con contenido genérico — la lane es "¿hay clases?".
