import type { PermisoResumen } from './permiso'
import type { TemaPreferido } from './preferencias'

// Forma del usuario de la sesión Nuxt (ver server/api/auth/login.post.ts), calculada a
// partir de una Persona con contraseña. El rol es el nombre de una fila de la tabla
// `rol` (administrable desde /personas/tipos), no un enum fijo.
export interface SesionUsuario {
   email: string
   nombre: string
   apellido: string
   activo: boolean
   rol: string
   // Jerarquía del rol (Rol.jerarquia) al momento de iniciar sesión: mayor número = más alto
   // en la jerarquía. Acota qué roles puede asignar esta persona al crear/editar otra en
   // /personas/gestion — ver el chequeo en server/api/personas/index.post.ts y
   // server/api/personas/[id]/rol.patch.ts. Administrador tiene bypass total (igual que en
   // requierePermiso), sin importar este valor.
   jerarquiaRol: number
   // Id de la Persona detrás de la sesión — permite al frontend comparar `Reserva.personaId`
   // para saber si una reserva es propia sin otro fetch (ver reservas/horario.vue).
   personaId: number
   // Populados al iniciar sesión. Vacío/null para Administrador, que tiene acceso total
   // vía bypass y no necesita filas de permiso.
   permisos: PermisoResumen[]
   carrerasJefe: number[] | null
   // Se aplica una vez al montar el layout (ver app/layouts/default.vue) para que el theme
   // siga a la persona entre dispositivos; /cuenta/preferencias la cambia en el momento.
   temaPreferido: TemaPreferido
   // Si /horario destaca los topes de paralelo espejo (mismo paralelo en más de un curso) y con
   // qué color — ver /cuenta/preferencias y `topeEsEspejo` en horario/index.vue.
   mostrarTopesEspejo: boolean
   colorTopesEspejo: string
   // Nulo: sin emoji asignado. Se muestra flotando sobre el círculo de iniciales en el navbar
   // (ver app/layouts/default.vue) — elegido de
   // https://unicode.org/emoji/charts/full-emoji-list.html en /personas/gestion.
   emoji: string | null
}
