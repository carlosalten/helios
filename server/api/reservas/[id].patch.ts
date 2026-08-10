// Edita una reserva por completo: se usa tanto desde el modal de edición como al mover una
// reserva por drag and drop (mismo payload, solo cambian fecha/inicio/fin).
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/reservas/horario', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.reserva.findUnique({ where: { id }, include: incluirAlcanceReserva })
   if (!existe) throw createError({ statusCode: 404, message: 'Reserva no encontrada' })
   if (!(await puedeModificarReserva(usuario, existe))) {
      throw createError({ statusCode: 403, message: 'No tienes permiso para modificar esta reserva' })
   }

   const body = await readBody(event)
   const parsed = crearReservaSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const [sala, persona, tipoReserva] = await Promise.all([
      prisma.sala.findUnique({ where: { codigo: parsed.data.salaCodigo } }),
      // personaId nulo = reserva sin responsable designado: no hay a quién buscar.
      parsed.data.personaId == null ? null : prisma.persona.findUnique({ where: { id: parsed.data.personaId } }),
      prisma.tipoReserva.findUnique({ where: { id: parsed.data.tipoReservaId } }),
   ])
   if (!sala) throw createError({ statusCode: 404, message: 'Sala no encontrada' })
   if (parsed.data.personaId != null && !persona)
      throw createError({ statusCode: 404, message: 'Persona no encontrada' })
   if (!tipoReserva) throw createError({ statusCode: 404, message: 'Tipo de reserva no encontrado' })

   const reserva = await prisma.reserva.update({
      where: { id },
      data: parsed.data,
      include: {
         sala: true,
         persona: { select: { id: true, nombre: true, apellido: true } },
         tipoReserva: true,
      },
   })

   publicarEventoReserva(usuario, 'editar', reserva.salaCodigo)

   return reserva
})
