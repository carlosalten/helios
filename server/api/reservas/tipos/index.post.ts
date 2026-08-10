export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/reservas/tipos', 'crear')

   const body = await readBody(event)
   const parsed = crearTipoReservaSchema.safeParse(body)
   if (!parsed.success)
      throw createError({
         statusCode: 422,
         message: parsed.error.issues[0]?.message ?? 'Datos inválidos',
      })

   const existe = await prisma.tipoReserva.findFirst({ where: { nombre: parsed.data.nombre } })
   if (existe)
      throw createError({
         statusCode: 409,
         message: 'Ya existe un tipo de reserva con ese nombre',
      })

   return prisma.tipoReserva.create({ data: parsed.data })
})
