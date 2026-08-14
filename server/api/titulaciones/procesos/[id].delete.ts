export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/procesos', 'borrar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.ttProceso.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Proceso no encontrado' })

   const [tieneEstudiantes, tieneGrupos] = await Promise.all([
      prisma.ttEstudiante.findFirst({ where: { procesoId: id } }),
      prisma.ttGrupo.findFirst({ where: { procesoId: id } }),
   ])
   if (tieneEstudiantes || tieneGrupos) {
      throw createError({
         statusCode: 409,
         message: 'No se puede eliminar: el proceso tiene estudiantes o grupos asociados',
      })
   }

   await prisma.ttProceso.delete({ where: { id } })
   return { ok: true }
})
