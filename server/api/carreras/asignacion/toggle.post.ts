export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/carreras/asignacion', 'editar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const body = await readBody(event)
   const parsed = toggleAsignacionCarreraSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const { carreraCodigo, personaId } = parsed.data
   if (carrerasPermitidas && !carrerasPermitidas.includes(carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Carrera no encontrada' })
   }

   const carrera = await prisma.carrera.findUnique({ where: { codigo: carreraCodigo } })
   if (!carrera) throw createError({ statusCode: 404, message: 'Carrera no encontrada' })

   const persona = await prisma.persona.findUnique({ where: { id: personaId } })
   if (!persona) throw createError({ statusCode: 404, message: 'Persona no encontrada' })

   const existente = await prisma.carreraPersona.findUnique({
      where: { personaId_carreraCodigo: { personaId, carreraCodigo } },
   })

   if (existente) {
      await prisma.carreraPersona.delete({ where: { id: existente.id } })
      return { asignado: false }
   }

   await prisma.carreraPersona.create({ data: { personaId, carreraCodigo } })
   return { asignado: true }
})
