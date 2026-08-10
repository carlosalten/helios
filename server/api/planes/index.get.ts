// Ver la lista de planes NO se acota por carrera: cualquiera con 'ver' en /planes ve los de
// todas las carreras (usado también, entre otras, para elegir el plan en /paralelos/asignacion,
// donde un Jefe de Carrera necesita poder ver la malla de otra carrera aunque no pueda
// editarla). Las mutaciones sí quedan acotadas — ver index.post.ts, [id].patch.ts y
// [id].delete.ts, que usan resolverCarrerasJefe.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/planes', 'ver')

   return prisma.plan.findMany({
      orderBy: [{ carreraCodigo: 'asc' }, { numero: 'asc' }],
      include: { carrera: true },
   })
})
