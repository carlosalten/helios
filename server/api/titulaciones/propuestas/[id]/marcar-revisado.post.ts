// Apaga el aviso de "el estudiante modificó la propuesta" (TtPropuesta.hayCambios) al abrir su
// detalle desde /titulaciones/propuestas — ver el comentario en TtPropuesta.hayCambios en
// schema.prisma. Basta con poder ver la propuesta (no hace falta 'editar'): es un efecto de
// haberla revisado, no una decisión sobre ella.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/propuestas', 'ver')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Id inválido' })

   const propuesta = await prisma.ttPropuesta.findUnique({ where: { id } })
   if (!propuesta) throw createError({ statusCode: 404, message: 'Propuesta no encontrada' })

   if (propuesta.hayCambios) {
      await prisma.ttPropuesta.update({ where: { id }, data: { hayCambios: false } })
   }

   return { ok: true }
})
