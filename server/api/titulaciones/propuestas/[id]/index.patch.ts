// Edición de una propuesta por la jefatura, desde /titulaciones/propuestas. A diferencia de
// PATCH /api/estudiante/propuestas/[id] (gateado a que el último estado sea "Antecedentes
// solicitados" y que siempre vuelve a "Pendiente"), acá no hay gate de estado ni se toca
// tt_estado: solo corrige los datos de la propuesta. El cambio de estado (aceptar/rechazar/pedir
// antecedentes) sigue siendo una acción aparte (POST .../estado).
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/propuestas', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const propuesta = await prisma.ttPropuesta.findUnique({ where: { id } })
   if (!propuesta) throw createError({ statusCode: 404, message: 'Propuesta no encontrada' })

   const body = await readBody(event)
   const parsed = crearTtPropuestaSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }
   const datos = parsed.data

   const rolId = datos.modalidad === 'Tesina Feria de Software' ? datos.rolId : undefined
   const lineaInvestigacionId = datos.modalidad === 'Investigación' ? datos.lineaInvestigacionId : undefined

   const [rol, lineaInvestigacion] = await Promise.all([
      rolId == null ? null : prisma.ttRol.findUnique({ where: { id: rolId } }),
      lineaInvestigacionId == null ? null : prisma.ttLineaInvestigacion.findUnique({ where: { id: lineaInvestigacionId } }),
   ])
   if (rolId != null && !rol) throw createError({ statusCode: 404, message: 'Rol no encontrado' })
   if (lineaInvestigacionId != null && !lineaInvestigacion)
      throw createError({ statusCode: 404, message: 'Línea de investigación no encontrada' })

   return prisma.ttPropuesta.update({
      where: { id },
      data: {
         titulo: datos.titulo,
         modalidad: datos.modalidad,
         descripcion: datos.descripcion,
         invMotivacion: datos.modalidad === 'Investigación' ? (datos.invMotivacion ?? null) : null,
         invExperiencia: datos.modalidad === 'Investigación' ? (datos.invExperiencia ?? null) : null,
         claProblema: datos.modalidad === 'Proyecto Propio' ? (datos.claProblema ?? null) : null,
         claObjetivo: datos.modalidad === 'Proyecto Propio' ? (datos.claObjetivo ?? null) : null,
         rolId: rolId ?? null,
         lineaInvestigacionId: lineaInvestigacionId ?? null,
      },
      include: {
         estudiante: {
            select: { email: true, run: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true },
         },
         rol: true,
         lineaInvestigacion: true,
         estados: { orderBy: { fechaHora: 'desc' } },
      },
   })
})
