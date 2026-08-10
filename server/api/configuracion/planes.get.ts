// Planes disponibles para el selector de /configuracion: mismo alcance que /api/cursos/planes
// (resolverCarrerasCursos) — el Administrador ve todos, un Director Departamento o Jefe de
// Carrera solo los de las carreras a las que está asociado o que dirige.
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/configuracion', 'ver')
   const carrerasPermitidas = await resolverCarrerasCursos(usuario.rol, usuario.email)

   return prisma.plan.findMany({
      where: carrerasPermitidas ? { carreraCodigo: { in: carrerasPermitidas } } : undefined,
      orderBy: [{ carreraCodigo: 'asc' }, { numero: 'asc' }],
      include: { carrera: true },
   })
})
