export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/planes/asignacion', 'ver')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   return prisma.asignaturaPlan.findMany({
      where: carrerasPermitidas ? { plan: { carreraCodigo: { in: carrerasPermitidas } } } : undefined,
      include: {
         asignatura: true,
         plan: { include: { carrera: true } },
      },
      orderBy: { asignatura: { nombre: 'asc' } },
   })
})
