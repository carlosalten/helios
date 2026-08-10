// Resumen de reservas para /reservas/resumen: todas las reservas (de cualquier sala, sin
// acotar por carrera ni por sala a cargo — mismo criterio de solo-lectura que /reservas/
// horario) dentro de la ventana que cubre hoy, la semana y el mes actuales. El front agrupa
// por tipo de reserva y arma las 3 listas (hoy/semana/mes); acá solo se calculan los rangos
// de fecha y se trae la data cruda.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/reservas/resumen', 'ver')

   const query = getQuery(event)
   const hoyISO = typeof query.hoy === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.hoy) ? query.hoy : null
   if (!hoyISO) throw createError({ statusCode: 422, message: 'Falta la fecha de hoy (?hoy=YYYY-MM-DD)' })

   const hoy = new Date(`${hoyISO}T00:00:00.000Z`)

   // Semana ISO: lunes a domingo.
   const diaSemana = hoy.getUTCDay() === 0 ? 7 : hoy.getUTCDay()
   const inicioSemana = new Date(hoy)
   inicioSemana.setUTCDate(inicioSemana.getUTCDate() - (diaSemana - 1))
   const finSemana = new Date(inicioSemana)
   finSemana.setUTCDate(finSemana.getUTCDate() + 6)

   const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1))
   const finMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0))

   // La ventana a traer cubre semana y mes juntos: cerca del cambio de mes, la semana puede
   // empezar o terminar fuera del mes actual.
   const rangoDesde = inicioSemana < inicioMes ? inicioSemana : inicioMes
   const rangoHasta = finSemana > finMes ? finSemana : finMes

   const reservas = await prisma.reserva.findMany({
      where: { fecha: { gte: rangoDesde, lte: rangoHasta } },
      select: {
         id: true,
         titulo: true,
         fecha: true,
         inicio: true,
         fin: true,
         salaCodigo: true,
         persona: { select: { id: true, nombre: true, apellido: true } },
         tipoReserva: { select: { id: true, nombre: true, color: true } },
      },
      orderBy: [{ fecha: 'asc' }, { inicio: 'asc' }],
   })

   function aFechaISO(fecha: Date) {
      return fecha.toISOString().slice(0, 10)
   }
   function aHora(hora: Date) {
      return hora.toISOString().slice(11, 16)
   }

   return {
      hoy: hoyISO,
      semana: { desde: aFechaISO(inicioSemana), hasta: aFechaISO(finSemana) },
      mes: { desde: aFechaISO(inicioMes), hasta: aFechaISO(finMes) },
      reservas: reservas.map((r) => ({
         id: r.id,
         titulo: r.titulo,
         fecha: aFechaISO(r.fecha),
         inicio: aHora(r.inicio),
         fin: aHora(r.fin),
         salaCodigo: r.salaCodigo,
         persona: r.persona,
         tipoReserva: r.tipoReserva,
      })),
   }
})
