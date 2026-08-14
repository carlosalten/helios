export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/procesos', 'ver')

   return prisma.ttProceso.findMany({ orderBy: { anio: 'desc' } })
})
