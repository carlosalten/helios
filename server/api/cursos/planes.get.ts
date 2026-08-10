// Planes disponibles para el selector de carrera/plan al crear o editar un curso: el
// mismo alcance que usan crear/editar/borrar (resolverCarrerasCursos), para que la lista
// no ofrezca planes que luego el backend rechazaría por carrera.
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/cursos', 'ver')
   const carrerasPermitidas = await resolverCarrerasCursos(usuario.rol, usuario.email)

   return prisma.plan.findMany({
      where: carrerasPermitidas ? { carreraCodigo: { in: carrerasPermitidas } } : undefined,
      orderBy: [{ carreraCodigo: 'asc' }, { numero: 'asc' }],
      include: { carrera: true },
   })
})
