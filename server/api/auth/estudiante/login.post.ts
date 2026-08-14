import bcrypt from 'bcryptjs'
import { z } from 'zod'

// Login del portal de estudiantes: verifica credenciales contra TtEstudiante (tabla propia,
// separada de Persona — ver comentario en schema.prisma) y crea la misma sesión Nuxt que el
// login de staff, pero con `tipo: 'estudiante'`. Mismo captcha (Cloudflare Turnstile) que
// server/api/auth/login.post.ts, exigido desde el 2do intento fallido para ese email.
const LoginSchema = z.object({
   email: z.string().trim().toLowerCase().email(),
   password: z.string().min(1),
   turnstileToken: z.string().optional(),
})

const VENTANA_MS = 15 * 60 * 1000 // 15 minutos
const MAX_POR_IP = 5 // intentos (éxitos o fallos) por IP
const MAX_FALLOS_POR_EMAIL = 10 // fallos por cuenta (fuerza bruta distribuida)

export default defineEventHandler(async (event) => {
   // Claves con prefijo propio para no compartir balde con el rate-limit del login de staff.
   const { trustProxy } = useRuntimeConfig(event)
   const ip = getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'desconocido'
   const claveIp = `login-estudiante:ip:${ip}`
   const limiteIp = limitarTasa(claveIp, { max: MAX_POR_IP, ventanaMs: VENTANA_MS })
   if (!limiteIp.permitido) {
      const minutos = Math.ceil(limiteIp.reintentarEnSeg / 60)
      throw createError({ statusCode: 429, message: `Demasiados intentos. Reintenta en ${minutos} minuto(s).` })
   }

   const body = await readBody(event)
   const result = LoginSchema.safeParse(body)
   if (!result.success) throw createError({ statusCode: 401, message: 'Credenciales no válidas' })

   const { email, password, turnstileToken } = result.data
   const claveEmail = `login-estudiante:email:${email}`

   const limiteEmail = excedeLimite(claveEmail, MAX_FALLOS_POR_EMAIL)
   if (!limiteEmail.permitido) {
      const minutos = Math.ceil(limiteEmail.reintentarEnSeg / 60)
      throw createError({
         statusCode: 429,
         message: `Cuenta bloqueada temporalmente por intentos fallidos. Reintenta en ${minutos} minuto(s).`,
      })
   }

   // Captcha desde el 2do intento fallido para este email — mismo criterio que
   // server/api/auth/login.post.ts (ver el comentario ahí para el porqué del umbral).
   const yaFalloAntes = !excedeLimite(claveEmail, 1).permitido
   if (yaFalloAntes) {
      if (!turnstileToken) {
         throw createError({
            statusCode: 401,
            message: 'Verificación de seguridad requerida.',
            data: { requiereCaptcha: true },
         })
      }
      const resultadoCaptcha = await verifyTurnstileToken(turnstileToken, event)
      if (!resultadoCaptcha.success) {
         throw createError({
            statusCode: 401,
            message: 'No se pudo verificar que no eres un robot. Vuelve a intentarlo.',
            data: { requiereCaptcha: true },
         })
      }
   }

   const estudiante = await prisma.ttEstudiante.findUnique({ where: { email }, omit: { password: false } })
   if (!estudiante) {
      registrarFallo(claveEmail, VENTANA_MS)
      throw createError({ statusCode: 401, message: 'Credenciales no válidas' })
   }

   const passwordValido = await bcrypt.compare(password, estudiante.password)
   if (!passwordValido) {
      registrarFallo(claveEmail, VENTANA_MS)
      throw createError({ statusCode: 401, message: 'Credenciales no válidas' })
   }

   reiniciarTasa(claveIp)
   reiniciarTasa(claveEmail)

   await setUserSession(event, {
      user: {
         tipo: 'estudiante',
         email: estudiante.email,
         nombres: estudiante.nombres,
         apellidoPaterno: estudiante.apellidoPaterno,
         apellidoMaterno: estudiante.apellidoMaterno,
      },
   })
   return { ok: true }
})
