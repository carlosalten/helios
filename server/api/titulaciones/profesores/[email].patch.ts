export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/profesores', 'editar')

   const email = getRouterParam(event, 'email')
   if (!email) throw createError({ statusCode: 400, message: 'Email inválido' })

   const existe = await prisma.ttProfesor.findUnique({ where: { email } })
   if (!existe) throw createError({ statusCode: 404, message: 'Profesor no encontrado' })

   const body = await readBody(event)
   const parsed = editarTtProfesorSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const runDuplicado = await prisma.ttProfesor.findFirst({ where: { run: parsed.data.run, NOT: { email } } })
   if (runDuplicado) throw createError({ statusCode: 409, message: 'Ya existe un profesor con ese RUN' })

   return prisma.ttProfesor.update({ where: { email }, data: parsed.data })
})
