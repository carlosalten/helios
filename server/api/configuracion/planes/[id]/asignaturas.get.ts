// Asignaturas del plan (las que ya están asociadas vía AsignaturaPlan) con su estado de
// exención de topes, para la lista de /configuracion. No se listan todas las asignaturas del
// sistema — solo tiene sentido exentar de topes a una que se dicte en este plan.
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/configuracion', 'ver')
   const carrerasPermitidas = await resolverCarrerasCursos(usuario.rol, usuario.email)

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const plan = await prisma.plan.findUnique({ where: { id } })
   if (!plan) throw createError({ statusCode: 404, message: 'Plan no encontrado' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Plan no encontrado' })
   }

   const asignaturasPlan = await prisma.asignaturaPlan.findMany({
      where: { planId: id },
      select: {
         id: true,
         semestre: true,
         esElectiva: true,
         exentaTope: true,
         asignatura: { select: { id: true, codigo: true, nombre: true } },
      },
   })

   return asignaturasPlan
      .map((ap) => ({
         asignaturaPlanId: ap.id,
         asignaturaId: ap.asignatura.id,
         codigo: ap.asignatura.codigo,
         nombre: ap.asignatura.nombre,
         semestre: ap.semestre,
         esElectiva: ap.esElectiva,
         exentaTope: ap.exentaTope,
      }))
      .sort(
         (a, b) =>
            Number(a.esElectiva) - Number(b.esElectiva) || a.semestre - b.semestre || a.codigo.localeCompare(b.codigo)
      )
})
