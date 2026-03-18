# Fase 1: Registro Estructurado de Afirmaciones

> **Agente Especialista**: Ingeniero de Datos
> **Idea Matriz aplicada**: Cada dato mostrado al usuario se documenta con su fuente oficial, tipo de extracción, y valor esperado. Sin este registro, no hay verificación posible.

---

## Objetivo

Crear `data/afirmaciones.json` — un archivo que mapea **cada afirmación factual** del sitio a su fuente oficial, método de verificación, y valor actual. Este archivo es la fuente de verdad para todo el sistema de validación posterior.

---

## Problema que Resuelve

Hoy el sitio muestra ~45 datos factuales (fechas, conteos, nombres de feriados, referencias legales) pero ninguno tiene trazabilidad documentada. Si alguien pregunta "¿de dónde sale que las vacaciones de invierno empiezan el 11 de julio?", la respuesta es "del JSON", no "de la Resolución Exenta N° 1234 del Mineduc, artículo 3°, publicada el 15/11/2025".

---

## Entregables

### 1. `data/afirmaciones.json`

```json
{
  "_meta": {
    "version": "2.0.0",
    "generatedAt": "2026-03-17",
    "description": "Registro claim-centric: claims vinculadas a data_keys, no a páginas. Las páginas declaran sus datos via <meta name='claim-data'>. El mapping claim→página se resuelve en build time.",
    "totalClaims": 45,
    "model": "claim-centric",
    "tags_used": ["fechas_escolares", "feriados", "derivados", "contextuales", "inicio", "vacaciones_invierno", "fin_ano", "religioso", "laboral", "patrio", "cobertura"],
    "scaling_note": "Para agregar una página nueva: 1) agregar <meta name='claim-data'> al HTML, 2) si usa datos nuevos, agregar claims+source aquí. El build falla si hay data_keys sin claim."
  },
  "sources": {
    "mineduc-resolucion-2026": {
      "id": "mineduc-resolucion-2026",
      "name": "Resolución Exenta Calendario Escolar 2026",
      "type": "pdf",
      "tier": 3,
      "url": "https://www.mineduc.cl/wp-content/uploads/sites/19/2025/11/resolucion-calendario-escolar-2026.pdf",
      "url_alternativa": "https://www.bcn.cl/leychile/navegar?idNorma=XXXXXX",
      "snapshot_local": "data/snapshots/mineduc-resolucion-2026.pdf",
      "snapshot_hash": null,
      "snapshot_date": null,
      "notas": "URL exacta se confirma cuando Mineduc publica. Actualizar cada noviembre."
    },
    "bcn-ley-2977": {
      "id": "bcn-ley-2977",
      "name": "Ley 2.977 — Feriados legales",
      "type": "xml",
      "tier": 1,
      "url": "https://www.bcn.cl/leychile/navegar?idNorma=23639&idVersion=2024-06-21",
      "api_endpoint": "https://www.bcn.cl/leychile/servicios/exportar?idNorma=23639&formato=xml",
      "notas": "API XML estable. Ya monitoreada por calendar-monitor."
    },
    "bcn-ley-19668": {
      "id": "bcn-ley-19668",
      "name": "Ley 19.668 — Traslado feriados a lunes",
      "type": "xml",
      "tier": 1,
      "url": "https://www.bcn.cl/leychile/navegar?idNorma=155792",
      "api_endpoint": "https://www.bcn.cl/leychile/servicios/exportar?idNorma=155792&formato=xml"
    },
    "bcn-ley-20148": {
      "id": "bcn-ley-20148",
      "name": "Ley 20.148 — Virgen del Carmen",
      "type": "xml",
      "tier": 1,
      "url": "https://www.bcn.cl/leychile/navegar?idNorma=257742",
      "api_endpoint": "https://www.bcn.cl/leychile/servicios/exportar?idNorma=257742&formato=xml"
    },
    "bcn-ley-21357": {
      "id": "bcn-ley-21357",
      "name": "Ley 21.357 — Día pueblos indígenas",
      "type": "xml",
      "tier": 1,
      "url": "https://www.bcn.cl/leychile/navegar?idNorma=1160928",
      "api_endpoint": "https://www.bcn.cl/leychile/servicios/exportar?idNorma=1160928&formato=xml"
    },
    "mineduc-estadisticas": {
      "id": "mineduc-estadisticas",
      "name": "Estadísticas Mineduc — Matrícula y establecimientos",
      "type": "html",
      "tier": 2,
      "url": "https://centroestudios.mineduc.cl/",
      "notas": "Datos de cobertura escolar, número de estudiantes."
    }
  },
  "claims": [
    {
      "id": "fecha-inicio-clases",
      "tags": ["fechas_escolares", "inicio"],
      "claim": "El año escolar 2026 comienza el 2 de marzo",
      "displayed_value": "2026-03-02",
      "data_key": "schoolStart",
      "data_path": "calendar-config.json → schoolStart",
      "source_id": "mineduc-resolucion-2026",
      "source_reference": "Artículo 1° o equivalente",
      "verification_method": "deepseek",
      "verification_tier": 3,
      "last_verified": null,
      "last_verified_by": null,
      "status": "unverified"
    },
    {
      "id": "fecha-inicio-vacaciones-invierno",
      "tags": ["fechas_escolares", "vacaciones_invierno"],
      "claim": "Las vacaciones de invierno 2026 comienzan el 11 de julio",
      "displayed_value": "2026-07-11",
      "data_key": "winterStart",
      "data_path": "calendar-config.json → winterStart",
      "source_id": "mineduc-resolucion-2026",
      "source_reference": "Artículo sobre receso invernal",
      "verification_method": "deepseek",
      "verification_tier": 3,
      "last_verified": null,
      "last_verified_by": null,
      "status": "unverified"
    },
    {
      "id": "fecha-fin-vacaciones-invierno",
      "tags": ["fechas_escolares", "vacaciones_invierno"],
      "claim": "Las vacaciones de invierno 2026 terminan el 25 de julio",
      "displayed_value": "2026-07-25",
      "data_key": "winterEnd",
      "data_path": "calendar-config.json → winterEnd",
      "source_id": "mineduc-resolucion-2026",
      "source_reference": "Artículo sobre receso invernal",
      "verification_method": "deepseek",
      "verification_tier": 3,
      "last_verified": null,
      "last_verified_by": null,
      "status": "unverified"
    },
    {
      "id": "fecha-fin-ano-escolar",
      "tags": ["fechas_escolares", "fin_ano"],
      "claim": "El año escolar 2026 termina el 11 de diciembre",
      "displayed_value": "2026-12-11",
      "data_key": "schoolEnd",
      "data_path": "calendar-config.json → schoolEnd",
      "source_id": "mineduc-resolucion-2026",
      "source_reference": "Artículo sobre término año lectivo",
      "verification_method": "deepseek",
      "verification_tier": 3,
      "last_verified": null,
      "last_verified_by": null,
      "status": "unverified"
    },
    {
      "id": "feriado-viernes-santo",
      "tags": ["feriados", "religioso"],
      "claim": "Viernes Santo es feriado el 3 de abril de 2026",
      "displayed_value": "2026-04-03",
      "data_key": "feriado_viernes_santo",
      "data_path": "calendar-config.json → feriados[0]",
      "source_id": "bcn-ley-2977",
      "source_reference": "Art. 1° — Viernes Santo",
      "verification_method": "deterministic",
      "verification_tier": 1,
      "expected_check": "Viernes Santo 2026 cae en 3 de abril (cálculo eclesiástico)",
      "last_verified": null,
      "last_verified_by": null,
      "status": "unverified"
    },
    {
      "id": "feriado-dia-trabajo",
      "tags": ["feriados", "laboral"],
      "claim": "Día del Trabajo es feriado el 1 de mayo de 2026",
      "displayed_value": "2026-05-01",
      "data_key": "feriado_dia_trabajo",
      "data_path": "calendar-config.json → feriados[1]",
      "source_id": "bcn-ley-2977",
      "source_reference": "Art. 1° — 1 de mayo",
      "verification_method": "deterministic",
      "verification_tier": 1,
      "expected_check": "Fecha fija: siempre 1 de mayo",
      "last_verified": null,
      "last_verified_by": null,
      "status": "unverified"
    },
    {
      "id": "feriado-glorias-navales",
      "tags": ["feriados", "patrio"],
      "claim": "Glorias Navales es feriado el 21 de mayo de 2026",
      "displayed_value": "2026-05-21",
      "data_key": "feriado_glorias_navales",
      "data_path": "calendar-config.json → feriados[2]",
      "source_id": "bcn-ley-2977",
      "source_reference": "Art. 1° — 21 de mayo",
      "verification_method": "deterministic",
      "verification_tier": 1,
      "expected_check": "Fecha fija: siempre 21 de mayo",
      "last_verified": null,
      "last_verified_by": null,
      "status": "unverified"
    },
    {
      "id": "dias-vacaciones-invierno-general",
      "tags": ["derivados", "vacaciones_invierno"],
      "claim": "Las vacaciones de invierno duran 14 días (regiones estándar)",
      "displayed_value": "14",
      "data_key": "diasVacacionesInvierno",
      "data_path": "pages.json → [region].diasVacacionesInvierno",
      "source_id": null,
      "source_reference": "Calculado: winterEnd - winterStart = 14 días",
      "verification_method": "arithmetic",
      "verification_tier": 0,
      "expected_check": "daysDiff('2026-07-11', '2026-07-25') == 14",
      "last_verified": null,
      "last_verified_by": null,
      "status": "unverified"
    },
    {
      "id": "total-regiones",
      "tags": ["contextuales", "cobertura"],
      "claim": "Chile tiene 16 regiones con calendario escolar",
      "displayed_value": "16",
      "data_key": "totalRegiones",
      "data_path": "pages.json → length",
      "source_id": "mineduc-resolucion-2026",
      "source_reference": "La resolución aplica a 16 regiones",
      "verification_method": "deterministic",
      "verification_tier": 1,
      "last_verified": null,
      "last_verified_by": null,
      "status": "unverified"
    }
  ]
}
```

> **NOTA**: El JSON anterior es un ejemplo con 9 claims representativas. La implementación final debe incluir las ~45 afirmaciones completas del sitio.

### 2. `data/snapshots/` — Directorio de snapshots de fuentes Tier 3

Para fuentes que no tienen API (PDFs de Mineduc), almacenar una copia local:

```
data/snapshots/
  mineduc-resolucion-2026.pdf      # PDF descargado manualmente
  mineduc-resolucion-2026.sha256   # Hash del PDF
  mineduc-resolucion-2026.meta.json # Metadata
```

Formato de `.meta.json`:
```json
{
  "source_url": "https://www.mineduc.cl/...",
  "downloaded_at": "2025-11-20",
  "downloaded_by": "manual",
  "sha256": "abc123...",
  "notes": "Resolución Exenta N° 1234, publicada 15/11/2025"
}
```

### 3. Modificación a `scripts/validate.js`

Agregar una sección que verifique integridad de `afirmaciones.json`:

```javascript
// === VALIDACIÓN DE AFIRMACIONES ===
var afirmacionesPath = path.join(__dirname, '..', 'data', 'afirmaciones.json');
if (fs.existsSync(afirmacionesPath)) {
  var afirmaciones = JSON.parse(fs.readFileSync(afirmacionesPath, 'utf8'));

  // Verificar que cada claim en calendar-config.json tiene afirmación correspondiente
  var claimIds = afirmaciones.claims.map(function(c) { return c.id; });

  // schoolStart debe tener claim
  if (claimIds.indexOf('fecha-inicio-clases') === -1) {
    errors.push('afirmaciones.json: falta claim para fecha-inicio-clases');
  }

  // Verificar coherencia: displayed_value de cada claim debe coincidir con el dato real
  afirmaciones.claims.forEach(function(claim) {
    if (claim.data_path && claim.displayed_value) {
      // Resolver data_path y comparar con displayed_value
      var realValue = resolveDataPath(claim.data_path, calendarConfig, pages);
      if (realValue !== null && String(realValue) !== String(claim.displayed_value)) {
        errors.push('afirmaciones.json: claim "' + claim.id + '" dice "' +
          claim.displayed_value + '" pero dato real es "' + realValue + '"');
      }
    }
  });

  // Verificar que todas las fuentes referenciadas existen
  afirmaciones.claims.forEach(function(claim) {
    if (claim.source_id && !afirmaciones.sources[claim.source_id]) {
      errors.push('afirmaciones.json: claim "' + claim.id +
        '" referencia source inexistente "' + claim.source_id + '"');
    }
  });

  console.log('  Afirmaciones: ' + afirmaciones.claims.length + ' claims, ' +
    Object.keys(afirmaciones.sources).length + ' sources');
} else {
  warnings.push('afirmaciones.json no encontrado — verificación de contenido deshabilitada');
}
```

---

## Implementación Paso a Paso

### Paso 1: Auditoría del sitio (manual, ~1h)

Recorrer cada página del sitio y listar TODAS las afirmaciones factuales:

1. Abrir `public/index.html` → identificar cada dato numérico, cada fecha, cada nombre
2. Abrir `data/template.html` → identificar placeholders que se llenan con datos
3. Abrir `public/vacaciones-invierno-2026.html` → afirmaciones sobre vacaciones
4. Abrir `public/cuando-empiezan-clases-2026.html` → afirmaciones sobre inicio
5. Abrir `public/feriados-2026.html` → tabla completa de feriados

Para cada afirmación, documentar:
- ¿Qué dice exactamente? (el claim)
- ¿Dónde aparece? (displayed_in)
- ¿De dónde viene el dato? (data_path en el JSON)
- ¿Cuál es la fuente oficial? (source_id)
- ¿Cómo se puede verificar? (verification_method)

### Paso 2: Identificar fuentes oficiales (~30min)

Para cada fuente:
- Obtener URL estable (preferir BCN sobre Mineduc cuando exista)
- Clasificar en Tier 1/2/3
- Para Tier 3: descargar snapshot y calcular hash

### Paso 3: Construir afirmaciones.json (~30min)

Generar el archivo JSON completo con todas las afirmaciones.

### Paso 4: Integrar con validate.js (~30min)

Agregar la sección de validación de coherencia afirmaciones ↔ datos.

### Paso 5: Verificación inicial (~15min)

Ejecutar `node scripts/validate.js` y confirmar que todas las afirmaciones son coherentes con los datos actuales.

---

## Premortem Pesimista

### Riesgo 1: Afirmaciones incompletas
**Escenario**: Se olvida documentar una afirmación. El sitio muestra un dato sin fuente y nadie lo detecta.
**Probabilidad**: Alta (es trabajo manual).
**Mitigación**:
- Script de auditoría que busca patrones de datos en el HTML generado (regex para fechas, números) y los compara contra `afirmaciones.json`. Si encuentra un dato no mapeado → WARNING.
- Agregar en `generate-pages.js`: al generar cada página, verificar que los datos inyectados tienen claim correspondiente.

### Riesgo 2: URLs de fuentes cambian
**Escenario**: Mineduc cambia la URL de la resolución. El source_url en afirmaciones.json queda roto.
**Probabilidad**: Alta (Mineduc cambia URLs frecuentemente).
**Mitigación**:
- Fase 2 (monitor de fuentes) detecta URLs rotas.
- Incluir `url_alternativa` (BCN suele tener copia más estable).
- Para PDFs: snapshot local como fallback.

### Riesgo 3: Mantenimiento anual pesado
**Escenario**: Cada noviembre hay que actualizar ~45 afirmaciones manualmente. Se cometen errores.
**Probabilidad**: Media.
**Mitigación**:
- Separar afirmaciones "estáticas" (feriados de fecha fija) de "anuales" (fechas escolares).
- Las estáticas no cambian nunca. Las anuales son ~8 afirmaciones, manejable.
- Script de ayuda: `scripts/update-claims-year.js` que toma el nuevo año y actualiza automáticamente las afirmaciones derivadas (cálculos aritméticos).

### Riesgo 4: El JSON crece demasiado
**Escenario**: Con 45 claims + metadata + historial, el archivo se vuelve difícil de mantener.
**Probabilidad**: Baja (45 claims es poco).
**Mitigación**: Mantener plano. No anidar. No agregar historial en el JSON (usar git log para eso).

### Riesgo 5: Página nueva queda fuera del sistema de validación
**Escenario**: Se agrega `becas-2026.html` con datos de montos y plazos. Nadie registra las afirmaciones. El sistema dice "45/45 verificadas" pero la página nueva tiene datos sin fuente.
**Probabilidad**: Alta (es el escenario más probable de crecimiento del sitio).
**Mitigación (MODELO CLAIM-CENTRIC — ver SISTEMA-MAESTRO.md § Escalabilidad)**:
- Cada página HTML DEBE incluir `<meta name="claim-data" content="dataKey1,dataKey2,...">` listando los data paths que consume.
- En `validate.js`: escanear todas las páginas HTML, leer sus `claim-data`, y verificar que cada data_key tiene un claim correspondiente en `afirmaciones.json`.
- Si una página declara un data_key sin claim → **ERROR que bloquea build**.
- Si una página no tiene `<meta name="claim-data">` → **WARNING** (podría ser una página sin datos factuales, como `privacidad.html`).
- Claims usan `data_key` (vinculado al JSON) en vez de `displayed_in` (vinculado a archivos HTML). El mapping claim→página se calcula automáticamente en build time.
- Agregar a CLAUDE.md: "Cada página nueva con datos factuales DEBE incluir meta claim-data y registrar sus afirmaciones."

**Implementación del detector de claims huérfanas** (agregar a `validate.js`):
```javascript
// === DETECTOR DE CLAIMS HUÉRFANAS ===
var htmlFiles = glob.sync('public/**/*.html');
htmlFiles.forEach(function(htmlFile) {
  var html = fs.readFileSync(htmlFile, 'utf8');
  var match = html.match(/<meta\s+name="claim-data"\s+content="([^"]+)"/);
  if (!match) {
    // Páginas sin claim-data: solo warning si no es legal/about
    var basename = path.basename(htmlFile);
    if (['privacidad.html', 'contacto.html', 'about.html'].indexOf(basename) === -1) {
      warnings.push(htmlFile + ': no tiene meta claim-data');
    }
    return;
  }
  var dataKeys = match[1].split(',').map(function(k) { return k.trim(); });
  dataKeys.forEach(function(key) {
    var hasClaim = afirmaciones.claims.some(function(c) { return c.data_key === key; });
    if (!hasClaim) {
      errors.push(htmlFile + ': usa data_key "' + key + '" pero no hay claim registrado');
    }
  });
});
```

---

## Criterios de Éxito

- [ ] `data/afirmaciones.json` existe con ≥40 claims, cada una con `data_key` único
- [ ] Cada claim tiene `source_id` apuntando a una fuente documentada
- [ ] Cada fuente tiene URL y clasificación de tier
- [ ] Claims usan `tags` (array abierto) en vez de `category` (enum cerrado)
- [ ] `validate.js` verifica coherencia afirmaciones ↔ datos y bloquea build si hay discrepancia
- [ ] **Detector de claims huérfanas**: `validate.js` escanea `<meta name="claim-data">` en todas las páginas HTML y bloquea build si encuentra un data_key sin claim registrado
- [ ] Todas las páginas con datos factuales tienen `<meta name="claim-data" content="...">`
- [ ] Páginas sin datos factuales (privacidad, contacto, about) están en lista de excepción
- [ ] Para fuentes Tier 3 (PDFs): snapshot local descargado y hash calculado
- [ ] CLAUDE.md actualizado con: "Cada página nueva con datos factuales DEBE incluir `<meta name="claim-data">` y registrar afirmaciones en `data/afirmaciones.json`"
- [ ] **Test de escalabilidad**: crear una página ficticia `test-nueva.html` con un `<meta name="claim-data" content="schoolStart,nuevoDataKey">` → verificar que el build falla por `nuevoDataKey` sin claim, y pasa cuando se agrega el claim
