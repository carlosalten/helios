export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/paralelos', 'crear')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const body = await readBody(event)
   const parsed = crearParaleloSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const [asignaturaPlan, curso] = await Promise.all([
      prisma.asignaturaPlan.findUnique({ where: { id: parsed.data.asignaturaPlanId }, include: { plan: true } }),
      prisma.curso.findUnique({ where: { id: parsed.data.cursoId } }),
   ])
   if (!asignaturaPlan) throw createError({ statusCode: 404, message: 'Asignatura no encontrada en el plan' })
   if (!curso) throw createError({ statusCode: 404, message: 'Curso no encontrado' })
   if (curso.planId !== asignaturaPlan.planId) {
      throw createError({ statusCode: 422, message: 'El curso no pertenece al plan de la asignatura' })
   }
   if (carrerasPermitidas && !carrerasPermitidas.includes(asignaturaPlan.plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Asignatura no encontrada en el plan' })
   }

   const orden = await siguienteOrdenParalelo(parsed.data.cursoId)

   const creado = await prisma.paralelo.create({
      data: { ...parsed.data, orden },
      include: {
         curso: { include: { semestre: true } },
         asignaturaPlan: {
            include: { asignatura: true, plan: { include: { carrera: true } } },
         },
      },
   })

   // El paralelo aparece en el panel lateral de /horario, desde donde se arrastra a la matriz.
   publicarEventoHorario({
      tipo: 'paralelo',
      accion: 'crear',
      semestreId: creado.curso.semestreId,
      cursoId: creado.cursoId,
      descripcion: creado.curso.nombre,
      autorEmail: usuario.email,
      autorNombre: `${usuario.nombre} ${usuario.apellido}`,
   })

   return creado
})
