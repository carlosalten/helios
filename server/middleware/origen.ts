/**
 * Protección CSRF de defensa en profundidad.
 *
 * Para peticiones de cambio de estado (POST/PUT/PATCH/DELETE) hacia la API,
 * exige que la cabecera `Origin` (o `Referer`) coincida con el host de la
 * propia app. Los navegadores siempre envían `Origin` en peticiones no-GET,
 * por lo que una petición forjada desde otro sitio quedará bloqueada.
 *
 * Se complementa con la cookie `SameSite=Lax`, que ya impide que el navegador
 * adjunte la sesión en peticiones cross-site de cambio de estado.
 *
 * Nota: si no hay `Origin` ni `Referer` (peticiones internas de SSR o clientes
 * no-navegador), no se bloquea aquí; esos casos siguen protegidos por la
 * exigencia de sesión y permisos en cada endpoint.
 */
const METODOS_PROTEGIDOS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export default defineEventHandler((event) => {
    if (!event.path.startsWith('/api/')) return
    if (!METODOS_PROTEGIDOS.has(event.method)) return

    const origin = getHeader(event, 'origin')
    const referer = getHeader(event, 'referer')

    const fuente = origin ?? referer
    if (!fuente) return

    let hostFuente: string
    try {
        hostFuente = new URL(fuente).host
    } catch {
        throw createError({ statusCode: 403, message: 'Origen no válido' })
    }

    const hostApp = getRequestURL(event).host

    if (hostFuente !== hostApp) {
        throw createError({ statusCode: 403, message: 'Origen no permitido' })
    }
})
