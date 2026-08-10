export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/planes/asignacion', 'editar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const body = await readBody(event)
   const parsed = reordenarAsignaturaPlanSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const { planId, semestre, esElectiva, ordenIds } = parsed.data

   const plan = await prisma.plan.findUnique({ where: { id: planId } })
   if (!plan) throw createError({ statusCode: 404, message: 'Plan no encontrado' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Plan no encontrado' })
   }

   const columna = await prisma.asignaturaPlan.findMany({
      where: esElectiva ? { planId, esElectiva: true } : { planId, esElectiva: false, semestre },
      select: { id: true },
   })
   const idsColumna = new Set(columna.map((a) => a.id))
   if (ordenIds.length !== idsColumna.size || !ordenIds.every((id) => idsColumna.has(id))) {
      throw createError({
         statusCode: 422,
         message: 'La lista de orden no coincide con las asignaturas de ese semestre',
      })
   }

   await prisma.$transaction(
      ordenIds.map((id, orden) => prisma.asignaturaPlan.update({ where: { id }, data: { orden } }))
   )

   return { ok: true }
})
