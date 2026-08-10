// Resumen de los permisos del propio usuario logueado. No pasa por requierePermiso
// con chequeo de tabla (un usuario sin 'ver' en /permisos igual necesita consultar
// los suyos) — solo exige sesión y solo devuelve datos sobre el propio rol del que llama.
export default defineEventHandler(async (event) => {
   const { user } = await getUserSession(event)
   if (!user) throw createError({ statusCode: 401, message: 'No autenticado' })
   const usuario = user as { email: string; rol: string }

   if (usuario.rol === 'Administrador') return { administrador: true, permisos: [] }

   const filas = await prisma.permiso.findMany({ where: { rol: usuario.rol } })
   const agrupado = new Map<string, string[]>()
   for (const f of filas) agrupado.set(f.ruta, [...(agrupado.get(f.ruta) ?? []), f.accion])

   return {
      administrador: false,
      permisos: Array.from(agrupado, ([ruta, acciones]) => ({ ruta, acciones })),
   }
})
