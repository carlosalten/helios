// Edita nombre/apellido de un Ayudante. No toca el rol (ver index.post.ts) y, a propósito,
// solo permite editar personas cuyo rol ACTUAL es 'Ayudante' — así este permiso más acotado
// que /personas/gestion no sirve como puerta trasera para editar a cualquier persona por id.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/ayudantias/gestion', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.persona.findUnique({ where: { id }, include: { rol: true } })
   if (!existe || existe.rol.nombre !== 'Ayudante') {
      throw createError({ statusCode: 404, message: 'Ayudante no encontrado' })
   }

   const body = await readBody(event)
   const parsed = editarAyudanteSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const actualizada = await prisma.persona.update({
      where: { id },
      data: parsed.data,
      include: { rol: true },
   })

   return actualizada
})
