export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/salas/pantallas', 'editar')

   const body = await readBody(event)
   const parsed = toggleSalaPantallaSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }
   const { pantallaId, salaCodigo } = parsed.data

   const pantalla = await prisma.pantallaPublica.findUnique({ where: { id: pantallaId } })
   if (!pantalla) throw createError({ statusCode: 404, message: 'Pantalla no encontrada' })

   const sala = await prisma.sala.findUnique({ where: { codigo: salaCodigo } })
   if (!sala) throw createError({ statusCode: 404, message: 'Sala no encontrada' })

   const existente = await prisma.pantallaPublicaSala.findUnique({
      where: { pantallaId_salaCodigo: { pantallaId, salaCodigo } },
   })

   if (existente) {
      await prisma.pantallaPublicaSala.delete({ where: { id: existente.id } })
      return { asignada: false }
   }

   await prisma.pantallaPublicaSala.create({ data: { pantallaId, salaCodigo } })
   return { asignada: true }
})
