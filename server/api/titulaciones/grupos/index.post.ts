export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/grupos', 'crear')

   const body = await readBody(event)
   const parsed = crearTtGrupoSchema.safeParse(body)
   if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw createError({
         statusCode: 422,
         message: issue?.message ?? 'Datos inválidos',
         data: { campo: issue?.path[0] },
      })
   }

   const proceso = await prisma.ttProceso.findUnique({ where: { id: parsed.data.procesoId } })
   if (!proceso) throw createError({ statusCode: 404, message: 'Proceso no encontrado' })

   const repetido = await prisma.ttGrupo.findFirst({
      where: { procesoId: parsed.data.procesoId, numero: parsed.data.numero },
   })
   if (repetido) {
      throw createError({
         statusCode: 409,
         message: 'Ya existe un grupo con ese número en este proceso',
         data: { campo: 'numero' },
      })
   }

   return prisma.ttGrupo.create({ data: parsed.data, include: { proceso: true } })
})
