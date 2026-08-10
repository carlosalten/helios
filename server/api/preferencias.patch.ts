// Preferencias propias — ver /cuenta/preferencias. Es "solo sesión" como auth/password.patch.ts:
// no lleva `requierePermiso` porque cualquier usuario autenticado tiene que poder configurar sus
// propias preferencias sea cual sea su rol. Siempre opera sobre la persona de la sesión: el id
// nunca viaja en el body.
//
// Todos los campos del body son opcionales (ver preferencias.schemas.ts): cada tarjeta de la
// página manda solo los suyos, y Prisma ignora en el UPDATE los que llegan `undefined`.
export default defineEventHandler(async (event) => {
   const { user } = await getUserSession(event)
   if (!user) throw createError({ statusCode: 401, message: 'No autenticado' })
   const { email } = user as { email: string }

   const body = await readBody(event)
   const parsed = actualizarPreferenciasSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   await prisma.persona.update({ where: { email }, data: parsed.data })

   return { ok: true }
})
