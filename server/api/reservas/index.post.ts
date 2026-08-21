export default defineEventHandler(async (event) => {
   const usuario = await requiereAlgunPermiso(event, [
      ['/reservas/horario', 'crear'],
      ['/ayudantias', 'crear'],
   ])

   const body = await readBody(event)
   const parsed = crearReservaSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const [sala, persona, tipoReserva, paralelo] = await Promise.all([
      prisma.sala.findUnique({ where: { codigo: parsed.data.salaCodigo } }),
      // personaId nulo = reserva sin responsable designado: no hay a quién buscar.
      parsed.data.personaId == null ? null : prisma.persona.findUnique({ where: { id: parsed.data.personaId } }),
      prisma.tipoReserva.findUnique({ where: { id: parsed.data.tipoReservaId } }),
      // paraleloId nulo = reserva que no es una Ayudantía: no hay a quién buscar.
      parsed.data.paraleloId == null ? null : prisma.paralelo.findUnique({ where: { id: parsed.data.paraleloId } }),
   ])
   if (!sala) throw createError({ statusCode: 404, message: 'Sala no encontrada' })
   if (parsed.data.personaId != null && !persona)
      throw createError({ statusCode: 404, message: 'Persona no encontrada' })
   if (!tipoReserva) throw createError({ statusCode: 404, message: 'Tipo de reserva no encontrado' })
   if (parsed.data.paraleloId != null && !paralelo) throw createError({ statusCode: 404, message: 'Paralelo no encontrado' })

   const reserva = await prisma.reserva.create({
      data: parsed.data,
      include: {
         sala: true,
         persona: { select: { id: true, nombre: true, apellido: true } },
         tipoReserva: true,
      },
   })

   publicarEventoReserva(usuario, 'crear', reserva.salaCodigo)

   return reserva
})
