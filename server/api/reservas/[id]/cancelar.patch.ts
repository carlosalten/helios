// Cancela (o reactiva) una reserva puntual: a diferencia de borrarla, queda visible pero
// destacada — se usa para avisar que una clase u otro uso de sala puntual no se realiza ese
// día sin perder el registro de que la sala estaba tomada. Solo afecta esta ocurrencia, nunca
// la serie completa de una reserva recurrente (no tiene el flujo "esta y las siguientes" que sí
// tienen editar/borrar — cancelar una serie completa se hace ocurrencia por ocurrencia).
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/reservas/horario', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.reserva.findUnique({ where: { id }, include: incluirAlcanceReserva })
   if (!existe) throw createError({ statusCode: 404, message: 'Reserva no encontrada' })
   if (!(await puedeModificarReserva(usuario, existe))) {
      throw createError({ statusCode: 403, message: 'No tienes permiso para modificar esta reserva' })
   }

   const reserva = await prisma.reserva.update({
      where: { id },
      data: { cancelada: !existe.cancelada },
      include: {
         sala: true,
         persona: { select: { id: true, nombre: true, apellido: true } },
         tipoReserva: true,
      },
   })

   publicarEventoReserva(usuario, 'editar', reserva.salaCodigo)

   return reserva
})
