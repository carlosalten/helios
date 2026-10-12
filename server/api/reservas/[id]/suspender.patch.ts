// Suspende (o reactiva) una reserva puntual: a diferencia de borrarla, queda visible pero
// destacada — se usa para avisar que una clase u otro uso de sala puntual no se realiza ese
// día sin perder el registro de que la sala estaba tomada. Solo afecta esta ocurrencia, nunca
// la serie completa de una reserva recurrente (no tiene el flujo "esta y las siguientes" que sí
// tienen editar/borrar — suspender una serie completa se hace ocurrencia por ocurrencia). El
// alcance (`puedeSuspenderReserva`) es más amplio que el de editar/borrar: los roles marcados
// con `Rol.suspenderCualquierReserva` (/configuracion) pueden suspender cualquier reserva,
// aunque no puedan editarla ni borrarla.
//
// Body opcional `{ ids }`: otras reservas que se alternan junto con `:id`. Lo manda la grilla
// de /horario/salas-semanal cuando la tarjeta fusiona varios bloques contiguos de una misma
// clase (una Reserva por bloque): suspender la tarjeta suspende todos sus bloques. El estado
// resultante sale de `:id` (todos los bloques de una tarjeta fusionada comparten `suspendida`)
// y se aplica igual a todas; el alcance se valida reserva por reserva.

//
// El permiso `editar` puede venir de /horario/salas-semanal o de /ayudantias: la página de
// Ayudantías también permite suspender una ayudantía.
export default defineEventHandler(async (event) => {
   const usuario = await requiereAlgunPermiso(event, [
      ['/horario/salas-semanal', 'editar'],
      ['/ayudantias', 'editar'],
   ])

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const body = await readBody(event)
   const parsed = suspenderReservaSchema.safeParse(body ?? {})
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }
   const idsAdicionales = [...new Set(parsed.data.ids ?? [])].filter((otro) => otro !== id)

   const existe = await prisma.reserva.findUnique({ where: { id }, include: incluirAlcanceReserva })
   if (!existe) throw createError({ statusCode: 404, message: 'Reserva no encontrada' })
   if (!(await puedeSuspenderReserva(usuario, existe))) {
      throw createError({ statusCode: 403, message: 'No tienes permiso para modificar esta reserva' })
   }

   const adicionales = idsAdicionales.length
      ? await prisma.reserva.findMany({ where: { id: { in: idsAdicionales } }, include: incluirAlcanceReserva })
      : []
   if (adicionales.length !== idsAdicionales.length) {
      throw createError({ statusCode: 404, message: 'Reserva no encontrada' })
   }
   for (const otra of adicionales) {
      if (!(await puedeSuspenderReserva(usuario, otra))) {
         throw createError({ statusCode: 403, message: 'No tienes permiso para modificar esta reserva' })
      }
   }

   const suspendida = !existe.suspendida
   if (adicionales.length) {
      await prisma.reserva.updateMany({ where: { id: { in: idsAdicionales } }, data: { suspendida } })
   }

   const reserva = await prisma.reserva.update({
      where: { id },
      data: { suspendida },
      include: {
         sala: true,
         persona: { select: { id: true, nombre: true, apellido: true } },
         tipoReserva: true,
      },
   })

   // Los bloques fusionados son de la misma sala, así que un solo evento basta.
   publicarEventoReserva(usuario, 'editar', reserva.salaCodigo)

   return reserva
})
