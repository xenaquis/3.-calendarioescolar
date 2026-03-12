/* functions/api/data.js — Not needed for Type B (Catalogo Estatico).
   calendarioescolar.cl es un sitio de tipo B (catalogo estatico).
   Todas las paginas se generan desde data/pages.json via scripts/generate-pages.js.
   No se requiere API en tiempo real. Este archivo se mantiene como placeholder. */

export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    message: 'calendarioescolar.cl es un sitio estatico (Type B). No requiere API.',
    hint: 'Las paginas se generan con: node scripts/generate-pages.js'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
