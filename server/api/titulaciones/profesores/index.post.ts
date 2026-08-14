export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/profesores', 'crear')

   const body = await readBody(event)
   const parsed = crearTtProfesorSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const existe = await prisma.ttProfesor.findUnique({ where: { email: parsed.data.email } })
   if (existe) throw createError({ statusCode: 409, message: 'Ya existe un profesor con ese email' })

   const runDuplicado = await prisma.ttProfesor.findUnique({ where: { run: parsed.data.run } })
   if (runDuplicado) throw createError({ statusCode: 409, message: 'Ya existe un profesor con ese RUN' })

   return prisma.ttProfesor.create({ data: parsed.data })
})
