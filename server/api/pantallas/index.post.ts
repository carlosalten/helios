export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/salas/pantallas', 'crear')

   const body = await readBody(event)
   const parsed = crearPantallaPublicaSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const existe = await prisma.pantallaPublica.findUnique({ where: { codigo: parsed.data.codigo } })
   if (existe) throw createError({ statusCode: 409, message: 'Ya existe una pantalla con ese código' })

   const creada = await prisma.pantallaPublica.create({ data: parsed.data })
   return { ...creada, salas: [] }
})
