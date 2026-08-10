export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/feriados', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.feriado.findUnique({ where: { id } })
   if (!existe) throw createError({ statusCode: 404, message: 'Feriado no encontrado' })

   const body = await readBody(event)
   const parsed = crearFeriadoSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const semestre = await prisma.semestre.findUnique({ where: { id: parsed.data.semestreId } })
   if (!semestre) throw createError({ statusCode: 404, message: 'Semestre no encontrado' })

   const duplicado = await prisma.feriado.findFirst({
      where: { semestreId: parsed.data.semestreId, fecha: parsed.data.fecha, NOT: { id } },
   })
   if (duplicado) throw createError({ statusCode: 409, message: 'Ya existe un feriado en esa fecha para ese semestre' })

   return prisma.feriado.update({ where: { id }, data: parsed.data, include: { semestre: true } })
})
