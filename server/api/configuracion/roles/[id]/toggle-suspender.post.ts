// Alterna si las personas de un rol pueden suspender/reactivar CUALQUIER reserva en
// /reservas/horario, no solo las propias (Rol.suspenderCualquierReserva) — ver
// server/utils/alcanceReservas.ts (`puedeSuspenderReserva`). Igual que el toggle de
// mostrarEnHorarioProfesores, sin alcance por carrera que chequear: los roles son globales.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/configuracion', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const rol = await prisma.rol.findUnique({ where: { id } })
   if (!rol) throw createError({ statusCode: 404, message: 'Rol no encontrado' })

   const actualizado = await prisma.rol.update({
      where: { id },
      data: { suspenderCualquierReserva: !rol.suspenderCualquierReserva },
      select: { suspenderCualquierReserva: true },
   })

   return { suspenderCualquierReserva: actualizado.suspenderCualquierReserva }
})
