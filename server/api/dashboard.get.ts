// Resumen que alimenta la portada (`/`).
//
// Solo exige sesión, sin chequeo contra la tabla `permiso`: `/` está en
// RUTAS_SIN_RESTRICCION (app/middleware/auth.global.ts), así que cualquier usuario
// autenticado llega acá y necesita ver algo.
//
// Hay dos formas del resumen (ver server/utils/alcanceDashboard.ts):
//   - 'global'   — indicadores de todo el sistema; solo el Administrador.
//   - 'personal' — acotado a las carreras y salas de la persona; el resto de los roles, y el
//                  Administrador cuando pide `?modo=personal`.
// La diferencia es solo el alcance de los números: la estructura de la respuesta es la misma,
// más `misCarreras`/`misSalas`, que se llenan únicamente en modo personal.
//
// La fecha de "hoy" llega del cliente (`?hoy=YYYY-MM-DD`) en vez de calcularse acá, igual
// que en /api/horario/profesor: así el día mostrado es el del usuario y no el del servidor.

interface ResumenAgenda {
   inicio: string
   fin: string
   titulo: string
   detalle: string | null
   salaCodigo: string | null
   color: string | null
   esClase: boolean
}

// Forma mínima de paralelo que necesita `calcularIndicadoresHoy` — la satisfacen tanto el
// select de `sesiones` (acotado por carrera) como el de `sesionesSalaPropiaHoy` (por sala).
interface SesionParaIndicador {
   codigo: string
   cursoId: number
   asignaturaPlan: { asignaturaId: number }
}

function aISO(fecha: Date) {
   return fecha.toISOString().slice(0, 10)
}
function aHora(hora: Date) {
   return hora.toISOString().slice(11, 16)
}

export default defineEventHandler(async (event) => {
   const { user } = await getUserSession(event)
   if (!user) throw createError({ statusCode: 401, message: 'No autenticado' })
   const usuario = user as { email: string; rol: string }

   const query = getQuery(event)
   const hoyISO = typeof query.hoy === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.hoy) ? query.hoy : null
   if (!hoyISO) throw createError({ statusCode: 422, message: 'Falta la fecha de hoy (?hoy=YYYY-MM-DD)' })

   // Hora del cliente (`?ahora=HH:MM`), por el mismo motivo que la fecha: el reloj que importa
   // es el del usuario. Se usa solo para descartar las clases de hoy que ya terminaron; si no
   // viene, se asume el inicio del día y se muestran todas las de hoy en adelante.
   const ahoraHHMM = typeof query.ahora === 'string' && /^\d{2}:\d{2}$/.test(query.ahora) ? query.ahora : '00:00'

   const hoy = new Date(`${hoyISO}T00:00:00.000Z`)
   // getUTCDay: 0=domingo; diaSemana usa ISO (1=lunes … 7=domingo), como en el resto de la app.
   const diaSemana = hoy.getUTCDay() === 0 ? 7 : hoy.getUTCDay()

   const alcance = await resolverAlcanceDashboard(usuario, typeof query.modo === 'string' ? query.modo : undefined)
   const esPersonal = alcance.modo === 'personal'
   const filtroCarrera = alcance.carreras ? { in: alcance.carreras } : undefined
   // En modo personal las salas propias acotan la ocupación y el conteo de salas; en global no
   // hay restricción. Un Set para filtrar en memoria lo que ya se trajo por otra razón.
   const salasPropias = alcance.salas ? new Set(alcance.salas) : null

   // Acotación de los 4 indicadores "hoy" (clases, reservas, cursos y profesores con clase):
   // Apoyo Docente se basa en sus salas a cargo (EncargadoSala); Jefe de Carrera, solo en las
   // carreras que dirige (no en las que además tenga asignadas); el resto de los roles, en las
   // carreras a las que están asociados. En modo global (solo Administrador) no hay acotación.
   const esApoyoDocente = usuario.rol === 'Apoyo Docente'
   const esJefeDeCarrera = usuario.rol === 'Jefe de Carrera'
   const salasIndicadoresHoy = esPersonal && esApoyoDocente ? new Set(alcance.salasACargo) : null
   const carrerasIndicadoresHoy =
      esPersonal && !esApoyoDocente
         ? new Set(esJefeDeCarrera ? alcance.carrerasQueDirige : (alcance.carreras ?? []))
         : null

   const alcanceRespuesta = {
      modo: alcance.modo,
      puedeCambiarModo: alcance.puedeCambiarModo,
   }

   const semestre = await prisma.semestre.findFirst({ where: { vigente: true } })

   // Sin semestre vigente no hay nada que resumir: la portada muestra su propio vacío.
   if (!semestre) {
      const [carreras, salas, personas] = await Promise.all([
         prisma.carrera.count({ where: filtroCarrera ? { codigo: filtroCarrera } : undefined }),
         alcance.salas ? Promise.resolve(alcance.salas.length) : prisma.sala.count(),
         prisma.persona.count({ where: { activo: true } }),
      ])
      return {
         alcance: alcanceRespuesta,
         semestre: null,
         hoy: {
            fecha: hoyISO,
            diaSemana,
            feriado: null,
            clases: 0,
            reservas: 0,
            cursosConClase: 0,
            profesoresConClase: 0,
         },
         totales: { carreras, paralelos: 0, salas, personasActivas: personas },
         planificacion: null,
         miAgenda: [],
         salasOcupadasHoy: [],
         proximosFeriados: [],
         misCarreras: [],
         misSalas: [],
         proximasClases: [],
         proximasReservas: [],
      }
   }

   const dondeCurso = filtroCarrera
      ? { semestreId: semestre.id, plan: { carreraCodigo: filtroCarrera } }
      : { semestreId: semestre.id }

   const [
      sesiones,
      sesionesSalaPropiaHoy,
      reservasHoy,
      feriados,
      bloques,
      carrerasDelAlcance,
      cursosDelAlcance,
      paralelosDelAlcance,
      salas,
      personasActivas,
      proximasClasesRaw,
      proximasReservasRaw,
   ] = await Promise.all([
      prisma.sesionParalelo.findMany({
         where: { paralelo: { curso: dondeCurso } },
         select: {
            id: true,
            diaSemana: true,
            tipo: true,
            salaCodigo: true,
            profesorId: true,
            bloques: { select: { bloqueId: true } },
            paralelo: {
               select: {
                  id: true,
                  codigo: true,
                  color: true,
                  cursoId: true,
                  asignaturaPlan: {
                     select: {
                        asignaturaId: true,
                        plan: { select: { carreraCodigo: true } },
                        asignatura: {
                           select: { codigo: true, nombre: true, bloquesTeoria: true, bloquesPractica: true },
                        },
                     },
                  },
               },
            },
         },
      }),
      // Sesiones de hoy en las salas a cargo, SIN acotar por carrera: para Apoyo Docente `sesiones`
      // (arriba) suele venir vacío porque no tiene carreras asociadas, y sus indicadores "hoy" se
      // basan en la sala, no en la carrera. Solo se pide cuando hace falta.
      esApoyoDocente && salasIndicadoresHoy
         ? prisma.sesionParalelo.findMany({
              where: {
                 diaSemana,
                 salaCodigo: { in: [...salasIndicadoresHoy] },
                 paralelo: { curso: { semestreId: semestre.id } },
              },
              select: {
                 profesorId: true,
                 bloques: { select: { bloqueId: true } },
                 paralelo: {
                    select: { codigo: true, cursoId: true, asignaturaPlan: { select: { asignaturaId: true } } },
                 },
              },
           })
         : Promise.resolve([]),
      // Todas las reservas del día: `miAgenda` necesita las del usuario sin importar la sala,
      // así que el acote por sala propia se hace después, en memoria.
      prisma.reserva.findMany({
         where: { fecha: hoy },
         select: {
            id: true,
            titulo: true,
            inicio: true,
            fin: true,
            salaCodigo: true,
            personaId: true,
            tipoReserva: { select: { nombre: true, color: true } },
            sesionParalelo: {
               select: {
                  paralelo: {
                     select: {
                        codigo: true,
                        color: true,
                        cursoId: true,
                        asignaturaPlan: {
                           select: {
                              asignaturaId: true,
                              plan: { select: { carreraCodigo: true } },
                              asignatura: { select: { nombre: true } },
                           },
                        },
                     },
                  },
               },
            },
         },
         orderBy: { inicio: 'asc' },
      }),
      prisma.feriado.findMany({ where: { semestreId: semestre.id }, orderBy: { fecha: 'asc' } }),
      prisma.bloque.findMany({ where: { semestreId: semestre.id }, select: { id: true, inicio: true, fin: true } }),
      prisma.carrera.findMany({
         where: filtroCarrera ? { codigo: filtroCarrera } : undefined,
         select: { codigo: true, nombre: true, nombreCorto: true },
         orderBy: { nombre: 'asc' },
      }),
      prisma.curso.findMany({
         where: dondeCurso,
         select: { id: true, plan: { select: { carreraCodigo: true } } },
      }),
      prisma.paralelo.findMany({
         where: { curso: dondeCurso },
         select: { id: true, curso: { select: { plan: { select: { carreraCodigo: true } } } } },
      }),
      // En modo personal el "total de salas" son las que la persona tiene a cargo.
      alcance.salas
         ? prisma.sala.findMany({
              where: { codigo: { in: alcance.salas } },
              select: { codigo: true, capacidad: true, tipoSala: { select: { nombre: true } } },
              orderBy: { codigo: 'asc' },
           })
         : prisma.sala.findMany({
              select: { codigo: true, capacidad: true, tipoSala: { select: { nombre: true } } },
              orderBy: { codigo: 'asc' },
           }),
      prisma.persona.count({ where: { activo: true } }),
      // Próximas clases en las salas a cargo de la persona. Se leen de `Reserva` y no de
      // `SesionParalelo` porque la sesión es una plantilla semanal (día + bloque, sin fecha):
      // la reserva ya está fechada y, al generarse, omite los feriados (ver reservasSesion.ts),
      // así que lo que sale acá son clases que de verdad ocurren. Con `salasACargo` vacío el
      // `in: []` no devuelve nada y la portada muestra su estado vacío.
      prisma.reserva.findMany({
         where: {
            sesionParaleloId: { not: null },
            salaCodigo: { in: alcance.salasACargo },
            // Hoy solo las que aún no terminan; de mañana en adelante, todas.
            OR: [{ fecha: { gt: hoy } }, { fecha: hoy, fin: { gt: new Date(`1970-01-01T${ahoraHHMM}:00.000Z`) } }],
         },
         select: {
            fecha: true,
            inicio: true,
            fin: true,
            salaCodigo: true,
            sesionParalelo: {
               select: {
                  profesor: { select: { nombre: true, apellido: true } },
                  paralelo: {
                     select: {
                        codigo: true,
                        color: true,
                        asignaturaPlan: {
                           select: {
                              asignaturaId: true,
                              asignatura: { select: { codigo: true, nombre: true } },
                              plan: { select: { carrera: { select: { nombre: true, nombreCorto: true } } } },
                           },
                        },
                     },
                  },
               },
            },
         },
         orderBy: [{ fecha: 'asc' }, { inicio: 'asc' }],
         // De sobra para poder deduplicar los paralelos espejo y quedarse con las primeras.
         take: 40,
      }),
      // Próximas reservas de sala que NO son de clase (sesionParaleloId nulo): ayudantías,
      // reuniones, eventos, etc. Mismo criterio de alcance y de "aún no termina" que las
      // próximas clases, pero sin necesidad de deduplicar por paralelo espejo — cada fila ya es
      // una ocurrencia real y distinta.
      prisma.reserva.findMany({
         where: {
            sesionParaleloId: null,
            salaCodigo: { in: alcance.salasACargo },
            OR: [{ fecha: { gt: hoy } }, { fecha: hoy, fin: { gt: new Date(`1970-01-01T${ahoraHHMM}:00.000Z`) } }],
         },
         select: {
            fecha: true,
            inicio: true,
            fin: true,
            salaCodigo: true,
            titulo: true,
            tipoReserva: { select: { nombre: true, color: true } },
            persona: { select: { nombre: true, apellido: true } },
         },
         orderBy: [{ fecha: 'asc' }, { inicio: 'asc' }],
         take: 6,
      }),
   ])

   const bloquePorId = new Map(bloques.map((b) => [b.id, b]))
   const feriadoHoy = feriados.find((f) => aISO(f.fecha) === hoyISO) ?? null

   // Cuenta tramos de bloques contiguos: una clase de 3 horas son 4 bloques de 45 min seguidos,
   // pero es UNA clase, no cuatro. Un bloque es contiguo al anterior cuando su inicio coincide
   // con el fin del bloque previo. La usan tanto "clases de hoy" (sobre SesionParalelo, abajo)
   // como "eventos de sala" (sobre Reserva, más adelante).
   function contarTramosContiguos(bloqueIds: Iterable<number>) {
      const ordenados = [...bloqueIds]
         .map((id) => bloquePorId.get(id))
         .filter((b): b is (typeof bloques)[number] => !!b)
         .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
      let tramos = 0
      let finAnterior: number | null = null
      for (const bloque of ordenados) {
         if (finAnterior === null || bloque.inicio.getTime() !== finAnterior) tramos++
         finAnterior = bloque.fin.getTime()
      }
      return tramos
   }

   // Cuenta clases físicas y reservas sueltas de una lista de reservas de hoy (de una sala o de
   // varias). Dos cosas se deduplican: las copias del mismo paralelo espejo a la misma hora (ver
   // sesionesEspejo.ts) y los bloques contiguos del mismo paralelo en la misma sala (una clase de
   // varios bloques, igual que `contarTramosContiguos`). Las reservas sueltas (sin sesión) no se
   // fusionan aunque queden pegadas: cada una es un evento real e independiente.
   function contarEventosSala(lista: typeof reservasHoy) {
      const intervalosPorClase = new Map<string, Map<number, number>>()
      let reservas = 0
      for (const reserva of lista) {
         const paralelo = reserva.sesionParalelo?.paralelo
         if (!paralelo) {
            reservas++
            continue
         }
         const clave = `${reserva.salaCodigo}-${paralelo.asignaturaPlan.asignaturaId}-${paralelo.codigo}`
         const intervalos = intervalosPorClase.get(clave) ?? new Map<number, number>()
         intervalos.set(reserva.inicio.getTime(), reserva.fin.getTime())
         intervalosPorClase.set(clave, intervalos)
      }
      let clases = 0
      for (const intervalos of intervalosPorClase.values()) {
         const ordenados = [...intervalos.entries()].sort(([a], [b]) => a - b)
         let finAnterior: number | null = null
         for (const [inicioMs, finMs] of ordenados) {
            if (finAnterior === null || inicioMs !== finAnterior) clases++
            finAnterior = finMs
         }
      }
      return { clases, reservas }
   }

   /* ── Clases de hoy ─────────────────────────────────────────────────────
      Un mismo paralelo dictado en varios cursos (ver server/utils/sesionesEspejo.ts) tiene una
      sesión por curso, pero es UNA sola clase física. Se deduplica con la misma clave que usa
      el informe de bloques por profesor: asignatura + código de paralelo + día + bloque. */
   const claveClaseFisica = (s: (typeof sesiones)[number], bloqueId: number) =>
      `${s.paralelo.asignaturaPlan.asignaturaId}-${s.paralelo.codigo}-${s.diaSemana}-${bloqueId}`

   // Clases, cursos y profesores con clase hoy, sobre una lista de sesiones ya acotada (por sala
   // o por carrera, según el rol — ver más abajo). Además de deduplicar por paralelo espejo, los
   // bloques contiguos del mismo paralelo (una clase de varias horas) son una sola clase — se
   // agrupan por asignatura+paralelo y se cuentan los tramos contiguos, no los bloques sueltos.
   function calcularIndicadoresHoy(
      lista: { profesorId: number | null; bloques: { bloqueId: number }[]; paralelo: SesionParaIndicador }[]
   ) {
      const bloquesPorClase = new Map<string, Set<number>>()
      const cursos = new Set<number>()
      const profesores = new Set<number>()
      for (const sesion of lista) {
         const clave = `${sesion.paralelo.asignaturaPlan.asignaturaId}-${sesion.paralelo.codigo}`
         const bloqueIds = bloquesPorClase.get(clave) ?? new Set<number>()
         for (const { bloqueId } of sesion.bloques) bloqueIds.add(bloqueId)
         bloquesPorClase.set(clave, bloqueIds)
         cursos.add(sesion.paralelo.cursoId)
         if (sesion.profesorId) profesores.add(sesion.profesorId)
      }
      let clases = 0
      for (const bloqueIds of bloquesPorClase.values()) clases += contarTramosContiguos(bloqueIds)
      return { clases, cursos: cursos.size, profesores: profesores.size }
   }

   // Apoyo Docente se acota por sala (`sesionesSalaPropiaHoy`, ya sin filtro de carrera); el
   // resto de los roles se acota filtrando `sesiones` (ya trae hoy sus carreras o más, según el
   // rol) por la carrera exacta que corresponde — para Jefe de Carrera, solo las que dirige.
   const sesionesIndicadoresHoy = esApoyoDocente
      ? sesionesSalaPropiaHoy
      : sesiones.filter(
           (s) =>
              s.diaSemana === diaSemana &&
              (!carrerasIndicadoresHoy || carrerasIndicadoresHoy.has(s.paralelo.asignaturaPlan.plan.carreraCodigo))
        )
   const indicadoresHoy = calcularIndicadoresHoy(sesionesIndicadoresHoy)

   /* ── Estado de la planificación ────────────────────────────────────────
      Los conteos van sobre clases físicas (deduplicadas), no sobre filas `SesionParalelo`: si
      no, un paralelo espejo contaría doble su falta de sala o de profesor. */
   const clasesConSala = new Set<string>()
   const clasesConProfesor = new Set<string>()
   const clasesTotales = new Set<string>()
   for (const sesion of sesiones) {
      for (const { bloqueId } of sesion.bloques) {
         const clave = claveClaseFisica(sesion, bloqueId)
         clasesTotales.add(clave)
         if (sesion.salaCodigo) clasesConSala.add(clave)
         if (sesion.profesorId) clasesConProfesor.add(clave)
      }
   }

   // Horas cubiertas por paralelo: una asignatura pide N bloques de teoría y M de práctica.
   const sesionesPorParalelo = new Map<
      number,
      { teoria: number; practica: number; requeridoT: number; requeridoP: number }
   >()
   for (const sesion of sesiones) {
      const actual = sesionesPorParalelo.get(sesion.paralelo.id) ?? {
         teoria: 0,
         practica: 0,
         requeridoT: sesion.paralelo.asignaturaPlan.asignatura.bloquesTeoria,
         requeridoP: sesion.paralelo.asignaturaPlan.asignatura.bloquesPractica,
      }
      if (sesion.tipo === 'TEORIA') actual.teoria++
      else actual.practica++
      sesionesPorParalelo.set(sesion.paralelo.id, actual)
   }
   const paralelosTotal = paralelosDelAlcance.length
   let paralelosCompletos = 0
   for (const p of sesionesPorParalelo.values()) {
      if (p.teoria >= p.requeridoT && p.practica >= p.requeridoP) paralelosCompletos++
   }

   /* ── Topes reales ──────────────────────────────────────────────────────
      Dos sesiones que comparten sala o profesor en el mismo día y bloque. Cuando todas las
      involucradas son el MISMO paralelo (espejo en otro curso) no es un choque: es una sola
      clase ocupando el recurso una vez. Solo se cuentan los choques entre paralelos distintos. */
   function contarTopes(clavePorSesion: (s: (typeof sesiones)[number]) => string | null) {
      const grupos = new Map<string, Set<string>>()
      for (const sesion of sesiones) {
         const recurso = clavePorSesion(sesion)
         if (!recurso) continue
         for (const { bloqueId } of sesion.bloques) {
            const clave = `${sesion.diaSemana}-${bloqueId}-${recurso}`
            const paralelosDistintos = grupos.get(clave) ?? new Set<string>()
            paralelosDistintos.add(`${sesion.paralelo.asignaturaPlan.asignaturaId}-${sesion.paralelo.codigo}`)
            grupos.set(clave, paralelosDistintos)
         }
      }
      // >1 paralelo distinto en la misma celda = choque real.
      return [...grupos.values()].filter((paralelos) => paralelos.size > 1).length
   }
   const topesSala = contarTopes((s) => s.salaCodigo)
   const topesProfesor = contarTopes((s) => (s.profesorId ? String(s.profesorId) : null))

   /* ── Ocupación de salas hoy ────────────────────────────────────────────
      Bloques del día ya tomados por clases y por reservas, sobre el total de bloques del
      semestre. Las reservas de clases ya están representadas por su sesión, así que se cuentan
      los bloques que cubre cada reserva sin sesión asociada para no duplicar. */
   const bloquesPorSala = new Map<string, Set<number>>()
   for (const sesion of sesiones) {
      if (sesion.diaSemana !== diaSemana || !sesion.salaCodigo) continue
      const ocupados = bloquesPorSala.get(sesion.salaCodigo) ?? new Set<number>()
      for (const { bloqueId } of sesion.bloques) ocupados.add(bloqueId)
      bloquesPorSala.set(sesion.salaCodigo, ocupados)
   }
   for (const reserva of reservasHoy) {
      if (reserva.sesionParalelo) continue // ya contada por su sesión
      const ocupados = bloquesPorSala.get(reserva.salaCodigo) ?? new Set<number>()
      for (const bloque of bloques) {
         // Un bloque cuenta como ocupado si la reserva se solapa con él.
         if (bloque.inicio < reserva.fin && bloque.fin > reserva.inicio) ocupados.add(bloque.id)
      }
      bloquesPorSala.set(reserva.salaCodigo, ocupados)
   }
   const salasOcupadasHoy = [...bloquesPorSala.entries()]
      // En modo personal solo interesan las salas a cargo de la persona.
      .filter(([codigo]) => !salasPropias || salasPropias.has(codigo))
      .map(([codigo, ocupados]) => ({ codigo, ocupados: ocupados.size, total: bloques.length }))
      .sort((a, b) => b.ocupados - a.ocupados || a.codigo.localeCompare(b.codigo))
      .slice(0, 6)

   /* ── Mis carreras (solo modo personal) ─────────────────────────────────
      Una fila por carrera del alcance, con el avance de su planificación en el semestre. Los
      topes no se desglosan por carrera a propósito: un choque de sala o de profesor suele
      involucrar a dos carreras distintas, así que atribuirlo a una sería engañoso — el total
      va en `planificacion`. */
   const misCarreras = esPersonal
      ? carrerasDelAlcance.map((carrera) => {
           const clases = new Set<string>()
           const conSala = new Set<string>()
           const conProfesor = new Set<string>()
           for (const sesion of sesiones) {
              if (sesion.paralelo.asignaturaPlan.plan.carreraCodigo !== carrera.codigo) continue
              for (const { bloqueId } of sesion.bloques) {
                 const clave = claveClaseFisica(sesion, bloqueId)
                 clases.add(clave)
                 if (sesion.salaCodigo) conSala.add(clave)
                 if (sesion.profesorId) conProfesor.add(clave)
              }
           }
           return {
              codigo: carrera.codigo,
              nombre: carrera.nombre,
              nombreCorto: carrera.nombreCorto,
              esJefe: alcance.carrerasQueDirige.includes(carrera.codigo),
              cursos: cursosDelAlcance.filter((c) => c.plan.carreraCodigo === carrera.codigo).length,
              paralelos: paralelosDelAlcance.filter((p) => p.curso.plan.carreraCodigo === carrera.codigo).length,
              clasesTotales: clases.size,
              clasesConSala: conSala.size,
              clasesConProfesor: conProfesor.size,
           }
        })
      : []

   /* ── Mis salas (solo modo personal) ────────────────────────────────────
      Una fila por sala a cargo, con lo que tiene hoy: bloques ocupados, clases y reservas
      sueltas. Se calcula sobre `reservasHoy` y NO sobre `sesiones` a propósito: `sesiones` está
      acotado a las carreras del usuario, y una sala a cargo puede estar ocupada por la clase de
      OTRA carrera — contarla como libre sería falso. Toda clase con sala tiene su reserva (ver
      reservasSesion.ts), así que las reservas del día son la foto completa de la sala. El conteo
      de clases usa `contarEventosSala` para no contar cada bloque de una clase larga por separado. */
   const misSalas = esPersonal
      ? salas.map((sala) => {
           const reservasDeLaSala = reservasHoy.filter((r) => r.salaCodigo === sala.codigo)
           const bloquesOcupados = new Set<number>()
           for (const reserva of reservasDeLaSala) {
              for (const bloque of bloques) {
                 if (bloque.inicio < reserva.fin && bloque.fin > reserva.inicio) bloquesOcupados.add(bloque.id)
              }
           }
           const { clases, reservas } = contarEventosSala(reservasDeLaSala)
           return {
              codigo: sala.codigo,
              tipoSala: sala.tipoSala.nombre,
              capacidad: sala.capacidad,
              ocupadosHoy: bloquesOcupados.size,
              totalBloques: bloques.length,
              clasesHoy: clases,
              reservasHoy: reservas,
           }
        })
      : []

   // Una clase o reserva está en curso si es hoy y ya empezó — que no haya terminado ya lo
   // garantiza el filtro `OR` de ambas consultas, así que no hace falta comprobarlo de nuevo.
   function estaEnCurso(fecha: string, inicio: string) {
      return fecha === hoyISO && inicio <= ahoraHHMM
   }

   /* ── Próximas clases en mis salas ──────────────────────────────────────
      Un paralelo dictado en varios cursos (ver server/utils/sesionesEspejo.ts) tiene una sesión
      por curso y, por lo tanto, una reserva por curso sobre la MISMA sala a la misma hora: es
      una sola clase física. Se deduplica por asignatura + código de paralelo + fecha + hora,
      igual que el resto de los conteos de la portada. */
   const clavesVistas = new Set<string>()
   const proximasClases = proximasClasesRaw
      .flatMap((reserva) => {
         const sesion = reserva.sesionParalelo
         if (!sesion) return []
         const { paralelo } = sesion
         const fecha = aISO(reserva.fecha)
         const inicio = aHora(reserva.inicio)
         const clave = `${paralelo.asignaturaPlan.asignaturaId}-${paralelo.codigo}-${fecha}-${inicio}`
         if (clavesVistas.has(clave)) return []
         clavesVistas.add(clave)
         return [
            {
               fecha,
               inicio,
               fin: aHora(reserva.fin),
               salaCodigo: reserva.salaCodigo,
               asignaturaCodigo: paralelo.asignaturaPlan.asignatura.codigo,
               asignaturaNombre: paralelo.asignaturaPlan.asignatura.nombre,
               paraleloCodigo: paralelo.codigo,
               carrera: paralelo.asignaturaPlan.plan.carrera.nombre,
               carreraCorta: paralelo.asignaturaPlan.plan.carrera.nombreCorto,
               // Nulo mientras la clase no tenga profesor asignado: la sala se reserva igual.
               profesor: sesion.profesor ? `${sesion.profesor.nombre} ${sesion.profesor.apellido}` : null,
               color: paralelo.color,
               enCurso: estaEnCurso(fecha, inicio),
            },
         ]
      })
      .slice(0, 6)

   /* ── Próximas reservas (no clases) en mis salas ─────────────────────────
      Ayudantías, reuniones u otros usos de sala que no vienen de una sesión de clases. */
   const proximasReservas = proximasReservasRaw.map((reserva) => {
      const fecha = aISO(reserva.fecha)
      const inicio = aHora(reserva.inicio)
      return {
         fecha,
         inicio,
         fin: aHora(reserva.fin),
         salaCodigo: reserva.salaCodigo,
         titulo: reserva.titulo,
         tipo: reserva.tipoReserva.nombre,
         color: reserva.tipoReserva.color,
         // Nulo si la reserva no tiene responsable designado.
         responsable: reserva.persona ? `${reserva.persona.nombre} ${reserva.persona.apellido}` : null,
         enCurso: estaEnCurso(fecha, inicio),
      }
   })

   /* ── Mi agenda de hoy ──────────────────────────────────────────────────
      Las clases con sala ya tienen su fila `Reserva` (ver server/utils/reservasSesion.ts), así
      que la base son las reservas del usuario y se agregan aparte solo las clases SIN sala,
      que no generan reserva. Mismo criterio que /api/horario/profesor. */
   const miAgenda: ResumenAgenda[] = []
   if (alcance.personaId) {
      for (const reserva of reservasHoy) {
         if (reserva.personaId !== alcance.personaId) continue
         const paralelo = reserva.sesionParalelo?.paralelo
         miAgenda.push({
            inicio: aHora(reserva.inicio),
            fin: aHora(reserva.fin),
            titulo: paralelo?.asignaturaPlan.asignatura.nombre ?? reserva.titulo,
            detalle: paralelo ? reserva.titulo : reserva.tipoReserva.nombre,
            salaCodigo: reserva.salaCodigo,
            color: paralelo?.color ?? reserva.tipoReserva.color,
            esClase: !!paralelo,
         })
      }
      // Clases sin sala del día (no existe reserva). Se omiten si hoy es feriado con alcance
      // sobre las clases, igual que hace la generación de reservas.
      const suspendeClases = feriadoHoy !== null
      if (!suspendeClases) {
         const vistas = new Set<string>()
         for (const sesion of sesiones) {
            if (sesion.diaSemana !== diaSemana || sesion.salaCodigo || sesion.profesorId !== alcance.personaId) continue
            for (const { bloqueId } of sesion.bloques) {
               const bloque = bloquePorId.get(bloqueId)
               if (!bloque) continue
               // Dos sesiones espejo sin sala son una sola clase.
               const clave = claveClaseFisica(sesion, bloqueId)
               if (vistas.has(clave)) continue
               vistas.add(clave)
               miAgenda.push({
                  inicio: aHora(bloque.inicio),
                  fin: aHora(bloque.fin),
                  titulo: sesion.paralelo.asignaturaPlan.asignatura.nombre,
                  detalle: `${sesion.paralelo.asignaturaPlan.asignatura.codigo} · ${sesion.paralelo.codigo}`,
                  salaCodigo: null,
                  color: sesion.paralelo.color,
                  esClase: true,
               })
            }
         }
      }
      miAgenda.sort((a, b) => a.inicio.localeCompare(b.inicio))
   }

   const proximosFeriados = feriados
      .filter((f) => aISO(f.fecha) >= hoyISO)
      .slice(0, 4)
      .map((f) => ({
         fecha: aISO(f.fecha),
         alcance: f.alcance,
         horaInicio: f.horaInicio ? aHora(f.horaInicio) : null,
         horaTermino: f.horaTermino ? aHora(f.horaTermino) : null,
      }))

   // Progreso del semestre en semanas, para la barra de la portada.
   const UN_DIA = 24 * 60 * 60 * 1000
   const totalSemanas = Math.max(
      1,
      Math.ceil((semestre.fechaFin.getTime() - semestre.fechaInicio.getTime()) / UN_DIA / 7)
   )
   const semanasTranscurridas = Math.floor((hoy.getTime() - semestre.fechaInicio.getTime()) / UN_DIA / 7) + 1
   const semanaActual = Math.min(Math.max(semanasTranscurridas, 0), totalSemanas)

   // Reservas de hoy para el indicador "Reservas en mis salas hoy": mismo criterio de acotación
   // que `indicadoresHoy`. Apoyo Docente ve las de sus salas (incluidas las que no son de clase,
   // como ayudantías o reuniones: no tienen carrera, así que solo una acotación por sala las
   // puede incluir). El resto de los roles ve solo las reservas que SÍ son de una sesión de
   // clases de su carrera — una reserva suelta no pertenece a ninguna carrera. En modo global no
   // hay acotación. `contarEventosSala` evita contar cada bloque de una clase larga por separado.
   const reservasIndicadoresHoy = !esPersonal
      ? reservasHoy
      : esApoyoDocente
        ? reservasHoy.filter((r) => salasIndicadoresHoy!.has(r.salaCodigo))
        : reservasHoy.filter((r) => {
             const carreraCodigo = r.sesionParalelo?.paralelo.asignaturaPlan.plan.carreraCodigo
             return carreraCodigo !== undefined && carrerasIndicadoresHoy!.has(carreraCodigo)
          })
   const eventosIndicadoresHoy = contarEventosSala(reservasIndicadoresHoy)

   return {
      alcance: alcanceRespuesta,
      semestre: {
         id: semestre.id,
         nombre: semestre.nombre,
         fechaInicio: aISO(semestre.fechaInicio),
         fechaFin: aISO(semestre.fechaFin),
         semanaActual,
         totalSemanas,
         // Fuera del rango del semestre la barra de progreso no significa nada.
         enCurso: hoy >= semestre.fechaInicio && hoy <= semestre.fechaFin,
      },
      hoy: {
         fecha: hoyISO,
         diaSemana,
         feriado: feriadoHoy
            ? {
                 alcance: feriadoHoy.alcance,
                 horaInicio: feriadoHoy.horaInicio ? aHora(feriadoHoy.horaInicio) : null,
                 horaTermino: feriadoHoy.horaTermino ? aHora(feriadoHoy.horaTermino) : null,
              }
            : null,
         clases: indicadoresHoy.clases,
         reservas: eventosIndicadoresHoy.clases + eventosIndicadoresHoy.reservas,
         cursosConClase: indicadoresHoy.cursos,
         profesoresConClase: indicadoresHoy.profesores,
      },
      totales: {
         carreras: carrerasDelAlcance.length,
         paralelos: paralelosTotal,
         salas: salas.length,
         personasActivas,
      },
      planificacion: {
         clasesTotales: clasesTotales.size,
         clasesConSala: clasesConSala.size,
         clasesConProfesor: clasesConProfesor.size,
         // El total de paralelos va en `totales`: es el mismo número y sirve de denominador.
         paralelosCompletos,
         topesSala,
         topesProfesor,
      },
      miAgenda,
      salasOcupadasHoy,
      proximosFeriados,
      misCarreras,
      misSalas,
      proximasClases,
      proximasReservas,
   }
})
