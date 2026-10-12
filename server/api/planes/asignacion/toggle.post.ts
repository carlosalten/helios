export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/planes/asignacion', 'editar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const body = await readBody(event)
   const parsed = toggleAsignaturaPlanSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const { planId, asignaturaId, semestre, esElectiva } = parsed.data

   const plan = await prisma.plan.findUnique({ where: { id: planId } })
   if (!plan) throw createError({ statusCode: 404, message: 'Plan no encontrado' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Plan no encontrado' })
   }

   const asignatura = await prisma.asignatura.findUnique({ where: { id: asignaturaId } })
   if (!asignatura) throw createError({ statusCode: 404, message: 'Asignatura no encontrada' })

   const existente = await prisma.asignaturaPlan.findUnique({
      where: { asignaturaId_planId: { asignaturaId, planId } },
   })

   if (existente) {
      const tieneParalelos = await prisma.paralelo.findFirst({ where: { asignaturaPlanId: existente.id } })
      if (tieneParalelos) {
         throw createError({
            statusCode: 409,
            message: 'No se puede quitar: la asignatura tiene paralelos asociados en este plan',
         })
      }
      await prisma.asignaturaPlan.delete({ where: { id: existente.id } })
      return { asignado: false }
   }

   // Una equivalente de este plan no puede pasar a ser además asignatura de su malla (ver
   // AsignaturaPlanEquivalente): primero hay que quitar la equivalencia.
   const comoEquivalente = await prisma.asignaturaPlanEquivalente.findUnique({
      where: { planId_asignaturaId: { planId, asignaturaId } },
      include: { asignaturaPlan: { include: { asignatura: { select: { codigo: true } } } } },
   })
   if (comoEquivalente) {
      throw createError({
         statusCode: 409,
         message: `${asignatura.codigo} es equivalente a ${comoEquivalente.asignaturaPlan.asignatura.codigo} en este plan. Quita esa equivalencia en Asignaturas → Equivalencias antes de agregarla a la malla.`,
      })
   }

   const orden = await siguienteOrdenAsignaturaPlan(planId, semestre, esElectiva)
   await prisma.asignaturaPlan.create({ data: { planId, asignaturaId, semestre, esElectiva, orden } })
   return { asignado: true }
})
