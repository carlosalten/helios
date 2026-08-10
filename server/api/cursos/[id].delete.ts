export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/cursos', 'borrar')
   const carrerasPermitidas = await resolverCarrerasCursos(usuario.rol, usuario.email)

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.curso.findUnique({ where: { id }, include: { plan: true } })
   if (!existe) throw createError({ statusCode: 404, message: 'Curso no encontrado' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(existe.plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Curso no encontrado' })
   }

   const paralelos = await prisma.paralelo.findMany({ where: { cursoId: id }, select: { id: true } })
   if (!paralelos.length) {
      await prisma.curso.delete({ where: { id } })
      return { ok: true, eliminados: { paralelos: 0, sesiones: 0, reservas: 0 } }
   }

   // Borrar un curso con paralelos es en cascada (paralelos, sus sesiones de clase y las
   // reservas de sala que generaron) y solo el Administrador puede hacerlo: el resto de los
   // roles tiene que vaciar el curso a mano primero, para no borrar sin querer horario de
   // otras carreras o profesores. El frontend avisa de esto antes de confirmar (ver
   // app/pages/cursos/index.vue), pero la restricción real vive acá.
   if (usuario.rol !== 'Administrador') {
      throw createError({ statusCode: 409, message: 'No se puede eliminar: el curso tiene paralelos asociados' })
   }

   const idsParalelo = paralelos.map((p) => p.id)

   const eliminados = await prisma.$transaction(async (tx) => {
      const sesiones = await tx.sesionParalelo.findMany({
         where: { paraleloId: { in: idsParalelo } },
         select: { id: true },
      })
      const idsSesion = sesiones.map((s) => s.id)

      const reservasBorradas = await tx.reserva.deleteMany({ where: { sesionParaleloId: { in: idsSesion } } })
      await tx.sesionParalelo.deleteMany({ where: { id: { in: idsSesion } } })
      await tx.paralelo.deleteMany({ where: { id: { in: idsParalelo } } })
      await tx.curso.delete({ where: { id } })

      return { paralelos: idsParalelo.length, sesiones: idsSesion.length, reservas: reservasBorradas.count }
   })

   return { ok: true, eliminados }
})
