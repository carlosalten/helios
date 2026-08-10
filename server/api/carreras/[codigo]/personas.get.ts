export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/carreras/asignacion', 'ver')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const codigo = Number(getRouterParam(event, 'codigo'))
   if (!Number.isInteger(codigo)) throw createError({ statusCode: 400, message: 'Código inválido' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(codigo)) {
      throw createError({ statusCode: 404, message: 'Carrera no encontrada' })
   }

   const carrera = await prisma.carrera.findUnique({ where: { codigo } })
   if (!carrera) throw createError({ statusCode: 404, message: 'Carrera no encontrada' })

   const [personas, asignadas] = await Promise.all([
      prisma.persona.findMany({
         orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
         include: { rol: true },
      }),
      prisma.carreraPersona.findMany({ where: { carreraCodigo: codigo }, select: { personaId: true } }),
   ])

   const asignadasSet = new Set(asignadas.map((a) => a.personaId))

   return personas.map((p) => ({ ...p, asignado: asignadasSet.has(p.id) }))
})
