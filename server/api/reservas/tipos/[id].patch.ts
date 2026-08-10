export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/reservas/tipos', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (isNaN(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.tipoReserva.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Tipo de reserva no encontrado' })

   const body = await readBody(event)
   const parsed = crearTipoReservaSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const duplicado = await prisma.tipoReserva.findFirst({ where: { nombre: parsed.data.nombre, NOT: { id } } })
   if (duplicado) throw createError({ statusCode: 409, message: 'Ya existe un tipo de reserva con ese nombre' })

   return prisma.tipoReserva.update({ where: { id }, data: parsed.data })
})
