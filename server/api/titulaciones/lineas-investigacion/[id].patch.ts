export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/lineas-investigacion', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.ttLineaInvestigacion.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Línea de investigación no encontrada' })

   const body = await readBody(event)
   const parsed = crearTtLineaInvestigacionSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   return prisma.ttLineaInvestigacion.update({ where: { id }, data: parsed.data })
})
