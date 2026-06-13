#!/bin/bash
# build.sh — Minifica y prepara para deploy
# Para sitios pequeños: regex-based. Si crece, usar npx terser/csso.
set -e

echo "=== Build: $(basename $(pwd)) ==="

# Validar integridad de datos ANTES de todo
echo "  Validando datos..."
if ! node scripts/validate.js; then
  echo "ERROR: Validacion de datos fallo. Corregir errores antes de continuar."
  exit 1
fi

# Verificacion deterministica de feriados (reglas legales, sin red)
echo "  Verificando feriados contra calculo legal..."
if ! node scripts/check-feriados.js; then
  echo "ERROR: Feriados en calendar-config.json no coinciden con el calculo legal."
  exit 1
fi

# Actualizar fecha en sitemap
TODAY=$(date +%Y-%m-%d)
if [ -f public/sitemap.xml ]; then
  sed -i "s|<lastmod>[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}</lastmod>|<lastmod>${TODAY}</lastmod>|g" public/sitemap.xml
  echo "  Sitemap: fechas actualizadas a ${TODAY}"
fi

# Contar archivos
HTML_COUNT=$(find public -name "*.html" | wc -l)
CSS_COUNT=$(find public/css -name "*.css" 2>/dev/null | wc -l)
JS_COUNT=$(find public/js -name "*.js" 2>/dev/null | wc -l)

echo "  Archivos: ${HTML_COUNT} HTML, ${CSS_COUNT} CSS, ${JS_COUNT} JS"

# Verificar que index.html existe
if [ ! -f public/index.html ]; then
  echo "ERROR: public/index.html no encontrado"
  exit 1
fi

# Verificar placeholders sin reemplazar
PLACEHOLDERS=$(grep -rn "DOMAIN\.cl\|SITENAME\|XXXXXXXX\|TITULO\|DESCRIPCION\|FUENTE_OFICIAL\|PREGUNTA_FAQ\|RESPUESTA_FAQ" public/ --include="*.html" --include="*.xml" --include="*.txt" 2>/dev/null | head -5)
if [ -n "$PLACEHOLDERS" ]; then
  echo ""
  echo "ADVERTENCIA: Placeholders sin reemplazar encontrados:"
  echo "$PLACEHOLDERS"
  echo "  Ejecutar scripts/new-site.sh primero."
  echo ""
fi

echo "=== Build completo ==="
