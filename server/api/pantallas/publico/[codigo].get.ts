// Endpoint PÚBLICO — sin sesión ni permiso — a propósito: alimenta la pantalla física
// /pantallas/<codigo> que se instala en un hall o pasillo, sin que nadie inicie sesión ahí.
// Solo GET, de solo lectura. No se valida `requierePermiso` ni se acota por CSRF
// (server/middleware/origen.ts solo protege métodos que mutan). Por eso el código es lo único
// que actúa como "llave" de la pantalla — ver pantallasPublicas.schemas.ts para el formato
// aceptado.
//
// Muestra qué reservas están EN CURSO y cuáles están PRÓXIMAS A INICIAR (hoy) en las salas de la
// pantalla — no el horario completo de la semana: es una pantalla de "estado actual", como un
// tótem de aeropuerto. Se muestra CUALQUIER tipo de reserva (clases generadas desde un paralelo,
// reuniones, eventos, bloqueos manuales, …), no solo las que vienen de una sesión de clases — el
// único filtro es `publica: true` (mismo campo que controla la vista impresa de
// /reservas/horario): una reserva marcada como no pública toma la sala igual, pero no debe
// anunciarse acá.
function aHora(hora: Date) {
   return hora.toISOString().slice(11, 16)
}

// "Hoy" y "ahora" en la hora de pared de Chile — NO la del proceso de Node, que en producción
// suele correr en UTC (Render y la mayoría de los hosts en la nube). Antes esto se calculaba
// con getters locales (getHours, getDate…), que dependían del huso horario del contenedor: en
// desarrollo local coincidía por casualidad (el Mac del desarrollador está en hora de Chile),
// pero en producción "ahora" quedaba desfasado varias horas y ninguna reserva calzaba nunca —
// la pantalla no mostraba ni "en curso" ni "próximas". `Intl.DateTimeFormat` con `timeZone`
// explícito da el mismo resultado sin importar en qué huso corra el servidor.
const FORMATO_CHILE = new Intl.DateTimeFormat('en-CA', {
   timeZone: 'America/Santiago',
   year: 'numeric',
   month: '2-digit',
   day: '2-digit',
   hour: '2-digit',
   minute: '2-digit',
   hourCycle: 'h23',
})
function hoyYAhoraChile(fecha: Date) {
   const partes = new Map(FORMATO_CHILE.formatToParts(fecha).map((p) => [p.type, p.value]))
   return {
      hoyISO: `${partes.get('year')}-${partes.get('month')}-${partes.get('day')}`,
      ahoraHHMM: `${partes.get('hour')}:${partes.get('minute')}`,
   }
}

// Una reserva se "lee como clase" (muestra asignatura/carrera/profesor en vez de tipo/título) si
// su tipo es Clase o Ayudantía — mismo criterio que `esClase` en /reservas/horario. No se mira
// `sesionParaleloId`: una ayudantía es una reserva hecha a mano, sin sesión asociada, pero se
// lee igual que una clase. Si además tiene sesión (`sesionParalelo`), se sabe la asignatura y
// carrera concretas; si no, se muestra solo el título y el profesor/responsable, si tiene.
const TIPOS_CLASE = ['Clase', 'Ayudantía']

interface ClaseResumen {
   id: number
   salaCodigo: string
   titulo: string
   subtitulo: string | null
   esClase: boolean
   asignaturaCodigo: string | null
   asignaturaNombre: string | null
   paraleloCodigo: string | null
   carreraNombre: string | null
   tipoReservaNombre: string
   tipoReservaColor: string
   inicio: string
   fin: string
   responsable: string | null
   cancelada: boolean
}

// Una clase de varias horas (ej. 3 bloques de teoría seguidos) queda partida en una
// `SesionParalelo`/`Reserva` por bloque (ver server/utils/reservasSesion.ts) — igual que en
// /api/dashboard ("Mi día"), así que acá llega como varias entradas separadas por sala y
// horario. Se fusionan en una sola por clase física (sala+asignatura+paralelo), extendiendo
// el rango hasta el bloque contiguo siguiente. La contigüidad es por NÚMERO de bloque, no por
// hora: entre dos bloques puede haber un recreo, y esa clase sigue "en curso" durante el
// recreo — no corresponde mostrarla como terminada ni que la sala aparezca libre. Una reserva
// sin paralelo (reunión, evento, bloqueo manual) nunca se fusiona con otra: cada una queda en
// su propio grupo (`grupoId` único), así que pasa directo sin tocar `fusionarBloquesContiguos`.
interface ReservaCruda extends ClaseResumen {
   grupoId: string
   bloqueNumero: number | null
}

function fusionarBloquesContiguos(crudas: ReservaCruda[]): ClaseResumen[] {
   const porClave = new Map<string, ReservaCruda[]>()
   for (const r of crudas) {
      const lista = porClave.get(r.grupoId) ?? []
      lista.push(r)
      porClave.set(r.grupoId, lista)
   }

   const resultado: ClaseResumen[] = []
   for (const lista of porClave.values()) {
      const ordenada = [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio))
      let actual: ReservaCruda | null = null
      for (const r of ordenada) {
         // Solo se fusiona si ambos bloques se pudieron ubicar en la plantilla del semestre y
         // son consecutivos (bloque N seguido del N+1). Si falta el bloque (no debería pasar,
         // ver `bloquePorHoraInicio` más abajo) la entrada queda sola, sin fusionar.
         if (
            actual !== null &&
            actual.bloqueNumero != null &&
            r.bloqueNumero != null &&
            actual.bloqueNumero + 1 === r.bloqueNumero &&
            // Si solo un bloque de una clase de varias horas se cancela, no puede fundirse con
            // el resto en una sola entrada: se perdería justo el dato de cuál bloque canceló.
            actual.cancelada === r.cancelada
         ) {
            // Mismo criterio que `fusionarContiguas` en /reservas/imprimir: se extiende el
            // tramo actual en vez de crear uno nuevo.
            actual.fin = r.fin
            actual.bloqueNumero = r.bloqueNumero
         } else {
            if (actual) resultado.push(actual)
            actual = r
         }
      }
      if (actual) resultado.push(actual)
   }
   return resultado
}

export default defineEventHandler(async (event) => {
   const codigo = getRouterParam(event, 'codigo')
   if (!codigo) throw createError({ statusCode: 400, message: 'Código inválido' })

   const pantalla = await prisma.pantallaPublica.findUnique({
      where: { codigo },
      include: { salas: true },
   })
   if (!pantalla) throw createError({ statusCode: 404, message: 'Pantalla no encontrada' })

   const respuestaBase = {
      pantalla: {
         nombre: pantalla.nombre,
         codigo: pantalla.codigo,
         segundosPorSlide: pantalla.segundosPorSlide,
         // Ventana horaria de refresco: el cliente decide con esto si sigue pidiendo datos o
         // entra en modo de ahorro — ver app/pages/pantallas/[codigo].vue.
         horaInicio: pantalla.horaInicio ? aHora(pantalla.horaInicio) : null,
         horaFin: pantalla.horaFin ? aHora(pantalla.horaFin) : null,
      },
   }

   const salaCodigos = pantalla.salas.map((ps) => ps.salaCodigo)
   if (!salaCodigos.length) return { ...respuestaBase, hoy: null, enCurso: [], proximas: [] }

   // A diferencia de /dashboard o /reservas/horario, acá no hay una persona logueada cuyo huso
   // horario importe — es una pantalla física fija en Chile, así que "hoy" y "ahora" van
   // fijados a esa zona (ver `hoyYAhoraChile`), no a la del servidor.
   const { hoyISO, ahoraHHMM } = hoyYAhoraChile(new Date())
   const hoy = new Date(`${hoyISO}T00:00:00.000Z`)

   // Plantilla de bloques del semestre vigente: hace falta para saber qué bloque (número) es
   // cada reserva y así detectar bloques contiguos — ver `fusionarBloquesContiguos`.
   const semestre = await prisma.semestre.findFirst({ where: { vigente: true } })
   const bloques = semestre ? await prisma.bloque.findMany({ where: { semestreId: semestre.id } }) : []
   const bloqueNumeroPorHoraInicio = new Map(bloques.map((b) => [aHora(b.inicio), b.numero]))

   const reservas = await prisma.reserva.findMany({
      where: { salaCodigo: { in: salaCodigos }, fecha: hoy, publica: true },
      include: {
         persona: { select: { nombre: true, apellido: true } },
         tipoReserva: true,
         sesionParalelo: {
            include: {
               paralelo: {
                  include: { asignaturaPlan: { include: { asignatura: true, plan: { include: { carrera: true } } } } },
               },
            },
         },
      },
      orderBy: { inicio: 'asc' },
   })

   // El mismo paralelo dictado en otro curso (ver server/utils/sesionesEspejo.ts) genera una
   // reserva por curso sobre la MISMA sala a la misma hora — es una sola clase física. Se
   // deduplica por sala+asignatura+paralelo+inicio, mismo criterio que /api/dashboard. Una
   // reserva sin paralelo no tiene ese problema (no hay "espejo" fuera de sesiones de clases),
   // así que se deduplica trivialmente por su propio id.
   const vistas = new Set<string>()
   const crudas: ReservaCruda[] = []

   for (const r of reservas) {
      const paralelo = r.sesionParalelo?.paralelo ?? null
      const inicio = aHora(r.inicio)
      const fin = aHora(r.fin)

      const claveDedup = paralelo
         ? `${r.salaCodigo}-${paralelo.asignaturaPlan.asignaturaId}-${paralelo.codigo}-${inicio}`
         : `reserva-${r.id}`
      if (vistas.has(claveDedup)) continue
      vistas.add(claveDedup)

      crudas.push({
         id: r.id,
         salaCodigo: r.salaCodigo,
         titulo: r.titulo,
         subtitulo: r.subtitulo,
         esClase: TIPOS_CLASE.includes(r.tipoReserva.nombre),
         asignaturaCodigo: paralelo?.asignaturaPlan.asignatura.codigo ?? null,
         // Nombre corto si la asignatura tiene uno definido, si no el completo — mismo criterio
         // que /reservas/horario (ver `nombreAsignaturaDe`).
         asignaturaNombre:
            paralelo?.asignaturaPlan.asignatura.nombreCorto ?? paralelo?.asignaturaPlan.asignatura.nombre ?? null,
         paraleloCodigo: paralelo?.codigo ?? null,
         carreraNombre: paralelo?.asignaturaPlan.plan.carrera.nombre ?? null,
         tipoReservaNombre: r.tipoReserva.nombre,
         tipoReservaColor: r.tipoReserva.color,
         inicio,
         fin,
         responsable: r.persona ? `${r.persona.nombre} ${r.persona.apellido}` : null,
         cancelada: r.cancelada,
         grupoId: paralelo
            ? `${r.salaCodigo}-${paralelo.asignaturaPlan.asignaturaId}-${paralelo.codigo}`
            : `sola-${r.id}`,
         bloqueNumero: bloqueNumeroPorHoraInicio.get(inicio) ?? null,
      })
   }

   const enCurso: ClaseResumen[] = []
   const proximas: ClaseResumen[] = []
   for (const clase of fusionarBloquesContiguos(crudas)) {
      if (clase.inicio <= ahoraHHMM && clase.fin > ahoraHHMM) enCurso.push(clase)
      else if (clase.inicio > ahoraHHMM) proximas.push(clase)
   }

   // `numeric: true` compara el número de sala como número, no letra por letra (si no,
   // "G10" quedaría antes que "G9" por orden lexicográfico).
   const porInicioYSala = (a: ClaseResumen, b: ClaseResumen) =>
      a.inicio.localeCompare(b.inicio) || a.salaCodigo.localeCompare(b.salaCodigo, undefined, { numeric: true })
   enCurso.sort(porInicioYSala)
   proximas.sort(porInicioYSala)

   // `proximasPorSala` acota cuántas próximas clases se listan por sala (null = todas las que
   // queden hoy). "En curso" nunca se acota: a lo más hay una clase en curso por sala a la vez
   // (una sala no puede tener dos clases superpuestas), así que no hace falta.
   const proximasLimitadas =
      pantalla.proximasPorSala == null
         ? proximas
         : (() => {
              const contadorPorSala = new Map<string, number>()
              return proximas.filter((clase) => {
                 const cantidad = contadorPorSala.get(clase.salaCodigo) ?? 0
                 if (cantidad >= pantalla.proximasPorSala!) return false
                 contadorPorSala.set(clase.salaCodigo, cantidad + 1)
                 return true
              })
           })()

   return { ...respuestaBase, hoy: hoyISO, enCurso, proximas: proximasLimitadas }
})
