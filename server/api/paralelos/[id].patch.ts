export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/paralelos', 'editar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.paralelo.findUnique({
      where: { id },
      include: { asignaturaPlan: { include: { plan: true } } },
   })
   if (!existe) throw createError({ statusCode: 404, message: 'Paralelo no encontrado' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(existe.asignaturaPlan.plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Paralelo no encontrado' })
   }

   const body = await readBody(event)
   const parsed = crearParaleloSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const [asignaturaPlan, curso] = await Promise.all([
      prisma.asignaturaPlan.findUnique({ where: { id: parsed.data.asignaturaPlanId }, include: { plan: true } }),
      prisma.curso.findUnique({ where: { id: parsed.data.cursoId } }),
   ])
   if (!asignaturaPlan) throw createError({ statusCode: 404, message: 'Asignatura no encontrada en el plan' })
   if (!curso) throw createError({ statusCode: 404, message: 'Curso no encontrado' })
   if (curso.planId !== asignaturaPlan.planId) {
      throw createError({ statusCode: 422, message: 'El curso no pertenece al plan de la asignatura' })
   }
   if (carrerasPermitidas && !carrerasPermitidas.includes(asignaturaPlan.plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Asignatura no encontrada en el plan' })
   }

   // Si cambia de curso, va al final del curso destino; si se queda en el mismo, conserva
   // su posición actual (editar código/cupo/asignatura no debe reordenar la columna).
   const data =
      parsed.data.cursoId !== existe.cursoId
         ? { ...parsed.data, orden: await siguienteOrdenParalelo(parsed.data.cursoId) }
         : parsed.data

   const actualizado = await prisma.paralelo.update({
      where: { id },
      data,
      include: {
         curso: { include: { semestre: true } },
         asignaturaPlan: {
            include: { asignatura: true, plan: { include: { carrera: true } } },
         },
      },
   })

   // Un mismo paralelo (misma asignatura y código) puede estar repetido en más de un curso del
   // mismo semestre — es el mismo curso físico dictado a más de una cohorte/plan, así que el
   // cupo debe quedar igual en todas esas filas.
   if (actualizado.cupo !== existe.cupo) {
      await prisma.paralelo.updateMany({
         where: {
            id: { not: id },
            codigo: actualizado.codigo,
            curso: { semestreId: actualizado.curso.semestreId },
            asignaturaPlan: { asignatura: { codigo: actualizado.asignaturaPlan.asignatura.codigo } },
         },
         data: { cupo: actualizado.cupo },
      })
   }

   // El color identifica a la asignatura en la matriz de horario, no al paralelo suelto: todos
   // los paralelos de la misma asignatura dentro del mismo plan y semestre comparten color.
   // `asignaturaPlanId` ya es (asignatura, plan) por su @@unique, así que basta con acotar por
   // semestre. Ojo: es un grupo distinto al del cupo — acá NO se compara el código de paralelo.
   if (actualizado.color !== existe.color) {
      await prisma.paralelo.updateMany({
         where: {
            id: { not: id },
            asignaturaPlanId: actualizado.asignaturaPlanId,
            curso: { semestreId: actualizado.curso.semestreId },
         },
         data: { color: actualizado.color },
      })
   }

   // El código y el color del paralelo se ven en la matriz de horario: avisar para que
   // quienes la tengan abierta la vean actualizada sin recargar.
   publicarEventoHorario({
      tipo: 'paralelo',
      accion: 'editar',
      semestreId: actualizado.curso.semestreId,
      cursoId: actualizado.cursoId,
      descripcion: actualizado.curso.nombre,
      autorEmail: usuario.email,
      autorNombre: `${usuario.nombre} ${usuario.apellido}`,
   })

   return actualizado
})
