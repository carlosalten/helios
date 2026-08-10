export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/horario', 'borrar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })
   const hoy = resolverHoy(getQuery(event))

   const existe = await prisma.sesionParalelo.findUnique({
      where: { id },
      include: {
         paralelo: { include: { asignaturaPlan: { include: { asignatura: true, plan: true } }, curso: true } },
         bloques: true,
      },
   })
   if (!existe) throw createError({ statusCode: 404, message: 'Sesión no encontrada' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(existe.paralelo.asignaturaPlan.plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Sesión no encontrada' })
   }

   // Las filas de sesion_paralelo_bloque se eliminan en cascada (onDelete: Cascade). La
   // reserva de sala de la sesión no (onDelete: SetNull): se borra a mano solo la parte que
   // todavía no ocurrió (fecha >= hoy), para no dejar la sala reservada "fantasma" por una
   // clase que ya no existe; la que ya ocurrió queda como registro histórico, ahora suelta
   // (sesionParaleloId nulo) porque la sesión deja de existir.
   const bloqueIdBorrado = existe.bloques[0]?.bloqueId

   await prisma.$transaction([
      prisma.reserva.deleteMany({ where: { sesionParaleloId: id, fecha: { gte: hoy } } }),
      prisma.sesionParalelo.delete({ where: { id } }),
   ])

   // El mismo paralelo dictado en otro curso pierde también esta sesión (y su reserva futura).
   // Ver server/utils/sesionesEspejo.ts.
   if (bloqueIdBorrado !== undefined) {
      await replicarBorrarSesion(
         existe.paralelo,
         {
            tipo: existe.tipo,
            diaSemana: existe.diaSemana,
            bloqueId: bloqueIdBorrado,
         },
         hoy
      )
   }

   publicarEventoHorario({
      tipo: 'sesion',
      accion: 'borrar',
      semestreId: existe.paralelo.curso.semestreId,
      cursoId: existe.paralelo.cursoId,
      descripcion: existe.paralelo.curso.nombre,
      autorEmail: usuario.email,
      autorNombre: `${usuario.nombre} ${usuario.apellido}`,
   })

   return { ok: true }
})
