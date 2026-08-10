export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/permisos', 'borrar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.permiso.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Permiso no encontrado' })

   await prisma.permiso.delete({ where: { id } })
   return { ok: true }
})
