import type { PermisoResumen } from './permiso'
import type { TemaPreferido } from './preferencias'

// Forma del usuario de la sesión Nuxt (`#auth-utils`'s `User`, ver app/types/auth.d.ts). Cubre
// dos tipos de sesión, distinguidos por `tipo` — no son la misma cuenta ni la misma tabla (ver
// comentario sobre TtEstudiante en schema.prisma):
//   - 'staff': una Persona con contraseña (ver server/api/auth/login.post.ts). Todos los campos
//     de acá para abajo hasta `colorTopesEspejo` aplican.
//   - 'estudiante': un TtEstudiante (ver server/api/auth/estudiante/login.post.ts), sin rol ni
//     permisos — solo navega dentro de /estudiante/*, con su propio layout reducido
//     (app/layouts/estudiante.vue).
// Por eso los campos de cada lado son opcionales: ningún login llena los dos a la vez. El rol
// es el nombre de una fila de la tabla `rol` (administrable desde /personas/tipos), no un enum
// fijo.
export interface SesionUsuario {
   tipo: 'staff' | 'estudiante'
   email: string

   // ── Campos de 'staff' ──────────────────────────────────────────────────
   nombre?: string
   apellido?: string
   activo?: boolean
   rol?: string
   // Jerarquía del rol (Rol.jerarquia) al momento de iniciar sesión: mayor número = más alto
   // en la jerarquía. Acota qué roles puede asignar esta persona al crear/editar otra en
   // /personas/gestion — ver el chequeo en server/api/personas/index.post.ts y
   // server/api/personas/[id]/rol.patch.ts. Administrador tiene bypass total (igual que en
   // requierePermiso), sin importar este valor.
   jerarquiaRol?: number
   // Id de la Persona detrás de la sesión — permite al frontend comparar `Reserva.personaId`
   // para saber si una reserva es propia sin otro fetch (ver reservas/horario.vue).
   personaId?: number
   // Populados al iniciar sesión. Vacío/null para Administrador, que tiene acceso total
   // vía bypass y no necesita filas de permiso.
   permisos?: PermisoResumen[]
   carrerasJefe?: number[] | null
   // Códigos de carrera que la persona dirige o tiene asignadas (CarreraPersona) — usado para
   // acotar qué ve en /horario (ver resolverCarrerasAsignadas). `null` = sin restricción
   // (Administrador y Jefe de Carrera, que ven el horario de todas las carreras).
   carrerasAsignadas?: number[] | null
   // Se aplica una vez al montar el layout (ver app/layouts/default.vue) para que el theme
   // siga a la persona entre dispositivos; /cuenta/preferencias la cambia en el momento.
   temaPreferido?: TemaPreferido
   // Si /horario destaca los topes de paralelo espejo (mismo paralelo en más de un curso) y con
   // qué color — ver /cuenta/preferencias y `topeEsEspejo` en horario/index.vue.
   mostrarTopesEspejo?: boolean
   colorTopesEspejo?: string
   // Nulo: sin emoji asignado. Se muestra flotando sobre el círculo de iniciales en el navbar
   // (ver app/layouts/default.vue) — elegido de
   // https://unicode.org/emoji/charts/full-emoji-list.html en /personas/gestion.
   emoji?: string | null

   // ── Campos de 'estudiante' ─────────────────────────────────────────────
   nombres?: string
   apellidoPaterno?: string
   apellidoMaterno?: string
}
