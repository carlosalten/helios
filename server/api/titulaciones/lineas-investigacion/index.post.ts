export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/lineas-investigacion', 'crear')

   const body = await readBody(event)
   const parsed = crearTtLineaInvestigacionSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   return prisma.ttLineaInvestigacion.create({ data: parsed.data })
})
