// Alterna si una asignatura (dentro de un plan puntual, vía AsignaturaPlan) queda exenta de
// las advertencias de topes de horario. `id` es el id de AsignaturaPlan, no el de Asignatura:
// la exención es por (asignatura, plan), así que hay que tocar la fila exacta.
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/configuracion', 'editar')
   const carrerasPermitidas = await resolverCarrerasCursos(usuario.rol, usuario.email)

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const asignaturaPlan = await prisma.asignaturaPlan.findUnique({ where: { id }, include: { plan: true } })
   if (!asignaturaPlan) throw createError({ statusCode: 404, message: 'Asignatura de plan no encontrada' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(asignaturaPlan.plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Asignatura de plan no encontrada' })
   }

   const actualizada = await prisma.asignaturaPlan.update({
      where: { id },
      data: { exentaTope: !asignaturaPlan.exentaTope },
      select: { exentaTope: true },
   })

   return { exentaTope: actualizada.exentaTope }
})
