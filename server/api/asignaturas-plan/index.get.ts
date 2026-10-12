export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/planes/asignacion', 'ver')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   return prisma.asignaturaPlan.findMany({
      where: carrerasPermitidas ? { plan: { carreraCodigo: { in: carrerasPermitidas } } } : undefined,
      include: {
         asignatura: true,
         plan: { include: { carrera: true } },
         // Equivalentes en este plan (AsignaturaPlanEquivalente): las usa el formulario de "Nuevo
         // paralelo" de /paralelos — elegir una crea el paralelo bajo la asignatura del plan.
         equivalentes: { select: { asignatura: { select: { id: true, codigo: true, nombre: true } } } },
      },
      orderBy: { asignatura: { nombre: 'asc' } },
   })
})
