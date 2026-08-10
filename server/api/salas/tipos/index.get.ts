export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/salas/tipos', 'ver')

   return prisma.tipoSala.findMany({ orderBy: { nombre: 'asc' } })
})
