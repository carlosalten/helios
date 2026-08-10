export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/asignaturas', 'ver')

   return prisma.asignatura.findMany({
      orderBy: { nombre: 'asc' },
      include: {
         asignaturasPlan: {
            include: { plan: { include: { carrera: true } } },
            orderBy: { plan: { carrera: { nombre: 'asc' } } },
         },
      },
   })
})
