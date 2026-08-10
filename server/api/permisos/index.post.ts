export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/permisos', 'crear')

   const body = await readBody(event)
   const parsed = crearPermisoSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const duplicado = await prisma.permiso.findUnique({
      where: { rol_ruta_accion: parsed.data },
   })
   if (duplicado) throw createError({ statusCode: 409, message: 'Ese permiso ya existe' })

   return prisma.permiso.create({ data: parsed.data })
})
