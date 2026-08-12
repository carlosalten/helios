import { randomUUID } from 'node:crypto'

// Crea una reserva recurrente semanal: una fila por semana entre `fecha` y `repetirHasta`
// (inclusive), todas con el mismo `serieId` para poder editarlas/borrarlas juntas después.
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/reservas/horario', 'crear')

   const body = await readBody(event)
   const parsed = crearReservaRecurrenteSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const [sala, persona, tipoReserva] = await Promise.all([
      prisma.sala.findUnique({ where: { codigo: parsed.data.salaCodigo } }),
      // personaId nulo = reserva sin responsable designado: no hay a quién buscar.
      parsed.data.personaId == null ? null : prisma.persona.findUnique({ where: { id: parsed.data.personaId } }),
      prisma.tipoReserva.findUnique({ where: { id: parsed.data.tipoReservaId } }),
   ])
   if (!sala) throw createError({ statusCode: 404, message: 'Sala no encontrada' })
   if (parsed.data.personaId != null && !persona)
      throw createError({ statusCode: 404, message: 'Persona no encontrada' })
   if (!tipoReserva) throw createError({ statusCode: 404, message: 'Tipo de reserva no encontrado' })

   const unaSemanaMs = 7 * 24 * 60 * 60 * 1000
   const primeraFecha = new Date(`${parsed.data.fecha}T00:00:00.000Z`)
   const ultimaFecha = new Date(`${parsed.data.repetirHasta}T00:00:00.000Z`)
   const fechas: Date[] = []
   for (let f = primeraFecha; f <= ultimaFecha; f = new Date(f.getTime() + unaSemanaMs)) {
      fechas.push(f)
   }

   const inicio = new Date(`1970-01-01T${parsed.data.inicio}:00.000Z`)
   const fin = new Date(`1970-01-01T${parsed.data.fin}:00.000Z`)
   const serieId = randomUUID()

   await prisma.reserva.createMany({
      data: fechas.map((fecha) => ({
         salaCodigo: parsed.data.salaCodigo,
         titulo: parsed.data.titulo,
         fecha,
         inicio,
         fin,
         tipoReservaId: parsed.data.tipoReservaId,
         personaId: parsed.data.personaId,
         publica: parsed.data.publica,
         serieId,
      })),
   })

   publicarEventoReserva(usuario, 'crear', parsed.data.salaCodigo)

   return { ok: true, cantidad: fechas.length }
})
