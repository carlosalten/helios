export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/reservas/tipos', 'ver')

   return prisma.tipoReserva.findMany({ orderBy: { nombre: 'asc' } })
})
