export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/planes/asignacion', 'editar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.asignaturaPlan.findUnique({ where: { id }, include: { plan: true } })
   if (!existe) throw createError({ statusCode: 404, message: 'Asignación no encontrada' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(existe.plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Asignación no encontrada' })
   }

   const body = await readBody(event)
   const parsed = actualizarSemestreAsignaturaPlanSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   // Al cambiar de semestre (o entrar/salir del cuadro de Electivos), va al final de la
   // columna destino por defecto (el cliente ajusta la posición final con un reordenar
   // posterior si el usuario soltó en un punto específico de la lista).
   const orden = await siguienteOrdenAsignaturaPlan(existe.planId, parsed.data.semestre, parsed.data.esElectiva)

   return prisma.asignaturaPlan.update({ where: { id }, data: { ...parsed.data, orden } })
})
