// Dashboard de uso de salas: por cada sala, qué porcentaje de su horario semanal está
// comprometido y qué bloques quedan libres, más un desglose de esa ocupación por tipo de
// reserva y por carrera. A diferencia de /reportes/bloques-libres y /reportes/topes-horario
// (que procesan un archivo local sin tocar la BD), este reporte sí usa datos reales del
// sistema, así que es una ruta restringible normal — requiere 'ver' en '/reportes/uso-salas'
// (ver server/utils/permisos.schemas.ts y app/types/permiso.ts), no queda abierta a
// cualquier sesión como los otros dos.
//
// Las salas son un recurso compartido por todo el departamento (no pertenecen a una
// carrera, a diferencia de cursos/paralelos), así que este reporte no se acota por
// `resolverCarrerasJefe`. Sí se acota por sala asignada (EncargadoSala): cualquier rol que no
// sea Administrador solo ve el uso de las salas de las que es encargado — mismo criterio que
// /reservas/resumen (server/api/reservas/resumen.get.ts).
//
// ── Dos métricas distintas, a propósito ──────────────────────────────────────────────────
// 1) % de uso y bloques libres: sobre la PLANTILLA SEMANAL (bloques del semestre × 7 días).
//    Un (día, bloque) cuenta como "ocupado" si tuvo una clase o una reserva AL MENOS UNA VEZ
//    en el semestre. Es una foto estructural — "¿cuándo se usa esta sala normalmente?" — no
//    una frecuencia. Por eso una reunión de una sola vez pesa igual que una clase semanal en
//    esta métrica: las dos comprometen esa franja.
// 2) Uso por tipo y por carrera: sobre las reservas REALES del semestre completo (filas
//    `Reserva`, que para las clases ya están generadas una por semana — ver
//    server/utils/reservasSesion.ts). Acá sí importa la frecuencia real: una clase semanal
//    pesa varias veces más que una reunión puntual, que es lo esperable para "cuánto se usó".

interface DesgloseItem {
   nombre: string
   color: string | null
   cantidad: number
   porcentaje: number
}

interface BloqueLibre {
   diaSemana: number
   bloqueId: number
   bloqueNumero: number
   inicio: string
   fin: string
}

interface UsoSala {
   codigo: string
   tipoSala: string
   capacidad: number
   bloquesUniverso: number
   bloquesOcupados: number
   bloquesLibres: number
   porcentajeUso: number
   totalReservas: number
   bloquesLibresDetalle: BloqueLibre[]
   porTipo: DesgloseItem[]
   porCarrera: DesgloseItem[]
}

const DIAS_UNIVERSO = 7 // las salas se pueden reservar cualquier día, incluido el fin de semana.
const SIN_CARRERA = 'General (sin carrera)'

function aHora(hora: Date) {
   return hora.toISOString().slice(11, 16)
}

function agruparADesglose(cantidadPorNombre: Map<string, { cantidad: number; color: string | null }>, total: number) {
   return [...cantidadPorNombre.entries()]
      .map(([nombre, { cantidad, color }]) => ({
         nombre,
         color,
         cantidad,
         porcentaje: total > 0 ? Math.round((cantidad / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
}

export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/reportes/uso-salas', 'ver')

   let salasPermitidas: string[] | null = null
   if (usuario.rol !== 'Administrador') {
      const persona = await prisma.persona.findUnique({ where: { email: usuario.email } })
      const encargos = persona
         ? await prisma.encargadoSala.findMany({ where: { personaId: persona.id }, select: { salaCodigo: true } })
         : []
      salasPermitidas = encargos.map((e) => e.salaCodigo)
   }

   const semestre = await prisma.semestre.findFirst({ where: { vigente: true } })
   if (!semestre) {
      return { semestre: null, salas: [], resumen: null, porTipoGeneral: [], porCarreraGeneral: [] }
   }

   const [salas, bloques, sesiones, reservas] = await Promise.all([
      prisma.sala.findMany({
         where: { ...(salasPermitidas && { codigo: { in: salasPermitidas } }) },
         orderBy: { codigo: 'asc' },
         include: { tipoSala: true },
      }),
      prisma.bloque.findMany({ where: { semestreId: semestre.id }, orderBy: { numero: 'asc' } }),
      prisma.sesionParalelo.findMany({
         where: {
            salaCodigo: salasPermitidas ? { in: salasPermitidas } : { not: null },
            paralelo: { curso: { semestreId: semestre.id } },
         },
         select: { diaSemana: true, salaCodigo: true, bloques: { select: { bloqueId: true } } },
      }),
      prisma.reserva.findMany({
         where: {
            fecha: { gte: semestre.fechaInicio, lte: semestre.fechaFin },
            ...(salasPermitidas && { salaCodigo: { in: salasPermitidas } }),
         },
         select: {
            fecha: true,
            inicio: true,
            fin: true,
            salaCodigo: true,
            tipoReserva: { select: { nombre: true, color: true } },
            sesionParalelo: {
               select: {
                  paralelo: {
                     select: {
                        asignaturaPlan: { select: { plan: { select: { carrera: { select: { nombre: true } } } } } },
                     },
                  },
               },
            },
         },
      }),
   ])

   const bloquesUniverso = bloques.length * DIAS_UNIVERSO

   // (salaCodigo -> Set de "diaSemana-bloqueId") ocupados alguna vez en el semestre.
   const ocupadoPorSala = new Map<string, Set<string>>()
   function marcarOcupado(sala: string, diaSemana: number, bloqueId: number) {
      const set = ocupadoPorSala.get(sala) ?? new Set<string>()
      set.add(`${diaSemana}-${bloqueId}`)
      ocupadoPorSala.set(sala, set)
   }

   for (const sesion of sesiones) {
      for (const { bloqueId } of sesion.bloques) marcarOcupado(sesion.salaCodigo!, sesion.diaSemana, bloqueId)
   }

   // Las reservas standalone no traen diaSemana ni bloqueId: se derivan de la fecha (ISO:
   // 1=lunes…7=domingo) y de qué bloques del semestre cubre su horario (mismo criterio de
   // solape que usa /api/dashboard: bloque.inicio < fin de la reserva && bloque.fin > su inicio).
   const reservasPorSala = new Map<string, typeof reservas>()
   for (const reserva of reservas) {
      const diaSemana = reserva.fecha.getUTCDay() === 0 ? 7 : reserva.fecha.getUTCDay()
      for (const bloque of bloques) {
         if (bloque.inicio < reserva.fin && bloque.fin > reserva.inicio)
            marcarOcupado(reserva.salaCodigo, diaSemana, bloque.id)
      }
      const lista = reservasPorSala.get(reserva.salaCodigo) ?? []
      lista.push(reserva)
      reservasPorSala.set(reserva.salaCodigo, lista)
   }

   const salasResumen: UsoSala[] = salas.map((sala) => {
      const ocupados = ocupadoPorSala.get(sala.codigo) ?? new Set<string>()
      const reservasSala = reservasPorSala.get(sala.codigo) ?? []

      const bloquesLibresDetalle: BloqueLibre[] = []
      for (let diaSemana = 1; diaSemana <= DIAS_UNIVERSO; diaSemana++) {
         for (const bloque of bloques) {
            if (!ocupados.has(`${diaSemana}-${bloque.id}`)) {
               bloquesLibresDetalle.push({
                  diaSemana,
                  bloqueId: bloque.id,
                  bloqueNumero: bloque.numero,
                  inicio: aHora(bloque.inicio),
                  fin: aHora(bloque.fin),
               })
            }
         }
      }

      const porTipoMapa = new Map<string, { cantidad: number; color: string | null }>()
      const porCarreraMapa = new Map<string, { cantidad: number; color: string | null }>()
      for (const reserva of reservasSala) {
         const tipo = porTipoMapa.get(reserva.tipoReserva.nombre) ?? { cantidad: 0, color: reserva.tipoReserva.color }
         tipo.cantidad++
         porTipoMapa.set(reserva.tipoReserva.nombre, tipo)

         const carreraNombre = reserva.sesionParalelo?.paralelo.asignaturaPlan.plan.carrera.nombre ?? SIN_CARRERA
         const carrera = porCarreraMapa.get(carreraNombre) ?? { cantidad: 0, color: null }
         carrera.cantidad++
         porCarreraMapa.set(carreraNombre, carrera)
      }

      return {
         codigo: sala.codigo,
         tipoSala: sala.tipoSala.nombre,
         capacidad: sala.capacidad,
         bloquesUniverso,
         bloquesOcupados: ocupados.size,
         bloquesLibres: bloquesUniverso - ocupados.size,
         porcentajeUso: bloquesUniverso > 0 ? Math.round((ocupados.size / bloquesUniverso) * 1000) / 10 : 0,
         totalReservas: reservasSala.length,
         bloquesLibresDetalle,
         porTipo: agruparADesglose(porTipoMapa, reservasSala.length),
         porCarrera: agruparADesglose(porCarreraMapa, reservasSala.length),
      }
   })

   salasResumen.sort((a, b) => b.porcentajeUso - a.porcentajeUso)

   const conUso = salasResumen.filter((s) => s.bloquesUniverso > 0)
   const usoPromedio = conUso.length
      ? Math.round((conUso.reduce((sum, s) => sum + s.porcentajeUso, 0) / conUso.length) * 10) / 10
      : 0

   const porTipoGeneralMapa = new Map<string, { cantidad: number; color: string | null }>()
   const porCarreraGeneralMapa = new Map<string, { cantidad: number; color: string | null }>()
   for (const reserva of reservas) {
      const tipo = porTipoGeneralMapa.get(reserva.tipoReserva.nombre) ?? {
         cantidad: 0,
         color: reserva.tipoReserva.color,
      }
      tipo.cantidad++
      porTipoGeneralMapa.set(reserva.tipoReserva.nombre, tipo)

      const carreraNombre = reserva.sesionParalelo?.paralelo.asignaturaPlan.plan.carrera.nombre ?? SIN_CARRERA
      const carrera = porCarreraGeneralMapa.get(carreraNombre) ?? { cantidad: 0, color: null }
      carrera.cantidad++
      porCarreraGeneralMapa.set(carreraNombre, carrera)
   }

   return {
      semestre: {
         id: semestre.id,
         nombre: semestre.nombre,
         fechaInicio: semestre.fechaInicio.toISOString().slice(0, 10),
         fechaFin: semestre.fechaFin.toISOString().slice(0, 10),
      },
      salas: salasResumen,
      resumen: {
         totalSalas: salas.length,
         usoPromedio,
         salaMasUsada: conUso[0] ? { codigo: conUso[0].codigo, porcentaje: conUso[0].porcentajeUso } : null,
         salaMenosUsada: conUso.length
            ? { codigo: conUso[conUso.length - 1]!.codigo, porcentaje: conUso[conUso.length - 1]!.porcentajeUso }
            : null,
         totalReservasSemestre: reservas.length,
      },
      porTipoGeneral: agruparADesglose(porTipoGeneralMapa, reservas.length),
      porCarreraGeneral: agruparADesglose(porCarreraGeneralMapa, reservas.length),
   }
})
