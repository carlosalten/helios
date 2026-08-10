import type { H3Event } from 'h3'

// Control de acceso por rol. En la app consolidada la sesión Nuxt está disponible
// directamente (getUserSession), así que ya no se usan headers internos ni un secreto
// compartido entre servicios. Valida que exista sesión y que el rol del usuario tenga
// permiso para (ruta, accion) en la tabla `permiso`. 'Administrador' tiene bypass total
// (nunca se guarda como fila en `permiso`) para que un bug de seed o un borrado
// accidental desde /permisos no pueda dejar sin acceso a la única cuenta capaz de
// corregirlo.
// Revalida la sesión contra la BD y devuelve los datos frescos del usuario. La cookie de
// sesión dura 8h y congela rol/estado/jerarquía al momento del login; sin revalidar, a una
// cuenta bloqueada o degradada le seguían funcionando esos datos hasta que expirara la cookie.
// Al releer de la BD en cada request, un cambio de rol o un bloqueo tiene efecto inmediato.
async function usuarioActualizado(event: H3Event) {
   const { user } = await getUserSession(event)
   if (!user) throw createError({ statusCode: 401, message: 'No autenticado' })

   const { email } = user as { email: string }
   const persona = await prisma.persona.findUnique({ where: { email }, include: { rol: true } })
   // La cuenta ya no existe o fue bloqueada: la sesión deja de ser válida.
   if (!persona || !persona.activo) {
      await clearUserSession(event)
      throw createError({ statusCode: 401, message: 'Sesión no válida' })
   }

   return {
      email: persona.email,
      rol: persona.rol.nombre,
      jerarquiaRol: persona.rol.jerarquia,
      nombre: persona.nombre,
      apellido: persona.apellido,
   }
}

export async function requierePermiso(event: H3Event, ruta: string, accion: string) {
   const usuario = await usuarioActualizado(event)
   if (usuario.rol === 'Administrador') return usuario

   const permiso = await prisma.permiso.findUnique({
      where: { rol_ruta_accion: { rol: usuario.rol, ruta, accion } },
   })
   if (!permiso) {
      throw createError({ statusCode: 403, message: 'No tiene permiso para realizar esta acción' })
   }

   return usuario
}

// Igual que `requierePermiso`, pero basta con cumplir UNA de las combinaciones (ruta, acción).
// Se usa donde un mismo recurso alimenta a más de una página: el stream SSE de cambios lo
// consumen tanto /horario como /reservas/horario, y exigir el permiso de una dejaría a la otra
// sin avisos en vivo.
export async function requiereAlgunPermiso(event: H3Event, permisos: readonly (readonly [string, string])[]) {
   const usuario = await usuarioActualizado(event)
   if (usuario.rol === 'Administrador') return usuario

   const permiso = await prisma.permiso.findFirst({
      where: { OR: permisos.map(([ruta, accion]) => ({ rol: usuario.rol, ruta, accion })) },
   })
   if (!permiso) {
      throw createError({ statusCode: 403, message: 'No tiene permiso para realizar esta acción' })
   }

   return usuario
}
