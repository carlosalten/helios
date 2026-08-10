// Códigos de carrera de los que el usuario logueado es jefe (solo aplica al rol
// 'Jefe de Carrera'; para el resto devuelve []). Sin gating por tabla, igual que
// /permisos/mios: solo exige sesión.
export default defineEventHandler(async (event) => {
   const { user } = await getUserSession(event)
   if (!user) throw createError({ statusCode: 401, message: 'No autenticado' })
   const usuario = user as { email: string; rol: string }

   const carreras = await resolverCarrerasJefe(usuario.rol, usuario.email)
   return carreras ?? []
})
