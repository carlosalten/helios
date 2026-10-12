// Planes para el selector de /asignaturas/equivalencias. Ver los planes no se acota por
// carrera (igual que /api/planes); modificar sus equivalencias sí — ver toggle.post.ts.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/asignaturas/equivalencias', 'ver')

   return prisma.plan.findMany({
      orderBy: [{ carreraCodigo: 'asc' }, { numero: 'asc' }],
      include: { carrera: true },
   })
})
