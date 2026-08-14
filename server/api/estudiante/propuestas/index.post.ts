// Alta de una propuesta de trabajo de título por el propio estudiante (/estudiante/propuestas).
// `fecha` y `hayCambios` no vienen del body: `fecha` es el momento de creación y `hayCambios`
// siempre nace en false (recién creada, nada que revisar todavía) — ver comentario en
// TtPropuesta.hayCambios en schema.prisma.
export default defineEventHandler(async (event) => {
   const estudiante = await requiereSesionEstudiante(event)

   // Gate: solo puede ingresar una propuesta si nunca ha presentado ninguna, o si todas las que
   // tiene fueron rechazadas (última entrada de su historial de estados) — mientras tenga una
   // pendiente/aprobada no puede postular otra.
   const propuestasExistentes = await prisma.ttPropuesta.findMany({
      where: { estudianteEmail: estudiante.email },
      select: { estados: { orderBy: { fechaHora: 'desc' }, take: 1, select: { estado: true } } },
   })
   const puedeIngresar = propuestasExistentes.every((p) => p.estados[0]?.estado === ESTADO_RECHAZADA)
   if (!puedeIngresar) {
      throw createError({ statusCode: 409, message: 'Ya tienes una propuesta en proceso' })
   }

   const body = await readBody(event)
   const parsed = crearTtPropuestaSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }
   const datos = parsed.data

   // rolId solo aplica a "Tesina Feria de Software"; lineaInvestigacionId solo a "Investigación"
   // (ver crearTtPropuestaSchema) — solo se valida la existencia del que corresponda.
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

   return prisma.ttPropuesta.create({
      data: {
         titulo: datos.titulo,
         fecha: ahora,
         modalidad: datos.modalidad,
         descripcion: datos.descripcion,
         invMotivacion: datos.modalidad === 'Investigación' ? (datos.invMotivacion ?? null) : null,
         invExperiencia: datos.modalidad === 'Investigación' ? (datos.invExperiencia ?? null) : null,
         claProblema: datos.modalidad === 'Proyecto Propio' ? (datos.claProblema ?? null) : null,
         claObjetivo: datos.modalidad === 'Proyecto Propio' ? (datos.claObjetivo ?? null) : null,
         hayCambios: false,
         rolId: rolId ?? null,
         estudianteEmail: estudiante.email,
         lineaInvestigacionId: lineaInvestigacionId ?? null,
         // Nested create: nace atada a la propuesta en la misma escritura, sin round-trip aparte.
         // vistoFechaHora = ahora: el propio estudiante la acaba de crear, no es una novedad para
         // él (ver comentario en TtEstado.vistoFechaHora).
         estados: { create: { estado: ESTADO_PENDIENTE, fechaHora: ahora, comentario: null, vistoFechaHora: ahora } },
      },
      include: { rol: true, lineaInvestigacion: true, estados: true },
   })
})
