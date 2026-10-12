import { Prisma } from '../../../../generated/prisma/client'

// Da de alta o de baja una equivalencia de un plan (ver AsignaturaPlanEquivalente en
// schema.prisma): `asignaturaId` pasa a aceptarse como la asignatura de la malla
// `asignaturaPlanId`, solo en ese plan. Acotado por carrera, igual que editar la malla en
// /planes/asignacion.
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/asignaturas/equivalencias', 'editar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const body = await readBody(event)
   const parsed = toggleEquivalenciaSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }
   const { asignaturaPlanId, asignaturaId } = parsed.data

   const [asignaturaPlan, asignatura] = await Promise.all([
      prisma.asignaturaPlan.findUnique({ where: { id: asignaturaPlanId }, include: { plan: true } }),
      prisma.asignatura.findUnique({ where: { id: asignaturaId }, select: { id: true, codigo: true } }),
   ])
   if (!asignaturaPlan) throw createError({ statusCode: 404, message: 'Asignatura no encontrada en el plan' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(asignaturaPlan.plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Asignatura no encontrada en el plan' })
   }
   if (!asignatura) throw createError({ statusCode: 404, message: 'Asignatura no encontrada' })

   const existente = await prisma.asignaturaPlanEquivalente.findUnique({
      where: { planId_asignaturaId: { planId: asignaturaPlan.planId, asignaturaId } },
      include: { asignaturaPlan: { include: { asignatura: { select: { codigo: true } } } } },
   })

   if (existente && existente.asignaturaPlanId === asignaturaPlanId) {
      await prisma.asignaturaPlanEquivalente.delete({ where: { id: existente.id } })
      return { equivalente: false }
   }

   // Validaciones de alta (ver AsignaturaPlanEquivalente): no a sí misma, no otra asignatura de
   // la malla, y a lo más una asignatura del plan por equivalente.
   if (asignaturaId === asignaturaPlan.asignaturaId) {
      throw createError({ statusCode: 422, message: 'Una asignatura no puede ser equivalente a sí misma' })
   }
   const enMalla = await prisma.asignaturaPlan.findUnique({
      where: { asignaturaId_planId: { asignaturaId, planId: asignaturaPlan.planId } },
   })
   if (enMalla) {
      throw createError({
         statusCode: 422,
         message: `${asignatura.codigo} ya está en la malla de este plan: no puede ser equivalente`,
      })
   }
   if (existente) {
      throw createError({
         statusCode: 409,
         message: `${asignatura.codigo} ya es equivalente a ${existente.asignaturaPlan.asignatura.codigo} en este plan`,
      })
   }

   try {
      await prisma.asignaturaPlanEquivalente.create({
         data: { asignaturaPlanId, asignaturaId, planId: asignaturaPlan.planId },
      })
   } catch (e: unknown) {
      // Otra persona la asignó a la vez a otra asignatura del plan (@@unique [planId, asignaturaId]).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
         throw createError({ statusCode: 409, message: `${asignatura.codigo} ya es equivalente en este plan` })
      }
      throw e
   }
   return { equivalente: true }
})
