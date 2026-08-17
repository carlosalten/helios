// Borrado en cascada: una propuesta puede tener historial de estados (tt_estado) y comisión
// asignada (tt_comision), ninguna de las dos con ON DELETE CASCADE en la BD (RESTRICT), así que
// hay que borrarlas primero, en la misma transacción.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/propuestas', 'borrar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const propuesta = await prisma.ttPropuesta.findUnique({ where: { id } })
   if (!propuesta) throw createError({ statusCode: 404, message: 'Propuesta no encontrada' })

   await prisma.$transaction([
      prisma.ttEstado.deleteMany({ where: { propuestaId: id } }),
      prisma.ttComision.deleteMany({ where: { propuestaId: id } }),
      prisma.ttPropuesta.delete({ where: { id } }),
   ])

   return { ok: true }
})
