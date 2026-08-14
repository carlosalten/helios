// Edición de una propuesta propia — solo permitida mientras su último estado es "Antecedentes
// solicitados" (ver ESTADO_ANTECEDENTES): es la única situación en la que la jefatura le pide
// modificarla. Al guardar, vuelve a "Pendiente" (nueva fila en tt_estado, nunca se borra la
// anterior) para que quede de nuevo en la cola de revisión, y hayCambios pasa a true — hay una
// versión más nueva que la que se evaluó la última vez (ver TtPropuesta.hayCambios).
export default defineEventHandler(async (event) => {
   const estudiante = await requiereSesionEstudiante(event)

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Id inválido' })

   const propuesta = await prisma.ttPropuesta.findUnique({
      where: { id },
      include: { estados: { orderBy: { fechaHora: 'desc' }, take: 1 } },
   })
   if (!propuesta || propuesta.estudianteEmail !== estudiante.email) {
      throw createError({ statusCode: 404, message: 'Propuesta no encontrada' })
   }
   if (propuesta.estados[0]?.estado !== ESTADO_ANTECEDENTES) {
      throw createError({
         statusCode: 409,
         message: 'Solo puedes modificar la propuesta cuando te piden más antecedentes',
      })
   }

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

   const ahora = new Date()

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
         hayCambios: true,
         rolId: rolId ?? null,
         lineaInvestigacionId: lineaInvestigacionId ?? null,
         estados: { create: { estado: ESTADO_PENDIENTE, fechaHora: ahora, comentario: null, vistoFechaHora: ahora } },
      },
      include: { rol: true, lineaInvestigacion: true, estados: { orderBy: { fechaHora: 'desc' } } },
   })
})
