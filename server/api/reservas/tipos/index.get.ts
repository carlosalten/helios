// Además de /reservas/tipos (gestión), lo consume /reservas/horario para poblar el selector de
// tipo al crear una reserva — un rol con 'ver' solo ahí también necesita poder pedirlo.
export default defineEventHandler(async (event) => {
   await requiereAlgunPermiso(event, [
      ['/reservas/tipos', 'ver'],
      ['/reservas/horario', 'ver'],
      ['/ayudantias', 'ver'],
   ])

   return prisma.tipoReserva.findMany({ orderBy: { nombre: 'asc' } })
})
