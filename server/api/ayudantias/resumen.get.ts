// Resumen de ayudantías para /ayudantias/resumen: una fila por ayudantía (agrupando las N
// ocurrencias semanales de una misma serie recurrente en una sola), con la carrera/plan,
// asignatura, paralelo, ayudante, sala y horario. Solo incluye reservas creadas desde
// /ayudantias (paraleloId no nulo) — una "Ayudantía" creada a mano desde /reservas/horario,
// sin pasar por esa cascada, no tiene carrera/asignatura/paralelo que mostrar acá.
//
// Alcance: igual que /reservas/resumen (server/api/reservas/resumen.get.ts) — acotado a las
// salas asignadas (EncargadoSala) para cualquier rol que no sea Administrador, que ve las de
// todas las salas. Es información agregada, no una vista operativa.
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/ayudantias/resumen', 'ver')

   let salasPermitidas: string[] | null = null
   if (usuario.rol !== 'Administrador') {
      const persona = await prisma.persona.findUnique({ where: { email: usuario.email } })
      const encargos = persona
         ? await prisma.encargadoSala.findMany({ where: { personaId: persona.id }, select: { salaCodigo: true } })
         : []
      salasPermitidas = encargos.map((e) => e.salaCodigo)
   }

   const reservas = await prisma.reserva.findMany({
      where: {
         paraleloId: { not: null },
         ...(salasPermitidas && { salaCodigo: { in: salasPermitidas } }),
      },
      select: {
         id: true,
         serieId: true,
         salaCodigo: true,
         fecha: true,
         inicio: true,
         fin: true,
         persona: { select: { id: true, nombre: true, apellido: true } },
         paralelo: {
            select: {
               codigo: true,
               asignaturaPlan: {
                  select: {
                     asignatura: { select: { codigo: true, nombre: true, nombreCorto: true } },
                     plan: {
                        select: {
                           id: true,
                           numero: true,
                           carreraCodigo: true,
                           carrera: { select: { nombre: true, nombreCorto: true } },
                        },
                     },
                  },
               },
            },
         },
      },
      orderBy: { fecha: 'asc' },
   })

   function aHora(hora: Date) {
      return hora.toISOString().slice(11, 16)
   }
   // ISO: 1 = Lunes … 7 = Domingo (mismo criterio que DIAS_SEMANA en app/types/dia.ts).
   function diaSemanaISO(fecha: Date) {
      const dia = fecha.getUTCDay()
      return dia === 0 ? 7 : dia
   }

   // Una ayudantía recurrente genera una fila por semana, todas con el mismo serieId: acá se
   // colapsan en una sola, usando la ocurrencia más antigua como representante (día/hora son
   // los mismos en todas las ocurrencias, así que da lo mismo cuál se use). Una reserva sin
   // serieId (no debería pasar para una Ayudantía creada desde /ayudantias, que siempre es
   // recurrente, pero se tolera) queda en su propio grupo.
   const porSerie = new Map<string, (typeof reservas)[number]>()
   for (const r of reservas) {
      const clave = r.serieId ?? `sola-${r.id}`
      if (!porSerie.has(clave)) porSerie.set(clave, r)
   }

   return Array.from(porSerie.values())
      .filter((r) => r.paralelo != null)
      .map((r) => {
         const paralelo = r.paralelo!
         const asignatura = paralelo.asignaturaPlan.asignatura
         const plan = paralelo.asignaturaPlan.plan
         return {
            reservaId: r.id,
            serieId: r.serieId,
            carreraNombre: plan.carrera.nombre,
            carreraCodigo: plan.carreraCodigo,
            planId: plan.id,
            planNumero: plan.numero,
            asignaturaCodigo: asignatura.codigo,
            asignaturaNombre: asignatura.nombreCorto ?? asignatura.nombre,
            paraleloCodigo: paralelo.codigo,
            ayudanteNombre: r.persona ? `${r.persona.nombre} ${r.persona.apellido}` : null,
            salaCodigo: r.salaCodigo,
            diaSemana: diaSemanaISO(r.fecha),
            inicio: aHora(r.inicio),
            fin: aHora(r.fin),
         }
      })
      .sort(
         (a, b) =>
            a.carreraNombre.localeCompare(b.carreraNombre) ||
            a.asignaturaCodigo.localeCompare(b.asignaturaCodigo) ||
            a.paraleloCodigo.localeCompare(b.paraleloCodigo)
      )
})
