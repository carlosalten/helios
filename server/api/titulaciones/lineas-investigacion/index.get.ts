export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/lineas-investigacion', 'ver')

   return prisma.ttLineaInvestigacion.findMany({ orderBy: { nombre: 'asc' } })
})
