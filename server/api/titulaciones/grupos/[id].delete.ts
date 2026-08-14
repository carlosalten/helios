export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/grupos', 'borrar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.ttGrupo.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Grupo no encontrado' })

   const tieneEstudiantes = await prisma.ttEstudiante.findFirst({ where: { grupoId: id } })
   if (tieneEstudiantes) {
      throw createError({ statusCode: 409, message: 'No se puede eliminar: el grupo tiene estudiantes asociados' })
   }

   await prisma.ttGrupo.delete({ where: { id } })
   return { ok: true }
})
