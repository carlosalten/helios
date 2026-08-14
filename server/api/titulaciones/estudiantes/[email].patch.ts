import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/estudiantes', 'editar')

   const email = getRouterParam(event, 'email')
   if (!email) throw createError({ statusCode: 400, message: 'Email inválido' })

   const existe = await prisma.ttEstudiante.findUnique({ where: { email } })
   if (!existe) throw createError({ statusCode: 404, message: 'Estudiante no encontrado' })

   const body = await readBody(event)
   const parsed = editarTtEstudianteSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const runDuplicado = await prisma.ttEstudiante.findFirst({ where: { run: parsed.data.run, NOT: { email } } })
   if (runDuplicado) throw createError({ statusCode: 409, message: 'Ya existe un estudiante con ese RUN' })

   const [proceso, grupo] = await Promise.all([
      prisma.ttProceso.findUnique({ where: { id: parsed.data.procesoId } }),
      parsed.data.grupoId == null ? null : prisma.ttGrupo.findUnique({ where: { id: parsed.data.grupoId } }),
   ])
   if (!proceso) throw createError({ statusCode: 404, message: 'Proceso no encontrado' })
   if (parsed.data.grupoId != null && !grupo) throw createError({ statusCode: 404, message: 'Grupo no encontrado' })

   const { password, ...datos } = parsed.data

   return prisma.ttEstudiante.update({
      where: { email },
      // Password en blanco: se deja intacta la actual, no se pisa con un valor vacío.
      data: password ? { ...datos, password: await bcrypt.hash(password, 12) } : datos,
      include: { proceso: true, grupo: true },
   })
})
