export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/personas/gestion', 'activar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const persona = await prisma.persona.findUnique({ where: { id }, include: { rol: true } })
   if (!persona) throw createError({ statusCode: 404, message: 'Persona no encontrada' })
   // Un rol inferior no puede bloquear a uno superior (era un DoS contra el Administrador).
   verificarJerarquiaSobre(usuario, persona.rol.jerarquia)
   // Bloquear (activo true → false): proteger al último Administrador activo.
   if (persona.activo) await protegerUltimoAdministrador(id)

   return prisma.persona.update({ where: { id }, data: { activo: !persona.activo } })
})
