export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/roles', 'crear')

   const body = await readBody(event)
   const parsed = crearTtRolSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   return prisma.ttRol.create({ data: parsed.data })
})
