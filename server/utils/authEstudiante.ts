import type { H3Event } from 'h3'

// Guard de sesión para endpoints del portal de estudiantes — hermano de `requierePermiso`
// (server/utils/permisos.ts), pero sin tabla de permisos: un TtEstudiante no tiene rol, así
// que basta con que la sesión sea de tipo 'estudiante' y siga existiendo en la BD. Revalida
// contra la BD en cada request (no solo la cookie) por el mismo motivo que `requierePermiso`:
// un estudiante borrado no debe poder seguir usando una sesión ya abierta.
export async function requiereSesionEstudiante(event: H3Event) {
   const { user } = await getUserSession(event)
   if (!user) throw createError({ statusCode: 401, message: 'No autenticado' })

   const { tipo, email } = user as { tipo?: string; email: string }
   if (tipo !== 'estudiante') throw createError({ statusCode: 401, message: 'No autenticado' })
   const estudiante = await prisma.ttEstudiante.findUnique({ where: { email } })
   if (!estudiante) {
      await clearUserSession(event)
      throw createError({ statusCode: 401, message: 'Sesión no válida' })
   }

   return estudiante
}
