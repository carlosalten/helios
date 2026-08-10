export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/planes', 'borrar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.plan.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Plan no encontrado' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(existe.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Plan no encontrado' })
   }

   const tieneAsignaturas = await prisma.asignaturaPlan.findFirst({ where: { planId: id } })
   if (tieneAsignaturas) {
      throw createError({ statusCode: 409, message: 'No se puede eliminar: el plan tiene asignaturas asociadas' })
   }

   await prisma.plan.delete({ where: { id } })
   return { ok: true }
})
