export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/paralelos', 'editar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const body = await readBody(event)
   const parsed = reordenarParalelosSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const { cursoId, ordenIds } = parsed.data

   const curso = await prisma.curso.findUnique({ where: { id: cursoId }, include: { plan: true } })
   if (!curso) throw createError({ statusCode: 404, message: 'Curso no encontrado' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(curso.plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Curso no encontrado' })
   }

   const columna = await prisma.paralelo.findMany({ where: { cursoId }, select: { id: true } })
   const idsColumna = new Set(columna.map((p) => p.id))
   if (ordenIds.length !== idsColumna.size || !ordenIds.every((id) => idsColumna.has(id))) {
      throw createError({ statusCode: 422, message: 'La lista de orden no coincide con los paralelos de ese curso' })
   }

   await prisma.$transaction(ordenIds.map((id, orden) => prisma.paralelo.update({ where: { id }, data: { orden } })))

   // El orden se refleja en el panel lateral de /horario.
   publicarEventoHorario({
      tipo: 'paralelo',
      accion: 'editar',
      semestreId: curso.semestreId,
      cursoId: curso.id,
      descripcion: curso.nombre,
      autorEmail: usuario.email,
      autorNombre: `${usuario.nombre} ${usuario.apellido}`,
   })

   return { ok: true }
})
