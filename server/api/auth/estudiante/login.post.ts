import bcrypt from 'bcryptjs'
import { z } from 'zod'

// Login del portal de estudiantes: verifica credenciales contra TtEstudiante (tabla propia,
// separada de Persona — ver comentario en schema.prisma) y crea la misma sesión Nuxt que el
// login de staff, pero con `tipo: 'estudiante'`. Misma política anti fuerza bruta que
// server/api/auth/login.post.ts (server/utils/limiteLogin.ts), con contadores propios.
const LoginSchema = z.object({
   email: z.string().trim().toLowerCase().email(),
   password: z.string().min(1),
   turnstileToken: z.string().optional(),
})

export default defineEventHandler(async (event) => {
   const body = await readBody(event)
   const result = LoginSchema.safeParse(body)
   if (!result.success) throw createError({ statusCode: 401, message: 'Credenciales no válidas' })

   const { email, password, turnstileToken } = result.data

   // Prefijo propio para no compartir contadores con el login de staff.
   const limite = crearLimiteLogin('login-estudiante', ipDelCliente(event), email)
   limite.verificarCuentaNoBloqueada()
   await limite.exigirCaptchaSiCorresponde(event, turnstileToken)

   const estudiante = await prisma.ttEstudiante.findUnique({ where: { email }, omit: { password: false } })
   if (!estudiante) {
      limite.anotarFallo()
      throw createError({ statusCode: 401, message: 'Credenciales no válidas' })
   }

   const passwordValido = await bcrypt.compare(password, estudiante.password)
   if (!passwordValido) {
      limite.anotarFallo()
      throw createError({ statusCode: 401, message: 'Credenciales no válidas' })
   }

   limite.anotarExito()

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
