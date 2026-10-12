export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/semestres', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const semestre = await prisma.semestre.findUnique({ where: { id } })
   if (!semestre) throw createError({ statusCode: 404, message: 'Semestre no encontrado' })

   return prisma.semestre.update({ where: { id }, data: { visible: !semestre.visible } })
})
