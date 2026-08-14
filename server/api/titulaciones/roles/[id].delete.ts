export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/roles', 'borrar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.ttRol.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Rol no encontrado' })

   const tienePropuestas = await prisma.ttPropuesta.findFirst({ where: { rolId: id } })
   if (tienePropuestas) {
      throw createError({
         statusCode: 409,
         message: 'No se puede eliminar: el rol está asociado a una o más propuestas',
      })
   }

   await prisma.ttRol.delete({ where: { id } })
   return { ok: true }
})
