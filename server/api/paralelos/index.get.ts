// Ver la lista de paralelos NO se acota por carrera: cualquiera con 'ver' en /paralelos ve
// los de todas las carreras. Las mutaciones sí quedan acotadas — ver index.post.ts,
// [id].patch.ts, [id].delete.ts y reordenar.post.ts, que usan resolverCarrerasJefe.
//
// La lista también la consume, de solo lectura, /horario (panel lateral de paralelos del
// curso) y /paralelos/asignacion (armar la malla). Basta con tener 'ver' en cualquiera de
// las tres — un Apoyo Docente con permiso en /horario pero no en /paralelos necesita esta
// lista igual para que el panel no aparezca vacío.
export default defineEventHandler(async (event) => {
   await requiereAlgunPermiso(event, [
      ['/paralelos', 'ver'],
      ['/paralelos/asignacion', 'ver'],
      ['/horario', 'ver'],
      ['/ayudantias', 'ver'],
   ])

   return prisma.paralelo.findMany({
      orderBy: [{ curso: { semestreId: 'asc' } }, { cursoId: 'asc' }, { orden: 'asc' }],
      include: {
         curso: { include: { semestre: true } },
         asignaturaPlan: {
            include: {
               asignatura: true,
               plan: { include: { carrera: true } },
            },
         },
      },
   })
})
