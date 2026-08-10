import bcrypt from 'bcryptjs'

// Cambio de contraseña propio. Es de los pocos endpoints "solo sesión" (como permisos/mios.get):
// no lleva `requierePermiso` a propósito, porque cualquier usuario autenticado tiene que poder
// cambiar su contraseña sea cual sea su rol, y no existe una ruta de permiso que lo represente.
// Siempre opera sobre la persona de la sesión: el id nunca viaja en el body, así que no se puede
// usar para tocarle la contraseña a otro.
//
// Verifica la contraseña actual, así que es un punto donde se pueden probar credenciales: lleva
// el mismo límite de tasa que el login para que no sirva de oráculo si alguien encuentra una
// sesión abierta.
const VENTANA_MS = 15 * 60 * 1000
const MAX_FALLOS = 5

export default defineEventHandler(async (event) => {
   const { user } = await getUserSession(event)
   if (!user) throw createError({ statusCode: 401, message: 'No autenticado' })
   const { email } = user as { email: string }

   const clave = `password:${email}`
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

   // `omit: { password: false }` revierte el omit global de server/utils/prisma.ts, que por
   // defecto deja el hash fuera de toda query.
   const persona = await prisma.persona.findUnique({ where: { email }, omit: { password: false } })
   // Sin contraseña asignada no hay cuenta de acceso que cambiar (persona solo de agenda).
   if (!persona || !persona.password) {
      throw createError({ statusCode: 404, message: 'La cuenta no tiene una contraseña asignada' })
   }

   const actualValida = await bcrypt.compare(parsed.data.passwordActual, persona.password)
   if (!actualValida) {
      registrarFallo(clave, VENTANA_MS)
      throw createError({ statusCode: 422, message: 'La contraseña actual no es correcta' })
   }

   const hash = await bcrypt.hash(parsed.data.password, 12)
   await prisma.persona.update({ where: { id: persona.id }, data: { password: hash } })

   reiniciarTasa(clave)

   return { ok: true }
})
