// Rutas sin recurso de backend propio: no tienen ruta/accion en ningún microservicio,
// así que quedan siempre accesibles para cualquier usuario autenticado.
// '/cuenta/contrasena' y '/cuenta/preferencias' van acá a propósito: cambiar la contraseña o
// las preferencias propias no puede depender de un permiso por rol, o un rol sin permisos
// quedaría sin poder tocarlas nunca.
// '/reportes' (el índice) también queda acá: es solo una lista de links a las páginas de
// reportes de abajo, que sí están en RUTAS_PERMISO (app/types/permiso.ts) y se filtran
// individualmente en el navbar (ver `puedeVer` en app/layouts/default.vue).
const RUTAS_SIN_RESTRICCION = ['/', '/cuenta/contrasena', '/cuenta/preferencias', '/reportes']

export default defineNuxtRouteMiddleware((to) => {
   const { loggedIn, user } = useUserSession()

   const rutasPublicas = ['/login', '/estudiante/login']
   // Pantalla física en un hall/pasillo: nadie inicia sesión ahí. `/pantallas/<codigo>` no es
   // una lista fija (el código lo define quien crea la pantalla en /salas/pantallas), así que
   // se compara por prefijo — ver server/api/pantallas/publico/[codigo].get.ts, que tampoco
   // exige sesión.
   const esPantallaPublica = to.path.startsWith('/pantallas/')
   const esRutaEstudiante = to.path === '/estudiante' || to.path.startsWith('/estudiante/')
   const esEstudiante = user.value?.tipo === 'estudiante'

   if (!loggedIn.value) {
      if (esPantallaPublica || rutasPublicas.includes(to.path)) return
      return navigateTo(esRutaEstudiante ? '/estudiante/login' : '/login')
   }

   // Ya logueado y tratando de entrar a un login: lo manda a su propio home.
   if (rutasPublicas.includes(to.path)) return navigateTo(esEstudiante ? '/estudiante' : '/')

   if (esPantallaPublica) return

   // Dos sesiones completamente separadas (ver app/types/sesionUsuario.ts): una de estudiante
   // solo navega dentro de /estudiante/* (su propio layout y navbar reducido, sin la tabla de
   // permisos — ver app/layouts/estudiante.vue); una de staff nunca entra ahí.
   if (esEstudiante !== esRutaEstudiante) return navigateTo(esEstudiante ? '/estudiante' : '/')
   if (esEstudiante) return

   if (RUTAS_SIN_RESTRICCION.includes(to.path)) return
   if (user.value?.rol === 'Administrador') return

   const tienePermiso = user.value?.permisos?.some((p) => p.ruta === to.path && p.acciones.includes('ver'))
   if (!tienePermiso) return navigateTo('/')
})
