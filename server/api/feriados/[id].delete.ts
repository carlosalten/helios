export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/feriados', 'borrar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.feriado.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Feriado no encontrado' })

   await prisma.feriado.delete({ where: { id } })
   return { ok: true }
})
