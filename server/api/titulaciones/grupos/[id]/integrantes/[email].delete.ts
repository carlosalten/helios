// Quita a un estudiante del grupo `id` (deja su `grupoId` en null). No borra al estudiante: eso
// es DELETE /api/titulaciones/estudiantes/[email].
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/grupos', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   const email = getRouterParam(event, 'email')
   if (!Number.isInteger(id) || !email) throw createError({ statusCode: 400, message: 'Datos inválidos' })

   const estudiante = await prisma.ttEstudiante.findUnique({ where: { email } })
   if (!estudiante || estudiante.grupoId !== id) {
      throw createError({ statusCode: 404, message: 'El estudiante no pertenece a este grupo' })
   }

   await prisma.ttEstudiante.update({ where: { email }, data: { grupoId: null } })
   return { ok: true }
})
