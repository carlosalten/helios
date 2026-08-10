// Ver las sesiones del horario NO se acota por carrera: cualquiera con 'ver' en /horario ve
// las de todas las carreras (un Jefe de Carrera puede revisar cómo va otra, igual que con
// /paralelos, /cursos, /planes y /carreras). Las mutaciones sí quedan acotadas — ver
// index.post.ts, [id]/mover.patch.ts, [id]/index.patch.ts e [id]/index.delete.ts, que usan
// resolverCarrerasJefe.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/horario', 'ver')

   const query = getQuery(event)
   const semestreId = query.semestreId ? Number(query.semestreId) : undefined
   if (semestreId !== undefined && !Number.isInteger(semestreId)) {
      throw createError({ statusCode: 400, message: 'semestreId inválido' })
   }

   const sesiones = await prisma.sesionParalelo.findMany({
      where: {
         ...(semestreId !== undefined && { paralelo: { curso: { semestreId } } }),
      },
      include: incluirSesion,
   })

   return sesiones.map(mapearSesion)
})
