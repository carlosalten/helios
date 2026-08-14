export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/lineas-investigacion', 'borrar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.ttLineaInvestigacion.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Línea de investigación no encontrada' })

   const [tienePropuestas, tieneProfesores] = await Promise.all([
      prisma.ttPropuesta.findFirst({ where: { lineaInvestigacionId: id } }),
      prisma.ttLineaInvestigacionProfesor.findFirst({ where: { lineaInvestigacionId: id } }),
   ])
   if (tienePropuestas || tieneProfesores) {
      throw createError({
         statusCode: 409,
         message: 'No se puede eliminar: la línea de investigación tiene propuestas o profesores asociados',
      })
   }

   await prisma.ttLineaInvestigacion.delete({ where: { id } })
   return { ok: true }
})
