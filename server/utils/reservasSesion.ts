import { randomUUID } from 'node:crypto'
import type { BloqueModel, FeriadoModel, SemestreModel, SesionParaleloModel } from '../../generated/prisma/models'

const UNA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000

// Primera fecha, a partir de `desde` (inclusive), cuyo día de la semana (ISO: 1=lunes…7=domingo)
// es `diaSemana`.
function primeraFechaDelDia(desde: Date, diaSemana: number) {
   const fecha = new Date(desde)
   const diaActual = fecha.getUTCDay() === 0 ? 7 : fecha.getUTCDay()
   fecha.setUTCDate(fecha.getUTCDate() + ((diaSemana - diaActual + 7) % 7))
   return fecha
}

// Valida y convierte el `?hoy=YYYY-MM-DD` que mandan los endpoints de /api/sesiones (mover,
// asignar sala/profesor, borrar) para saber desde qué fecha tocar las reservas — mismo criterio
// que /api/dashboard: el día de "hoy" lo decide el cliente, no el reloj del servidor, porque el
// usuario puede no estar en la misma zona horaria.
export function resolverHoy(query: Record<string, unknown>): Date {
   const hoy = query.hoy
   if (typeof hoy !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hoy)) {
      throw createError({ statusCode: 422, message: 'Falta la fecha de hoy (?hoy=YYYY-MM-DD)' })
   }
   return new Date(`${hoy}T00:00:00.000Z`)
}

export function tituloReservaSesion(paralelo: { codigo: string; asignaturaPlan: { asignatura: { codigo: string } } }) {
   return `${paralelo.asignaturaPlan.asignatura.codigo} · ${paralelo.codigo}`
}

// Borra la parte de la reserva recurrente de una sesión de clases que todavía no ocurrió
// (fecha >= hoy). Las reservas pasadas quedan intactas como registro de lo que efectivamente
// se dictó: un cambio de horario hecho hoy no debe reescribir la historia de semanas
// anteriores, aunque haya movido, reasignado o borrado la sesión.
export function eliminarReservaSesion(sesionId: number, hoy: Date) {
   return prisma.reserva.deleteMany({ where: { sesionParaleloId: sesionId, fecha: { gte: hoy } } })
}

// Un feriado (día completo, u horas horaInicio–horaTermino) suspende las clases sea cual sea
// su alcance: SOLO_CLASES afecta clases explícitamente y TOTAL las incluye también. Por eso
// no se filtra por alcance acá — cualquier feriado del semestre en esa fecha basta.
export function feriadoCubreBloque(
   feriado: Pick<FeriadoModel, 'horaInicio' | 'horaTermino'>,
   bloque: Pick<BloqueModel, 'inicio' | 'fin'>
) {
   if (!feriado.horaInicio || !feriado.horaTermino) return true // feriado de día completo
   return bloque.inicio < feriado.horaTermino && bloque.fin > feriado.horaInicio // se solapan
}

// (Re)genera la reserva de sala de una sesión de clases desde `hoy` en adelante: borra esa
// parte de la serie anterior (si había) y, si la sesión tiene sala asignada, crea una reserva
// recurrente semanal desde `hoy` hasta el término del semestre — una sola serie (mismo
// serieId), enlazada a la sesión vía sesionParaleloId. Importante: NO genera una reserva
// independiente por cada bloque/semana. Las reservas de fechas anteriores a `hoy` no se
// tocan: quedan como registro de lo que ya se dictó, con el horario que tenía en ese momento.
// La reserva se crea apenas hay sala, haya o no profesor: la sala queda tomada igual. El
// responsable es el profesor de la sesión y queda nulo mientras no se le asigne uno (ver
// Reserva.personaId, nullable); al asignarlo, ese cambio regenera la serie y pasa a figurar
// como responsable. Las fechas que caen en un feriado del semestre se omiten: ese día no hay
// clases, así que tampoco corresponde reservar la sala.
export async function regenerarReservaSesion(
   sesion: Pick<SesionParaleloModel, 'id' | 'diaSemana' | 'salaCodigo'>,
   bloque: Pick<BloqueModel, 'inicio' | 'fin'>,
   semestre: Pick<SemestreModel, 'id' | 'fechaInicio' | 'fechaFin'>,
   titulo: string,
   responsableId: number | null,
   hoy: Date
) {
   await eliminarReservaSesion(sesion.id, hoy)
   if (!sesion.salaCodigo) return

   const tipoReserva = await prisma.tipoReserva.findFirst({ where: { nombre: 'Clase' } })
   if (!tipoReserva) {
      throw createError({
         statusCode: 422,
         message: 'No existe un tipo de reserva "Clase". Créalo en Reservas → Tipos antes de asignar salas.',
      })
   }

   const feriados = await prisma.feriado.findMany({ where: { semestreId: semestre.id } })
   const feriadosPorFecha = new Map(feriados.map((f) => [f.fecha.getTime(), f]))

   // El barrido empieza en el inicio del semestre (no en `hoy`) para que la cadencia semanal
   // caiga en el día correcto; las fechas anteriores a `hoy` simplemente se descartan.
   const fechas: Date[] = []
   const ultimaFecha = semestre.fechaFin
   for (
      let f = primeraFechaDelDia(semestre.fechaInicio, sesion.diaSemana);
      f <= ultimaFecha;
      f = new Date(f.getTime() + UNA_SEMANA_MS)
   ) {
      if (f < hoy) continue
      const feriado = feriadosPorFecha.get(f.getTime())
      if (!feriado || !feriadoCubreBloque(feriado, bloque)) fechas.push(f)
   }
   if (!fechas.length) return

   const serieId = randomUUID()
   await prisma.reserva.createMany({
      data: fechas.map((fecha) => ({
         salaCodigo: sesion.salaCodigo!,
         titulo,
         fecha,
         inicio: bloque.inicio,
         fin: bloque.fin,
         tipoReservaId: tipoReserva.id,
         personaId: responsableId,
         sesionParaleloId: sesion.id,
         serieId,
      })),
   })
}
