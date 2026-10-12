// Oculta o muestra (Curso.visible) todos los cursos de una carrera en el semestre borrador.
// Solo el jefe de esa carrera (Carrera.jefePersonaId) puede hacerlo, además del permiso
// 'editar' sobre /semestres/resumen.
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/semestres/resumen', 'editar')

   const body = await readBody(event)
   const parsed = visibilidadCursosSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   const { carreraCodigo, visible } = parsed.data

   const [persona, carrera, borrador] = await Promise.all([
      prisma.persona.findUnique({ where: { email: usuario.email }, select: { id: true } }),
      prisma.carrera.findUnique({ where: { codigo: carreraCodigo }, select: { jefePersonaId: true } }),
      prisma.semestre.findFirst({ where: { borrador: true }, select: { id: true } }),
   ])

   if (!carrera) throw createError({ statusCode: 404, message: 'Carrera no encontrada' })
   if (!persona || carrera.jefePersonaId !== persona.id) {
      throw createError({
         statusCode: 403,
         message: 'Solo el jefe de la carrera puede cambiar la visibilidad de sus cursos',
      })
   }
   if (!borrador) throw createError({ statusCode: 422, message: 'No hay un semestre marcado como borrador' })

   const { count } = await prisma.curso.updateMany({
      where: { semestreId: borrador.id, plan: { carreraCodigo } },
      data: { visible },
   })

   return { actualizados: count }
})
