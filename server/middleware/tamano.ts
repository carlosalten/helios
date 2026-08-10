/**
 * Límite global de tamaño de cuerpo para peticiones a la API.
 *
 * Rechaza (413) las peticiones de cambio de estado cuyo `Content-Length` supere el máximo,
 * antes de que Nitro llegue a bufferear el cuerpo. Defensa en profundidad contra el
 * agotamiento de memoria por payloads enormes; los schemas Zod acotan además cada campo
 * grande (p. ej. el CSV de carga masiva).
 *
 * El mayor cuerpo legítimo es la carga masiva de cursos (CSV de hasta ~2 MB, ver
 * cargaMasiva.schemas.ts); 5 MB deja margen para el envoltorio JSON sin ser abusable.
 */
const METODOS_CON_CUERPO = new Set(['POST', 'PUT', 'PATCH'])
const MAX_BYTES = 5 * 1024 * 1024

export default defineEventHandler((event) => {
   if (!event.path.startsWith('/api/')) return
   if (!METODOS_CON_CUERPO.has(event.method)) return

   const contentLength = getHeader(event, 'content-length')
   if (!contentLength) return

   const bytes = Number(contentLength)
   if (Number.isFinite(bytes) && bytes > MAX_BYTES) {
      throw createError({ statusCode: 413, message: 'El cuerpo de la petición es demasiado grande' })
   }
})
