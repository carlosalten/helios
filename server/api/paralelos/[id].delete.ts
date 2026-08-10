export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/paralelos', 'borrar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.paralelo.findUnique({
      where: { id },
      include: { asignaturaPlan: { include: { plan: true } }, curso: true },
   })
   if (!existe) throw createError({ statusCode: 404, message: 'Paralelo no encontrado' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(existe.asignaturaPlan.plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Paralelo no encontrado' })
   }

   const tieneSesiones = await prisma.sesionParalelo.findFirst({ where: { paraleloId: id } })
   if (tieneSesiones) {
      throw createError({ statusCode: 409, message: 'No se puede eliminar: el paralelo tiene sesiones asociadas' })
   }

   await prisma.paralelo.delete({ where: { id } })

   publicarEventoHorario({
      tipo: 'paralelo',
      accion: 'borrar',
      semestreId: existe.curso.semestreId,
      cursoId: existe.cursoId,
      descripcion: existe.curso.nombre,
      autorEmail: usuario.email,
      autorNombre: `${usuario.nombre} ${usuario.apellido}`,
   })

   return { ok: true }
})
