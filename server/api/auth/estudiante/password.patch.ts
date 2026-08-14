import bcrypt from 'bcryptjs'

// Cambio de contraseña propio del estudiante — mismo criterio que server/api/auth/password.patch.ts
// (staff): opera siempre sobre el email de la sesión, nunca uno recibido en el body, y exige la
// contraseña actual (no solo la sesión abierta). Mismo límite de tasa por el mismo motivo: este
// endpoint verifica una contraseña, así que es un punto para probar credenciales por fuerza bruta
// si alguien encuentra una sesión abierta.
const VENTANA_MS = 15 * 60 * 1000
const MAX_FALLOS = 5

export default defineEventHandler(async (event) => {
   const estudianteSesion = await requiereSesionEstudiante(event)

   const clave = `password-estudiante:${estudianteSesion.email}`
   const limite = excedeLimite(clave, MAX_FALLOS)
   if (!limite.permitido) {
      const minutos = Math.ceil(limite.reintentarEnSeg / 60)
      throw createError({
         statusCode: 429,
         message: `Demasiados intentos fallidos. Reintenta en ${minutos} minuto(s).`,
      })
   }

   const body = await readBody(event)
   const parsed = cambiarMiPasswordSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   // `omit: { password: false }` revierte el omit global de server/utils/prisma.ts.
   const estudiante = await prisma.ttEstudiante.findUnique({
      where: { email: estudianteSesion.email },
      omit: { password: false },
   })
   if (!estudiante) throw createError({ statusCode: 404, message: 'Estudiante no encontrado' })

   const actualValida = await bcrypt.compare(parsed.data.passwordActual, estudiante.password)
   if (!actualValida) {
      registrarFallo(clave, VENTANA_MS)
      throw createError({ statusCode: 422, message: 'La contraseña actual no es correcta' })
   }

   const hash = await bcrypt.hash(parsed.data.password, 12)
   await prisma.ttEstudiante.update({ where: { email: estudiante.email }, data: { password: hash } })

   reiniciarTasa(clave)

   return { ok: true }
})
