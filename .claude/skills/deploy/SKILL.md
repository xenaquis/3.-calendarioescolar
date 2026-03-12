---
name: deploy
description: Build y deploy a Cloudflare Pages
---

# Deploy a Cloudflare Pages

1. Ejecutar `npm run build` — verificar que no hay errores ni placeholders sin reemplazar
2. Ejecutar `git status` — verificar estado del repo
3. Si hay cambios sin commitear, preguntar al usuario si quiere commitear primero
4. Ejecutar `npm run deploy` o `git push origin main` (si tiene CI/CD configurado)
5. Verificar que el deploy fue exitoso
6. Reportar URL del sitio desplegado
