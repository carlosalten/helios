import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/personas/gestion', 'contrasena')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.persona.findUnique({ where: { id }, include: { rol: true } })
   if (!existe) throw createError({ statusCode: 404, message: 'Persona no encontrada' })
   // Sin esto, un rol inferior con permiso 'contrasena' podía reescribir la contraseña de un
   // Administrador y tomar su cuenta.
   verificarJerarquiaSobre(usuario, existe.rol.jerarquia)

   const body = await readBody(event)
   const parsed = cambiarPasswordPersonaSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const hash = await bcrypt.hash(parsed.data.password, 12)

   await prisma.persona.update({ where: { id }, data: { password: hash } })

   return { ok: true }
})
