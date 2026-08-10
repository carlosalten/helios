export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/planes', 'crear')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const body = await readBody(event)
   const parsed = crearPlanSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const carrera = await prisma.carrera.findUnique({ where: { codigo: parsed.data.carreraCodigo } })
   if (!carrera) throw createError({ statusCode: 404, message: 'Carrera no encontrada' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(parsed.data.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Carrera no encontrada' })
   }

   return prisma.plan.create({ data: parsed.data, include: { carrera: true } })
})
