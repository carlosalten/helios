// Endpoint PÚBLICO — sin sesión ni permiso — a propósito: alimenta la pantalla física
// /pantallas/<codigo> que se instala en un hall o pasillo, sin que nadie inicie sesión ahí.
// Solo GET, de solo lectura. No se valida `requierePermiso` ni se acota por CSRF
// (server/middleware/origen.ts solo protege métodos que mutan). Por eso el código es lo único
// que actúa como "llave" de la pantalla — ver pantallasPublicas.schemas.ts para el formato
// aceptado.
//
// Muestra qué clases están EN CURSO y cuáles están PRÓXIMAS A INICIAR (hoy) en las salas de la
// pantalla — no el horario completo de la semana: es una pantalla de "estado actual", como un
// tótem de aeropuerto. Solo reservas de una sesión de clases (`sesionParaleloId` no nulo):
// ayudantías/reuniones sueltas no traen carrera/asignatura/paralelo, que es lo que se muestra.
function aHora(hora: Date) {
   return hora.toISOString().slice(11, 16)
}

interface ClaseResumen {
   id: number
   salaCodigo: string
   carreraNombre: string
   asignaturaCodigo: string
   asignaturaNombre: string
   paraleloCodigo: string
   inicio: string
   fin: string
   profesor: string | null
   cancelada: boolean
}

// Una clase de varias horas (ej. 3 bloques de teoría seguidos) queda partida en una
// `SesionParalelo`/`Reserva` por bloque (ver server/utils/reservasSesion.ts) — igual que en
// /api/dashboard ("Mi día"), así que acá llega como varias entradas separadas por sala y
// horario. Se fusionan en una sola por clase física (sala+asignatura+paralelo), extendiendo
// el rango hasta el bloque contiguo siguiente. La contigüidad es por NÚMERO de bloque, no por
// hora: entre dos bloques puede haber un recreo, y esa clase sigue "en curso" durante el
// recreo — no corresponde mostrarla como terminada ni que la sala aparezca libre.
interface ReservaCruda extends ClaseResumen {
   asignaturaId: number
   bloqueNumero: number | null
}

function fusionarBloquesContiguos(crudas: ReservaCruda[]): ClaseResumen[] {
   const porClave = new Map<string, ReservaCruda[]>()
   for (const r of crudas) {
      const clave = `${r.salaCodigo}-${r.asignaturaId}-${r.paraleloCodigo}`
      const lista = porClave.get(clave) ?? []
      lista.push(r)
      porClave.set(clave, lista)
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
      pantalla: { nombre: pantalla.nombre, codigo: pantalla.codigo, segundosPorSlide: pantalla.segundosPorSlide },
   }

   const salaCodigos = pantalla.salas.map((ps) => ps.salaCodigo)
   if (!salaCodigos.length) return { ...respuestaBase, hoy: null, enCurso: [], proximas: [] }

   // Reloj y fecha del SERVIDOR: a diferencia de /dashboard o /reservas/horario, acá no hay una
   // persona logueada cuyo huso horario importe — es una pantalla física fija, así que "hoy" y
   // "ahora" son los del servidor (se asume misma zona horaria que la institución, igual que el
   // resto de las horas de la app: bloques y reservas se guardan como hora de pared, sin
   // conversión de huso). `getHours`/`getMonth` (locales, no UTC) para que calcen con cómo
   // Bloque/Reserva.inicio se leen ya en server/api/dashboard.get.ts y compañía.
   const ahora = new Date()
   const hoyISO = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
   const hoy = new Date(`${hoyISO}T00:00:00.000Z`)
   const ahoraHHMM = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`

   // Plantilla de bloques del semestre vigente: hace falta para saber qué bloque (número) es
   // cada reserva y así detectar bloques contiguos — ver `fusionarBloquesContiguos`.
   const semestre = await prisma.semestre.findFirst({ where: { vigente: true } })
   const bloques = semestre ? await prisma.bloque.findMany({ where: { semestreId: semestre.id } }) : []
   const bloqueNumeroPorHoraInicio = new Map(bloques.map((b) => [aHora(b.inicio), b.numero]))

   const reservas = await prisma.reserva.findMany({
      where: { salaCodigo: { in: salaCodigos }, fecha: hoy, sesionParaleloId: { not: null } },
      include: {
         persona: { select: { nombre: true, apellido: true } },
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
   // deduplica por sala+asignatura+paralelo+inicio, mismo criterio que /api/dashboard.
   const vistas = new Set<string>()
   const crudas: ReservaCruda[] = []

   for (const r of reservas) {
      const sesion = r.sesionParalelo
      if (!sesion) continue
      const { paralelo } = sesion
      const inicio = aHora(r.inicio)
      const fin = aHora(r.fin)

      const clave = `${r.salaCodigo}-${paralelo.asignaturaPlan.asignaturaId}-${paralelo.codigo}-${inicio}`
      if (vistas.has(clave)) continue
      vistas.add(clave)

      crudas.push({
         id: r.id,
         salaCodigo: r.salaCodigo,
         carreraNombre: paralelo.asignaturaPlan.plan.carrera.nombre,
         asignaturaCodigo: paralelo.asignaturaPlan.asignatura.codigo,
         asignaturaId: paralelo.asignaturaPlan.asignaturaId,
         asignaturaNombre: paralelo.asignaturaPlan.asignatura.nombre,
         paraleloCodigo: paralelo.codigo,
         inicio,
         fin,
         profesor: r.persona ? `${r.persona.nombre} ${r.persona.apellido}` : null,
         cancelada: r.cancelada,
         bloqueNumero: bloqueNumeroPorHoraInicio.get(inicio) ?? null,
      })
   }

   const enCurso: ClaseResumen[] = []
   const proximas: ClaseResumen[] = []
   for (const clase of fusionarBloquesContiguos(crudas)) {
      if (clase.inicio <= ahoraHHMM && clase.fin > ahoraHHMM) enCurso.push(clase)
      else if (clase.inicio > ahoraHHMM) proximas.push(clase)
   }

   const porInicioYSala = (a: ClaseResumen, b: ClaseResumen) =>
      a.inicio.localeCompare(b.inicio) || a.salaCodigo.localeCompare(b.salaCodigo)
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
