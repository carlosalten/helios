// Ver las sesiones del horario se acota por carrera para la mayoría de los roles
// (resolverCarrerasAsignadas): cada quien ve las que dirige o tiene asignadas. 'Administrador'
// y 'Jefe de Carrera' ven las de todas (un Jefe de Carrera puede revisar cómo va otra, igual
// que con /paralelos, /cursos, /planes y /carreras). Las mutaciones quedan acotadas aparte —
// ver index.post.ts, [id]/mover.patch.ts, [id]/index.patch.ts e [id]/index.delete.ts, que usan
// resolverCarrerasJefe.
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/horario', 'ver')
   const carrerasPermitidas = await resolverCarrerasAsignadas(usuario.rol, usuario.email)

   const query = getQuery(event)
   const semestreId = query.semestreId ? Number(query.semestreId) : undefined
   if (semestreId !== undefined && !Number.isInteger(semestreId)) {
      throw createError({ statusCode: 400, message: 'semestreId inválido' })
   }

   const sesiones = await prisma.sesionParalelo.findMany({
      where: {
         paralelo: {
            curso: {
               ...(semestreId !== undefined && { semestreId }),
               ...(carrerasPermitidas && { plan: { carreraCodigo: { in: carrerasPermitidas } } }),
            },
         },
      },
      include: incluirSesion,
   })

   return sesiones.map(mapearSesion)
})
