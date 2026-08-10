import type { EventoAgenda } from '~/types/agendaProfesor'

// Agenda semanal de un profesor: sus clases y sus reservas de sala en una sola lista.
//
// Las clases con sala asignada ya tienen una fila `Reserva` generada (ver
// server/utils/reservasSesion.ts), que además respeta los feriados y el rango del semestre. Por
// eso la base son las reservas de la persona, y las sesiones se agregan SOLO cuando no tienen
// sala: si se agregaran todas, cada clase con sala saldría dos veces. Para esas sesiones sin
// sala hay que proyectar a mano las fechas de la semana y descartar los feriados, que es lo que
// la reserva habría hecho sola.
function aISO(fecha: Date) {
   return fecha.toISOString().slice(0, 10)
}
function aHora(hora: Date) {
   return hora.toISOString().slice(11, 16)
}

export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/horario/profesor', 'ver')

   const query = getQuery(event)
   const profesorId = query.profesorId ? Number(query.profesorId) : undefined
   const semestreId = query.semestreId ? Number(query.semestreId) : undefined
   const desde = typeof query.desde === 'string' ? query.desde : undefined
   const hasta = typeof query.hasta === 'string' ? query.hasta : undefined
   if (!Number.isInteger(profesorId) || !Number.isInteger(semestreId) || !desde || !hasta) return []

   const inicioSemana = new Date(`${desde}T00:00:00.000Z`)
   const finSemana = new Date(`${hasta}T00:00:00.000Z`)

   const [reservas, sesionesSinSala, semestre, feriados] = await Promise.all([
      prisma.reserva.findMany({
         where: { personaId: profesorId, fecha: { gte: inicioSemana, lte: finSemana } },
         include: {
            tipoReserva: true,
            sesionParalelo: {
               include: {
                  paralelo: {
                     include: {
                        curso: true,
                        asignaturaPlan: { include: { asignatura: true, plan: { include: { carrera: true } } } },
                     },
                  },
               },
            },
         },
         orderBy: [{ fecha: 'asc' }, { inicio: 'asc' }],
      }),
      prisma.sesionParalelo.findMany({
         where: { profesorId, salaCodigo: null, paralelo: { curso: { semestreId } } },
         include: {
            bloques: { include: { bloque: true } },
            paralelo: {
               include: {
                  curso: true,
                  asignaturaPlan: { include: { asignatura: true, plan: { include: { carrera: true } } } },
               },
            },
         },
      }),
      prisma.semestre.findUnique({ where: { id: semestreId } }),
      prisma.feriado.findMany({ where: { semestreId } }),
   ])

   // Clave de "misma clase física": un paralelo dictado en varios cursos (ver
   // server/utils/sesionesEspejo.ts) tiene una sesión —y por lo tanto una reserva— por curso,
   // todas a la misma hora y en la misma sala. En la agenda del profesor eso es UNA sola clase:
   // se agrupan por asignatura + código de paralelo + fecha + horario, y los cursos se juntan en
   // un solo texto para que igual se vea a quiénes les hace esa clase.
   const claveClase = (e: { fecha: string; inicio: string; fin: string }, asignaturaId: number, paralelo: string) =>
      `${e.fecha}|${e.inicio}|${e.fin}|${asignaturaId}|${paralelo}`

   const eventos: EventoAgenda[] = []
   const clasesPorClave = new Map<string, { evento: EventoAgenda; cursos: Set<string> }>()

   function agregarClase(evento: EventoAgenda, asignaturaId: number, curso: string) {
      const clave = claveClase(evento, asignaturaId, evento.paraleloCodigo ?? '')
      const existente = clasesPorClave.get(clave)
      if (existente) {
         existente.cursos.add(curso)
         return
      }
      clasesPorClave.set(clave, { evento, cursos: new Set([curso]) })
      eventos.push(evento)
   }

   for (const reserva of reservas) {
      const paralelo = reserva.sesionParalelo?.paralelo
      const evento: EventoAgenda = {
         id: `r-${reserva.id}`,
         fecha: aISO(reserva.fecha),
         inicio: aHora(reserva.inicio),
         fin: aHora(reserva.fin),
         titulo: reserva.titulo,
         tipo: paralelo ? 'clase' : 'reserva',
         salaCodigo: reserva.salaCodigo,
         color: paralelo?.color ?? reserva.tipoReserva.color,
         asignatura: paralelo?.asignaturaPlan.asignatura.nombre ?? null,
         carreraCorta: paralelo?.asignaturaPlan.plan.carrera.nombreCorto ?? null,
         paraleloCodigo: paralelo?.codigo ?? null,
         cursoNombre: paralelo?.curso.nombre ?? null,
         tipoReserva: reserva.tipoReserva.nombre,
      }
      if (paralelo) agregarClase(evento, paralelo.asignaturaPlan.asignaturaId, paralelo.curso.nombre)
      else eventos.push(evento)
   }

   // Clases sin sala: no existe reserva, así que se proyectan sobre los días de la semana.
   if (semestre) {
      const feriadosPorFecha = new Map(feriados.map((f) => [aISO(f.fecha), f]))

      for (const sesion of sesionesSinSala) {
         const bloque = sesion.bloques[0]?.bloque
         if (!bloque) continue

         for (let dia = 0; dia < 7; dia++) {
            const fecha = new Date(inicioSemana.getTime() + dia * 24 * 60 * 60 * 1000)
            // getUTCDay: 0=domingo; diaSemana usa ISO (1=lunes … 7=domingo).
            const diaSemana = fecha.getUTCDay() === 0 ? 7 : fecha.getUTCDay()
            if (diaSemana !== sesion.diaSemana) continue
            // Fuera del semestre no hay clases, aunque la semana en pantalla sí exista.
            if (fecha < semestre.fechaInicio || fecha > semestre.fechaFin) continue

            const feriado = feriadosPorFecha.get(aISO(fecha))
            if (feriado && feriadoCubreBloque(feriado, bloque)) continue

            const { paralelo } = sesion
            // Pasa por el mismo agrupador: dos sesiones espejo sin sala también son una clase.
            agregarClase(
               {
                  id: `s-${sesion.id}-${aISO(fecha)}`,
                  fecha: aISO(fecha),
                  inicio: aHora(bloque.inicio),
                  fin: aHora(bloque.fin),
                  titulo: `${paralelo.asignaturaPlan.asignatura.codigo} · ${paralelo.codigo}`,
                  tipo: 'clase',
                  salaCodigo: null,
                  color: paralelo.color,
                  asignatura: paralelo.asignaturaPlan.asignatura.nombre,
                  carreraCorta: paralelo.asignaturaPlan.plan.carrera.nombreCorto,
                  paraleloCodigo: paralelo.codigo,
                  cursoNombre: paralelo.curso.nombre,
                  // No hay fila `Reserva` (la sesión no tiene sala), pero es una clase igual:
                  // se rotula como tal para que la vista la trate como al resto de las clases.
                  tipoReserva: 'Clase',
               },
               paralelo.asignaturaPlan.asignaturaId,
               paralelo.curso.nombre
            )
         }
      }
   }

   // Recién ahora se sabe en cuántos cursos se dicta cada clase.
   for (const { evento, cursos } of clasesPorClave.values()) {
      evento.cursoNombre = [...cursos].sort().join(', ')
   }

   return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio.localeCompare(b.inicio))
})
