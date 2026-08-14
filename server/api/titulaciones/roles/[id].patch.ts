export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/roles', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.ttRol.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Rol no encontrado' })

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

   return prisma.ttRol.update({ where: { id }, data: parsed.data })
})
