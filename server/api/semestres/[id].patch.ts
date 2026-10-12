export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/semestres', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.semestre.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Semestre no encontrado' })

   const body = await readBody(event)
   const parsed = crearSemestreSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   // Solo un semestre puede estar vigente a la vez, y a lo más uno marcado como borrador (son
   // independientes entre sí: un semestre puede ser borrador mientras otro distinto sigue
   // vigente).
   if (parsed.data.vigente || parsed.data.borrador) {
      return prisma.$transaction(async (tx) => {
         if (parsed.data.vigente) {
            await tx.semestre.updateMany({ where: { id: { not: id }, vigente: true }, data: { vigente: false } })
         }
         if (parsed.data.borrador) {
            await tx.semestre.updateMany({
               where: { id: { not: id }, borrador: true },
               data: { borrador: false },
            })
         }
         return tx.semestre.update({ where: { id }, data: parsed.data })
      })
   }

   return prisma.semestre.update({ where: { id }, data: parsed.data })
})
