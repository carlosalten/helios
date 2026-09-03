// Detalle completo de una propuesta del propio estudiante (con historial de estados) — para
// /estudiante/propuestas/[id]. Igual criterio de pertenencia que marcar-visto.post.ts.
export default defineEventHandler(async (event) => {
   const estudiante = await requiereSesionEstudiante(event)

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Id inválido' })

   const propuesta = await prisma.ttPropuesta.findUnique({
      where: { id },
      include: {
         rol: true,
         lineaInvestigacion: true,
         estados: { orderBy: { fechaHora: 'desc' } },
         comision: {
            where: { rol: ROL_COMISION_GUIA },
            include: { profesor: { select: { email: true, nombre: true, apellido: true } } },
         },
      },
   })
   if (!propuesta || propuesta.estudianteEmail !== estudiante.email) {
      throw createError({ statusCode: 404, message: 'Propuesta no encontrada' })
   }

   // Si el proceso todavía no habilita mostrar el guía a sus estudiantes, no viaja el dato al
   // cliente — no basta con ocultarlo en el frontend (ver TtProceso.mostrarGuiaEstudiantes).
   if (!estudiante.proceso.mostrarGuiaEstudiantes) {
      return { ...propuesta, comision: [] }
   }
   return propuesta
})
