export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/grupos', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.ttGrupo.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Grupo no encontrado' })

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
      where: { procesoId: parsed.data.procesoId, numero: parsed.data.numero, id: { not: id } },
   })
   if (repetido) {
      throw createError({
         statusCode: 409,
         message: 'Ya existe un grupo con ese número en este proceso',
         data: { campo: 'numero' },
      })
   }

   return prisma.ttGrupo.update({ where: { id }, data: parsed.data, include: { proceso: true } })
})
