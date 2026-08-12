// Rutas sin recurso de backend propio: no tienen ruta/accion en ningún microservicio,
// así que quedan siempre accesibles para cualquier usuario autenticado.
// '/cuenta/contrasena' y '/cuenta/preferencias' van acá a propósito: cambiar la contraseña o
// las preferencias propias no puede depender de un permiso por rol, o un rol sin permisos
// quedaría sin poder tocarlas nunca.
const RUTAS_SIN_RESTRICCION = [
   '/',
   '/cuenta/contrasena',
   '/cuenta/preferencias',
   '/reportes',
   '/reportes/bloques-libres',
   '/reportes/topes-horario',
]

export default defineNuxtRouteMiddleware((to) => {
   const { loggedIn, user } = useUserSession()

   const rutasPublicas = ['/login']
   // Pantalla física en un hall/pasillo: nadie inicia sesión ahí. `/pantallas/<codigo>` no es
   // una lista fija (el código lo define quien crea la pantalla en /salas/pantallas), así que
   // se compara por prefijo — ver server/api/pantallas/publico/[codigo].get.ts, que tampoco
   // exige sesión.
   const esPantallaPublica = to.path.startsWith('/pantallas/')

   if (!loggedIn.value) {
      if (!rutasPublicas.includes(to.path) && !esPantallaPublica) return navigateTo('/login')
      return
   }

   if (rutasPublicas.includes(to.path) || esPantallaPublica || RUTAS_SIN_RESTRICCION.includes(to.path)) return
   if (user.value?.rol === 'Administrador') return

   const tienePermiso = user.value?.permisos.some((p) => p.ruta === to.path && p.acciones.includes('ver'))
   if (!tienePermiso) return navigateTo('/')
})
