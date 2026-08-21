// Además de /salas/gestion, este endpoint lo consumen /salas/pantallas, /salas/asignacion y
// /reservas/horario e /imprimir (para armar su panel de salas, acotado luego en el propio
// frontend por EncargadoSala) — un rol con 'ver' solo en esas rutas también necesita poder
// pedirlo.
export default defineEventHandler(async (event) => {
   await requiereAlgunPermiso(event, [
      ['/salas/gestion', 'ver'],
      ['/salas/pantallas', 'ver'],
      ['/salas/asignacion', 'ver'],
      ['/reservas/horario', 'ver'],
      ['/reservas/imprimir', 'ver'],
      ['/ayudantias', 'ver'],
   ])

   return prisma.sala.findMany({
      orderBy: { codigo: 'asc' },
      include: { tipoSala: true },
   })
})
