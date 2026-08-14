// Decisión de la jefatura sobre una propuesta (aceptar / rechazar / pedir más antecedentes):
// agrega una fila nueva a su historial de estados, nunca modifica ni borra las anteriores.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/propuestas', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Id inválido' })

   const body = await readBody(event)
   const parsed = crearTtEstadoPropuestaSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const propuesta = await prisma.ttPropuesta.findUnique({ where: { id } })
   if (!propuesta) throw createError({ statusCode: 404, message: 'Propuesta no encontrada' })

   // hayCambios vuelve a false: esta decisión evalúa la versión actual de la propuesta, así que
   // deja de haber cambios "sin revisar" frente a lo último evaluado (ver TtPropuesta.hayCambios).
   const [estado] = await prisma.$transaction([
      prisma.ttEstado.create({
         data: {
            propuestaId: id,
            estado: parsed.data.estado,
            fechaHora: new Date(),
            comentario: parsed.data.comentario ?? null,
         },
      }),
      prisma.ttPropuesta.update({ where: { id }, data: { hayCambios: false } }),
   ])

   return estado
})
