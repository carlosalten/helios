import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/estudiantes', 'crear')

   const body = await readBody(event)
   const parsed = crearTtEstudianteSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const existe = await prisma.ttEstudiante.findUnique({ where: { email: parsed.data.email } })
   if (existe) throw createError({ statusCode: 409, message: 'Ya existe un estudiante con ese email' })

   const runDuplicado = await prisma.ttEstudiante.findUnique({ where: { run: parsed.data.run } })
   if (runDuplicado) throw createError({ statusCode: 409, message: 'Ya existe un estudiante con ese RUN' })

   const [proceso, grupo] = await Promise.all([
      prisma.ttProceso.findUnique({ where: { id: parsed.data.procesoId } }),
      parsed.data.grupoId == null ? null : prisma.ttGrupo.findUnique({ where: { id: parsed.data.grupoId } }),
   ])
   if (!proceso) throw createError({ statusCode: 404, message: 'Proceso no encontrado' })
   if (parsed.data.grupoId != null && !grupo) throw createError({ statusCode: 404, message: 'Grupo no encontrado' })

   const hash = await bcrypt.hash(parsed.data.password, 12)

   return prisma.ttEstudiante.create({
      data: { ...parsed.data, password: hash },
      include: { proceso: true, grupo: true },
   })
})
