export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/roles', 'crear')

   const body = await readBody(event)
   const parsed = crearTtRolSchema.safeParse(body)
   if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw createError({
         statusCode: 422,
         message: issue?.message ?? 'Datos inválidos',
         data: { campo: issue?.path[0] },
      })
   }

   return prisma.ttRol.create({ data: parsed.data })
})
