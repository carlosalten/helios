export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/semestres', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const semestre = await prisma.semestre.findUnique({ where: { id } })
   if (!semestre) throw createError({ statusCode: 404, message: 'Semestre no encontrado' })

   // Solo un semestre puede estar marcado como borrador a la vez.
   const actualizado = await prisma.$transaction(async (tx) => {
      await tx.semestre.updateMany({ where: { id: { not: id }, borrador: true }, data: { borrador: false } })
      return tx.semestre.update({ where: { id }, data: { borrador: true } })
   })

   return actualizado
})
