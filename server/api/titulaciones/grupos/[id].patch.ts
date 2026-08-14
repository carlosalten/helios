export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/grupos', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.ttGrupo.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Grupo no encontrado' })

   const body = await readBody(event)
   const parsed = crearTtGrupoSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const proceso = await prisma.ttProceso.findUnique({ where: { id: parsed.data.procesoId } })
   if (!proceso) throw createError({ statusCode: 404, message: 'Proceso no encontrado' })

   return prisma.ttGrupo.update({ where: { id }, data: parsed.data, include: { proceso: true } })
})
