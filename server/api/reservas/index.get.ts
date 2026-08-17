// Reservas de sala (no las de clases) para armar la vista de horario por sala: una sala y
// un rango de fechas a la vez (la semana visible en /reservas/horario, o cada sala elegida en
// /reservas/imprimir, que pide una por una).
export default defineEventHandler(async (event) => {
   const usuario = await requiereAlgunPermiso(event, [
      ['/reservas/horario', 'ver'],
      ['/reservas/imprimir', 'ver'],
   ])

   const query = getQuery(event)
   const salaCodigo = typeof query.salaCodigo === 'string' ? query.salaCodigo : undefined
   const desde = typeof query.desde === 'string' ? query.desde : undefined
   const hasta = typeof query.hasta === 'string' ? query.hasta : undefined
   if (!salaCodigo || !desde || !hasta) return []

   // Cualquier rol que no sea Administrador solo ve las reservas de las salas de las que es
   // encargado (EncargadoSala) — mismo alcance que /reservas/resumen (server/api/reservas/
   // resumen.get.ts) y que salasVisibles en horario.vue/imprimir.vue, que ya no ofrece elegir
   // otra sala; el backend no confía solo en eso.
   if (usuario.rol !== 'Administrador') {
      const persona = await prisma.persona.findUnique({ where: { email: usuario.email } })
      const encargado = persona
         ? await prisma.encargadoSala.findUnique({
              where: { personaId_salaCodigo: { personaId: persona.id, salaCodigo } },
           })
         : null
      if (!encargado) return []
   }

   return prisma.reserva.findMany({
      where: {
         salaCodigo,
         fecha: { gte: new Date(`${desde}T00:00:00.000Z`), lte: new Date(`${hasta}T00:00:00.000Z`) },
      },
      include: {
         sala: true,
         persona: { select: { id: true, nombre: true, apellido: true } },
         tipoReserva: true,
         // Si la reserva viene de una sesión de clases, se arrastra la asignatura y la
         // carrera para mostrarlas en el cuadro de la reserva en /reservas/horario.
         sesionParalelo: {
            include: {
               paralelo: {
                  include: { asignaturaPlan: { include: { asignatura: true, plan: { include: { carrera: true } } } } },
               },
            },
         },
      },
      orderBy: [{ fecha: 'asc' }, { inicio: 'asc' }],
   })
})
