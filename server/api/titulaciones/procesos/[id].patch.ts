export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/procesos', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.ttProceso.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Proceso no encontrado' })

   const body = await readBody(event)
   const parsed = crearTtProcesoSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   return prisma.ttProceso.update({ where: { id }, data: parsed.data })
})
