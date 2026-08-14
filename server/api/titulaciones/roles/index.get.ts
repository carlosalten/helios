export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/roles', 'ver')

   return prisma.ttRol.findMany({ orderBy: { nombre: 'asc' } })
})
