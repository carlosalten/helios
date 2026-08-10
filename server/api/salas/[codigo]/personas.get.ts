export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/salas/asignacion', 'ver')

   const codigo = getRouterParam(event, 'codigo')
   if (!codigo) throw createError({ statusCode: 400, message: 'Código inválido' })

   const sala = await prisma.sala.findUnique({ where: { codigo } })
   if (!sala) throw createError({ statusCode: 404, message: 'Sala no encontrada' })

   const [personas, encargados] = await Promise.all([
      prisma.persona.findMany({
         // Un profesor de jornada parcial o una persona con rol 'Externo' no puede quedar como
         // encargado de una sala. `jornadaLaboral` es nulo para todo el que no sea profesor (ver
         // Persona en schema.prisma) — `not: 'PARCIAL'` por sí solo excluiría también esos nulos
         // (NULL <> 'PARCIAL' no es true en SQL), así que se admite explícitamente `null`.
         where: {
            OR: [{ jornadaLaboral: null }, { jornadaLaboral: { not: 'PARCIAL' } }],
            rol: { nombre: { not: 'Externo' } },
         },
         orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
         include: { rol: true },
      }),
      prisma.encargadoSala.findMany({ where: { salaCodigo: codigo }, select: { personaId: true } }),
   ])

   const asignadas = new Set(encargados.map((e) => e.personaId))

   return personas.map((p) => ({ ...p, asignado: asignadas.has(p.id) }))
})
