export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/salas/pantallas', 'borrar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.pantallaPublica.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Pantalla no encontrada' })

   // `PantallaPublicaSala` se borra en cascada (onDelete: Cascade en el schema).
   await prisma.pantallaPublica.delete({ where: { id } })

   return { ok: true }
})
