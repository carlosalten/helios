export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/salas/pantallas', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.pantallaPublica.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Pantalla no encontrada' })

   const body = await readBody(event)
   const parsed = editarPantallaPublicaSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   if (parsed.data.codigo !== existe.codigo) {
      const otraConEseCodigo = await prisma.pantallaPublica.findUnique({ where: { codigo: parsed.data.codigo } })
      if (otraConEseCodigo) throw createError({ statusCode: 409, message: 'Ya existe una pantalla con ese código' })
   }

   return prisma.pantallaPublica.update({ where: { id }, data: parsed.data })
})
