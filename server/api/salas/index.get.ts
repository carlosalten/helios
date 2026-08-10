export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/salas/gestion', 'ver')

   return prisma.sala.findMany({
      orderBy: { codigo: 'asc' },
      include: { tipoSala: true },
   })
})
