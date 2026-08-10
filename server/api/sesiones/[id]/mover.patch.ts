export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/horario', 'editar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })
   const hoy = resolverHoy(getQuery(event))

   const sesion = await prisma.sesionParalelo.findUnique({
      where: { id },
      include: {
         paralelo: { include: { asignaturaPlan: { include: { asignatura: true, plan: true } }, curso: true } },
         bloques: true,
      },
   })
   if (!sesion) throw createError({ statusCode: 404, message: 'Sesión no encontrada' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(sesion.paralelo.asignaturaPlan.plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Sesión no encontrada' })
   }

   const body = await readBody(event)
   const parsed = moverSesionSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const { diaSemana, bloqueId } = parsed.data

   // Celda de origen: hay que capturarla antes de mover para poder ubicar, en los paralelos
   // espejo, la sesión gemela que debe moverse junto con esta.
   const bloqueIdAnterior = sesion.bloques[0]?.bloqueId

   const bloque = await prisma.bloque.findUnique({ where: { id: bloqueId } })
   if (!bloque) throw createError({ statusCode: 404, message: 'Bloque no encontrado' })

   if (bloque.semestreId !== sesion.paralelo.curso.semestreId) {
      throw createError({ statusCode: 422, message: 'El bloque no pertenece al semestre del paralelo' })
   }

   const protegido = await prisma.bloqueProtegido.findUnique({
      where: { bloqueId_diaSemana: { bloqueId, diaSemana } },
   })
   if (protegido) {
      throw createError({ statusCode: 422, message: 'Ese bloque está protegido ese día' })
   }

   // No chocar con otra sesión del mismo paralelo en la celda destino (excluyéndose a sí misma).
   const duplicado = await prisma.sesionParalelo.findFirst({
      where: { paraleloId: sesion.paraleloId, diaSemana, bloques: { some: { bloqueId } }, NOT: { id } },
   })
   if (duplicado) {
      throw createError({ statusCode: 409, message: 'El paralelo ya tiene una sesión en ese bloque y día' })
   }

   // Actualiza el día y reemplaza la fila de la tabla intermedia (un solo bloque por sesión).
   const actualizada = await prisma.$transaction(async (tx) => {
      await tx.sesionParaleloBloque.deleteMany({ where: { sesionParaleloId: id } })
      await tx.sesionParaleloBloque.create({ data: { sesionParaleloId: id, bloqueId } })
      return tx.sesionParalelo.update({ where: { id }, data: { diaSemana }, include: incluirSesion })
   })

   // Si la sesión ya tenía sala asignada, mover el día/bloque cambia el horario real de la
   // clase: hay que regenerar su reserva recurrente para que quede en el nuevo día/hora. El
   // responsable es el profesor de la sesión y queda nulo mientras no se le asigne uno.
   const semestre = await prisma.semestre.findUnique({ where: { id: bloque.semestreId } })
   if (semestre) {
      const titulo = tituloReservaSesion(actualizada.paralelo)
      if (actualizada.salaCodigo) {
         await regenerarReservaSesion(actualizada, bloque, semestre, titulo, actualizada.profesorId, hoy)
      }

      // El mismo paralelo dictado en otro curso se dicta el mismo día y bloque: su sesión
      // gemela se mueve junto con esta. Ver server/utils/sesionesEspejo.ts.
      if (bloqueIdAnterior !== undefined) {
         await replicarMoverSesion(
            actualizada.paralelo,
            { tipo: actualizada.tipo, diaSemana: sesion.diaSemana, bloqueId: bloqueIdAnterior },
            { diaSemana, bloqueId },
            bloque,
            semestre,
            titulo,
            hoy
         )
      }
   }

   publicarEventoHorario({
      tipo: 'sesion',
      accion: 'mover',
      semestreId: actualizada.paralelo.curso.semestreId,
      cursoId: actualizada.paralelo.cursoId,
      descripcion: actualizada.paralelo.curso.nombre,
      autorEmail: usuario.email,
      autorNombre: `${usuario.nombre} ${usuario.apellido}`,
   })

   return mapearSesion(actualizada)
})
