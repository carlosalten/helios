export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/cursos', 'crear')
   const carrerasPermitidas = await resolverCarrerasCursos(usuario.rol, usuario.email)

   const body = await readBody(event)
   const parsed = crearCursoSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const [plan, semestre] = await Promise.all([
      prisma.plan.findUnique({ where: { id: parsed.data.planId } }),
      prisma.semestre.findUnique({ where: { id: parsed.data.semestreId } }),
   ])
   if (!plan) throw createError({ statusCode: 404, message: 'Plan no encontrado' })
   if (!semestre) throw createError({ statusCode: 404, message: 'Semestre no encontrado' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Plan no encontrado' })
   }

   const duplicado = await prisma.curso.findFirst({
      where: { planId: parsed.data.planId, semestreId: parsed.data.semestreId, nombre: parsed.data.nombre },
   })
   if (duplicado) {
      throw createError({ statusCode: 409, message: 'Ya existe un curso con ese nombre en el plan y semestre' })
   }

   return prisma.curso.create({
      data: parsed.data,
      include: { plan: { include: { carrera: true } }, semestre: true },
   })
})
