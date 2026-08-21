// Borra "esta reserva y las siguientes": la seleccionada y todas las de su misma serie con
// fecha igual o posterior.
export default defineEventHandler(async (event) => {
   const usuario = await requiereAlgunPermiso(event, [
      ['/reservas/horario', 'editar'],
      ['/ayudantias', 'editar'],
   ])

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.reserva.findUnique({ where: { id }, include: incluirAlcanceReserva })
   if (!existe) throw createError({ statusCode: 404, message: 'Reserva no encontrada' })
   if (!existe.serieId)
      throw createError({ statusCode: 422, message: 'La reserva no es parte de una serie recurrente' })
   if (!(await puedeModificarReserva(usuario, existe))) {
      throw createError({ statusCode: 403, message: 'No tienes permiso para modificar esta reserva' })
   }

   await prisma.reserva.deleteMany({ where: { serieId: existe.serieId, fecha: { gte: existe.fecha } } })

   publicarEventoReserva(usuario, 'borrar', existe.salaCodigo)

   return { ok: true }
})
