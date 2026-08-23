// Asigna (o quita, si `profesorEmail` es null) el profesor guía de una o más propuestas ya
// aceptadas — una sola propuesta para Investigación/Proyecto propio, o todas las de un mismo
// equipo para Feria de Software (ver /titulaciones/asignacion-guia). "Borra e inserta" en vez de
// upsert: TtComision no tiene una fila garantizada de antemano por (propuestaId, rol='Guía'), así
// que reemplazar es más simple que decidir entre create/update. El índice único parcial
// `tt_comision_propuesta_id_guia_key` es la red de seguridad ante una condición de carrera.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/asignacion-guia', 'editar')

   const body = await readBody(event)
   const parsed = asignarGuiaSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }
   const { propuestaIds, profesorEmail } = parsed.data

   const propuestas = await prisma.ttPropuesta.findMany({
      where: { id: { in: propuestaIds } },
      include: { estados: { orderBy: { fechaHora: 'desc' }, take: 1 } },
   })
   if (propuestas.length !== propuestaIds.length) {
      throw createError({ statusCode: 404, message: 'Una o más propuestas no existen' })
   }
   const todasAceptadas = propuestas.every((p) => p.estados[0]?.estado === ESTADO_ACEPTADA)
   if (!todasAceptadas) {
      throw createError({ statusCode: 422, message: 'Solo se puede asignar guía a propuestas aceptadas' })
   }

   if (profesorEmail) {
      const profesor = await prisma.ttProfesor.findUnique({ where: { email: profesorEmail } })
      if (!profesor) throw createError({ statusCode: 404, message: 'Profesor no encontrado' })
      if (!profesor.esGuia) throw createError({ statusCode: 422, message: 'El profesor no está habilitado como guía' })
   }

   await prisma.$transaction([
      prisma.ttComision.deleteMany({ where: { propuestaId: { in: propuestaIds }, rol: ROL_COMISION_GUIA } }),
      ...(profesorEmail
         ? [
              prisma.ttComision.createMany({
                 data: propuestaIds.map((propuestaId) => ({ propuestaId, profesorEmail, rol: ROL_COMISION_GUIA })),
              }),
           ]
         : []),
   ])

   return { ok: true }
})
