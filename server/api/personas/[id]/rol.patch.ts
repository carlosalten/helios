export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/personas/gestion', 'cambiarrol')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.persona.findUnique({ where: { id }, include: { rol: true } })
   if (!existe) throw createError({ statusCode: 404, message: 'Persona no encontrada' })
   // No se puede cambiar el rol de alguien de mayor jerarquía que la propia (si no, un rol
   // inferior podría degradar a un Administrador a un rol bajo y dejarlo fuera).
   verificarJerarquiaSobre(usuario, existe.rol.jerarquia)

   const body = await readBody(event)
   const parsed = cambiarRolPersonaSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const rol = await prisma.rol.findUnique({ where: { id: parsed.data.rolId } })
   if (!rol) throw createError({ statusCode: 404, message: 'Rol no encontrado' })
   // Tampoco se puede asignar un rol de jerarquía mayor a la propia. Administrador tiene bypass
   // total. Dejar el mismo rol que ya tenía (sin cambio real) nunca se bloquea.
   if (usuario.rol !== 'Administrador' && rol.id !== existe.rolId && rol.jerarquia > usuario.jerarquiaRol) {
      throw createError({ statusCode: 403, message: 'No puedes asignar un rol de mayor jerarquía que el tuyo' })
   }
   // Degradar al último Administrador activo (cambiarlo a otro rol) dejaría el sistema sin
   // superusuario.
   if (rol.id !== existe.rolId) await protegerUltimoAdministrador(id)

   return prisma.persona.update({ where: { id }, data: { rolId: parsed.data.rolId }, include: { rol: true } })
})
