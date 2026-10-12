import type { H3Event } from 'h3'

// Política anti fuerza bruta de los logins (staff: /api/auth/login, estudiantes:
// /api/auth/estudiante/login). Dos contadores de FALLOS en una ventana de 15 minutos:
//
//   - Por cuenta (email): a los MAX_FALLOS_POR_CUENTA fallos esa cuenta queda bloqueada (429), y
//     desde el 1er fallo cada intento siguiente de esa cuenta exige captcha.
//   - Por IP: NO bloquea. A partir de FALLOS_IP_PARA_CAPTCHA fallos desde una misma IP (en
//     cualquier cuenta), todo intento desde esa IP exige captcha. Muchas personas comparten IP
//     (wifi del campus, NAT, el proxy del hosting si no se confía en X-Forwarded-For): bloquear
//     por IP dejaba afuera a todos por los errores de uno. El captcha frena igual el barrido de
//     cuentas desde un mismo origen sin cortarle el acceso a nadie.
//
// Los logins exitosos no cuentan, y un éxito solo limpia el contador de SU cuenta: si limpiara
// el de la IP, alguien con una cuenta válida podría resetearlo una y otra vez para un atacante
// en la misma red.
const VENTANA_MS = 15 * 60 * 1000
const MAX_FALLOS_POR_CUENTA = 10
const FALLOS_IP_PARA_CAPTCHA = 10

// IP del cliente. `X-Forwarded-For` solo se usa con runtimeConfig.trustProxy (ver
// nuxt.config.ts); expuesta directa a internet, esa cabecera la escribe el propio cliente.
export function ipDelCliente(event: H3Event) {
   const { trustProxy } = useRuntimeConfig(event)
   return getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'desconocido'
}

// `prefijo` separa los contadores de cada login (staff y estudiantes no comparten balde).
export function crearLimiteLogin(prefijo: string, ip: string, email: string) {
   const claveCuenta = `${prefijo}:email:${email}`
   const claveIp = `${prefijo}:ip:${ip}`

   return {
      // 429 si la cuenta superó los fallos permitidos. Va antes de revisar credenciales.
      verificarCuentaNoBloqueada() {
         const limite = excedeLimite(claveCuenta, MAX_FALLOS_POR_CUENTA)
         if (!limite.permitido) {
            const minutos = Math.ceil(limite.reintentarEnSeg / 60)
            throw createError({
               statusCode: 429,
               message: `Cuenta bloqueada temporalmente por intentos fallidos. Reintenta en ${minutos} minuto(s).`,
            })
         }
      },

      // Exige y verifica el captcha si la cuenta ya falló antes o si la IP acumula fallos.
      // `data.requiereCaptcha` le indica al frontend que muestre el widget.
      async exigirCaptchaSiCorresponde(event: H3Event, turnstileToken: string | undefined) {
         const requiere =
            !excedeLimite(claveCuenta, 1).permitido || !excedeLimite(claveIp, FALLOS_IP_PARA_CAPTCHA).permitido
         if (!requiere) return
         if (!turnstileToken) {
            throw createError({
               statusCode: 401,
               message: 'Verificación de seguridad requerida.',
               data: { requiereCaptcha: true },
            })
         }
         const resultado = await verifyTurnstileToken(turnstileToken, event)
         if (!resultado.success) {
            throw createError({
               statusCode: 401,
               message: 'No se pudo verificar que no eres un robot. Vuelve a intentarlo.',
               data: { requiereCaptcha: true },
            })
         }
      },

      anotarFallo() {
         registrarFallo(claveCuenta, VENTANA_MS)
         registrarFallo(claveIp, VENTANA_MS)
      },

      anotarExito() {
         reiniciarTasa(claveCuenta)
      },
   }
}
