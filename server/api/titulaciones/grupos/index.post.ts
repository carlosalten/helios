export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/grupos', 'crear')

   const body = await readBody(event)
   const parsed = crearTtGrupoSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const proceso = await prisma.ttProceso.findUnique({ where: { id: parsed.data.procesoId } })
   if (!proceso) throw createError({ statusCode: 404, message: 'Proceso no encontrado' })

   return prisma.ttGrupo.create({ data: parsed.data, include: { proceso: true } })
})
