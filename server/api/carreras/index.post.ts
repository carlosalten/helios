export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/carreras', 'crear')

   const body = await readBody(event)
   const parsed = crearCarreraSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const existe = await prisma.carrera.findUnique({ where: { codigo: parsed.data.codigo } })
   if (existe) throw createError({ statusCode: 409, message: 'Ya existe una carrera con ese código' })

   const duplicadoNombre = await prisma.carrera.findFirst({ where: { nombre: parsed.data.nombre } })
   if (duplicadoNombre) throw createError({ statusCode: 409, message: 'Ya existe una carrera con ese nombre' })

   await validarJefeCarrera(parsed.data.jefePersonaId)

   return prisma.carrera.create({
      data: parsed.data,
      include: { jefe: { include: { rol: true } } },
   })
})
