export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/procesos', 'crear')

   const body = await readBody(event)
   const parsed = crearTtProcesoSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   return prisma.ttProceso.create({ data: parsed.data })
})
