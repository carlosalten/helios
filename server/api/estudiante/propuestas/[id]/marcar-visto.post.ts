// Marca como vistos todos los cambios de estado pendientes de leer de una propuesta del propio
// estudiante — se llama al abrir el detalle (ver app/pages/estudiante/propuestas.vue). Solo
// afecta filas todavía sin marca (`vistoFechaHora: null`); las ya vistas no se tocan de nuevo.
export default defineEventHandler(async (event) => {
   const estudiante = await requiereSesionEstudiante(event)

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Id inválido' })

   const propuesta = await prisma.ttPropuesta.findUnique({ where: { id } })
   if (!propuesta || propuesta.estudianteEmail !== estudiante.email) {
      throw createError({ statusCode: 404, message: 'Propuesta no encontrada' })
   }

   await prisma.ttEstado.updateMany({
      where: { propuestaId: id, vistoFechaHora: null },
      data: { vistoFechaHora: new Date() },
   })

   return { ok: true }
})
