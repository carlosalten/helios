export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/horario', 'crear')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const body = await readBody(event)
   const parsed = crearSesionSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const { paraleloId, diaSemana, bloqueId, tipo } = parsed.data

   const paralelo = await prisma.paralelo.findUnique({
      where: { id: paraleloId },
      include: { asignaturaPlan: { include: { asignatura: true, plan: true } }, curso: true },
   })
   if (!paralelo) throw createError({ statusCode: 404, message: 'Paralelo no encontrado' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(paralelo.asignaturaPlan.plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Paralelo no encontrado' })
   }

   const bloque = await prisma.bloque.findUnique({ where: { id: bloqueId } })
   if (!bloque) throw createError({ statusCode: 404, message: 'Bloque no encontrado' })

   // El bloque debe pertenecer al mismo semestre que el curso del paralelo.
   if (bloque.semestreId !== paralelo.curso.semestreId) {
      throw createError({ statusCode: 422, message: 'El bloque no pertenece al semestre del paralelo' })
   }

   // No se puede agendar sobre una celda (día, bloque) protegida.
   const protegido = await prisma.bloqueProtegido.findUnique({
      where: { bloqueId_diaSemana: { bloqueId, diaSemana } },
   })
   if (protegido) {
      throw createError({ statusCode: 422, message: 'Ese bloque está protegido ese día' })
   }

   // No duplicar el paralelo en la misma celda (día + bloque).
   const duplicado = await prisma.sesionParalelo.findFirst({
      where: { paraleloId, diaSemana, bloques: { some: { bloqueId } } },
   })
   if (duplicado) {
      throw createError({ statusCode: 409, message: 'El paralelo ya tiene una sesión en ese bloque y día' })
   }

   // No exceder los bloques de teoría/práctica que define la asignatura.
   const usados = await prisma.sesionParalelo.count({ where: { paraleloId, tipo } })
   const limite =
      tipo === 'TEORIA'
         ? paralelo.asignaturaPlan.asignatura.bloquesTeoria
         : paralelo.asignaturaPlan.asignatura.bloquesPractica
   if (usados >= limite) {
      const etiqueta = tipo === 'TEORIA' ? 'teoría' : 'práctica'
      throw createError({
         statusCode: 422,
         message: `Se alcanzó el máximo de bloques de ${etiqueta} (${limite}) de la asignatura`,
      })
   }

   const sesion = await prisma.sesionParalelo.create({
      data: {
         paraleloId,
         diaSemana,
         tipo,
         bloques: { create: { bloqueId } },
      },
      include: incluirSesion,
   })

   // El mismo paralelo dictado en otro curso es la misma clase: recibe la misma sesión.
   // Ver server/utils/sesionesEspejo.ts.
   await replicarCrearSesion(paralelo, { tipo, diaSemana, bloqueId })

   publicarEventoHorario({
      tipo: 'sesion',
      accion: 'crear',
      semestreId: sesion.paralelo.curso.semestreId,
      cursoId: sesion.paralelo.cursoId,
      descripcion: sesion.paralelo.curso.nombre,
      autorEmail: usuario.email,
      autorNombre: `${usuario.nombre} ${usuario.apellido}`,
   })

   return mapearSesion(sesion)
})
