#!/bin/bash
# new-site.sh — Configura un sitio nuevo desde el template
# Uso: bash scripts/new-site.sh
set -e

echo "=== Configurador de nuevo sitio ==="
echo ""

# Preguntar datos
read -p "Nombre del sitio (ej: Restricción Vehicular Chile): " SITE_NAME
read -p "Dominio (ej: restriccionhoy.cl): " DOMAIN
read -p "Idioma (es-CL / en / pt-BR) [es-CL]: " LANG
LANG=${LANG:-es-CL}
read -p "Título SEO principal (max 60 chars): " TITLE
read -p "Descripción SEO (150-160 chars): " DESCRIPTION
read -p "Color primario hex (ej: #1a73e8): " COLOR
COLOR=${COLOR:-#1a73e8}
read -p "Fuente de datos oficial: " SOURCE
read -p "AdSense Publisher ID (ca-pub-XXX) [dejar vacío si no hay]: " ADSENSE_PUB

echo ""
echo "Configurando: ${SITE_NAME} → ${DOMAIN}"
echo ""

# Buscar y reemplazar en todos los archivos relevantes
find public -type f \( -name "*.html" -o -name "*.xml" -o -name "*.txt" -o -name "*.css" -o -name "*.json" \) | while read file; do
  sed -i "s|SITENAME|${SITE_NAME}|g" "$file"
  sed -i "s|DOMAIN\.cl|${DOMAIN}|g" "$file"
  sed -i "s|DOMAIN|${DOMAIN}|g" "$file"
  sed -i "s|TITULO|${TITLE}|g" "$file"
  sed -i "s|DESCRIPCION[^\"]*\"|${DESCRIPTION}\"|g" "$file" 2>/dev/null || true
  sed -i "s|FUENTE_OFICIAL|${SOURCE}|g" "$file"
done

# Actualizar idioma
if [ "$LANG" != "es-CL" ]; then
  find public -name "*.html" | while read file; do
    sed -i "s|lang=\"es-CL\"|lang=\"${LANG}\"|g" "$file"
    sed -i "s|hreflang=\"es-CL\"|hreflang=\"${LANG}\"|g" "$file"
    sed -i "s|\"es_CL\"|\"${LANG//-/_}\"|g" "$file"
    sed -i "s|inLanguage.*es-CL|inLanguage\": \"${LANG}|g" "$file"
  done
fi

# Actualizar color primario
sed -i "s|#1a73e8|${COLOR}|g" public/css/tokens.css
sed -i "s|content=\"#1a73e8\"|content=\"${COLOR}\"|g" public/index.html

# Actualizar config.json
sed -i "s|SITENAME|${SITE_NAME}|g" config.json
sed -i "s|DOMAIN\.cl|${DOMAIN}|g" config.json
sed -i "s|DOMAIN|${DOMAIN}|g" config.json
sed -i "s|es-CL|${LANG}|g" config.json

# AdSense
if [ -n "$ADSENSE_PUB" ]; then
  find public -name "*.html" -o -name "ads.txt" | while read file; do
    sed -i "s|ca-pub-XXXXXXXXXXXXXXXX|${ADSENSE_PUB}|g" "$file"
  done
  echo "  AdSense configurado: ${ADSENSE_PUB}"
fi

# Actualizar robots.txt sitemap URL
sed -i "s|https://DOMAIN.cl/sitemap.xml|https://${DOMAIN}/sitemap.xml|g" public/robots.txt

# Actualizar _headers CORS
sed -i "s|https://DOMAIN.cl|https://${DOMAIN}|g" public/_headers

echo ""
echo "=== Sitio configurado ==="
echo ""
echo "Próximos pasos:"
echo "  1. Editar public/index.html con el contenido específico"
echo "  2. Reemplazar PREGUNTA_FAQ_* y RESPUESTA_FAQ_* en index.html"
echo "  3. Completar public/about.html con fuentes de datos"
echo "  4. Agregar og-image.png (1200x630) en public/icons/"
echo "  5. bash scripts/build.sh"
echo "  6. git push (deploy automático)"
echo ""
