// Edita "esta reserva y las siguientes": aplica sala/título/horario/tipo/persona a la reserva
// seleccionada y a todas las de su misma serie con fecha posterior (cada una conserva su
// propia fecha — solo la seleccionada puede cambiar de fecha).
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/reservas/horario', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.reserva.findUnique({ where: { id }, include: incluirAlcanceReserva })
   if (!existe) throw createError({ statusCode: 404, message: 'Reserva no encontrada' })
   if (!existe.serieId)
      throw createError({ statusCode: 422, message: 'La reserva no es parte de una serie recurrente' })
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

   const camposComunes = {
      salaCodigo: parsed.data.salaCodigo,
      titulo: parsed.data.titulo,
      inicio: parsed.data.inicio,
      fin: parsed.data.fin,
      tipoReservaId: parsed.data.tipoReservaId,
      personaId: parsed.data.personaId,
      imprimir: parsed.data.imprimir,
   }

   await prisma.$transaction([
      prisma.reserva.update({ where: { id }, data: { ...camposComunes, fecha: parsed.data.fecha } }),
      prisma.reserva.updateMany({
         where: { serieId: existe.serieId, id: { not: id }, fecha: { gt: existe.fecha } },
         data: camposComunes,
      }),
   ])

   publicarEventoReserva(usuario, 'editar', parsed.data.salaCodigo)

   return { ok: true }
})
