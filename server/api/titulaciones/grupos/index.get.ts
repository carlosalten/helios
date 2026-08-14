export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/grupos', 'ver')

   return prisma.ttGrupo.findMany({
      orderBy: { nombre: 'asc' },
      include: { proceso: true },
   })
})
