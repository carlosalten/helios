// "Cancelar reserva": borra la fila directamente, sin marcar un estado. La constraint
// `reserva_sin_solapamiento` deja de considerar esa reserva de inmediato.
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/reservas/horario', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.reserva.findUnique({ where: { id }, include: incluirAlcanceReserva })
   if (!existe) throw createError({ statusCode: 404, message: 'Reserva no encontrada' })
   if (!(await puedeModificarReserva(usuario, existe))) {
      throw createError({ statusCode: 403, message: 'No tienes permiso para modificar esta reserva' })
   }

   await prisma.reserva.delete({ where: { id } })

   publicarEventoReserva(usuario, 'borrar', existe.salaCodigo)

   return { ok: true }
})
