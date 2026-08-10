export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/reservas/tipos', 'borrar')

   const id = Number(getRouterParam(event, 'id'))
   if (isNaN(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const reservas = await prisma.reserva.count({ where: { tipoReservaId: id } })
   if (reservas > 0)
      throw createError({ statusCode: 409, message: 'No se puede eliminar: hay reservas con este tipo asignado' })

   await prisma.tipoReserva.delete({ where: { id } })
   return { ok: true }
})
