---
name: update-data
description: Actualizar datos desde fuentes externas
---

# Actualizar datos

1. Leer `config.json` para identificar fuentes de datos
2. Si hay archivos en `data/*.json`, verificar si necesitan actualización
3. Fetch datos frescos desde las APIs externas configuradas
4. Validar que la respuesta tiene el formato esperado
5. Comparar con datos existentes — reportar cambios
6. Si los datos cambiaron:
   - Actualizar `data/*.json`
   - Ejecutar `npm run generate` si es arquetipo B
   - Ejecutar `npm run build`
   - Preguntar al usuario si quiere commitear

## APIs conocidas (Chile):
- mindicador.cl/api → UF, UTM, dólar, euro, IPC
- SINCA/MMA → calidad del aire
- CNE → precios combustible

## En caso de error:
- Si la API no responde, mantener datos existentes
- Reportar el error al usuario
- No commitear datos vacíos o inválidos
