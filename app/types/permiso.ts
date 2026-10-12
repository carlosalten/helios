export interface Permiso {
   id: number
   rol: string
   ruta: string
   accion: string
}

// Forma que devuelve GET /permisos/mios: los permisos del propio rol, agrupados por ruta.
export interface PermisoResumen {
   ruta: string
   acciones: string[]
}

// En la cookie de sesión cada ruta va como un string "ruta:letras" (p. ej. "/cursos:vceb") en
// vez de { ruta, acciones[] }: nuxt-auth-utils guarda la sesión completa en la cookie, que el
// browser descarta si pasa de 4096 bytes, y el rol con más permisos ya la superaba.
const LETRA_ACCION: Record<string, string> = {
   ver: 'v',
   crear: 'c',
   editar: 'e',
   borrar: 'b',
   contrasena: 'k',
   cambiarrol: 'r',
   activar: 'a',
}

export function codificarPermisosSesion(permisos: PermisoResumen[]): string[] {
   return permisos.map(({ ruta, acciones }) => `${ruta}:${acciones.map((a) => LETRA_ACCION[a] ?? '').join('')}`)
}

export function tienePermisoSesion(permisosSesion: string[] | undefined, ruta: string, accion: string) {
   const letra = LETRA_ACCION[accion]
   if (!letra) return false
   const prefijo = `${ruta}:`
   // `typeof`: una sesión iniciada antes de este formato trae objetos en vez de strings.
   return (
      permisosSesion?.some(
         (p) => typeof p === 'string' && p.startsWith(prefijo) && p.slice(prefijo.length).includes(letra)
      ) ?? false
   )
}

// Acciones genéricas CRUD, válidas para casi todas las rutas.
export const ACCIONES_PERMISO = ['ver', 'crear', 'editar', 'borrar'] as const
export type AccionPermiso = (typeof ACCIONES_PERMISO)[number]

// '/personas/gestion' además separa contraseña, rol y activar/bloquear de 'editar'
// porque gestiona tanto los datos de la persona como su cuenta de acceso.
export const ACCIONES_PERMISO_PERSONAS = [
   'ver',
   'crear',
   'editar',
   'contrasena',
   'cambiarrol',
   'activar',
   'borrar',
] as const
export type AccionPermisoPersonas = (typeof ACCIONES_PERMISO_PERSONAS)[number]

// Ruta que usa el set extendido de acciones (ACCIONES_PERMISO_PERSONAS) en vez del
// genérico ACCIONES_PERMISO.
export const RUTA_PERMISO_PERSONAS_GESTION = '/personas/gestion'

export const RUTAS_PERMISO = [
   '/asignaturas',
   '/asignaturas/equivalencias',
   '/ayudantias',
   '/ayudantias/gestion',
   '/ayudantias/resumen',
   '/bloques',
   '/bloques/copiar',
   '/carreras',
   '/carreras/asignacion',
   '/configuracion',
   '/cursos',
   '/cursos/carga-masiva',
   '/feriados',
   '/horario',
   '/horario/profesor',
   '/horario/profesores',
   '/horario/salas',
   '/paralelos',
   '/paralelos/asignacion',
   '/personas/gestion',
   '/personas/tipos',
   '/planes',
   '/planes/asignacion',
   '/reportes/asignaturas-plan',
   '/reportes/bloques-libres',
   '/reportes/topes-horario',
   '/reportes/uso-salas',
   '/reservas/horario',
   '/reservas/imprimir',
   '/reservas/resumen',
   '/reservas/tipos',
   '/salas/asignacion',
   '/salas/gestion',
   '/salas/pantallas',
   '/salas/tipos',
   '/semestres',
   '/semestres/resumen',
   '/titulaciones/asignacion-guia',
   '/titulaciones/estudiantes',
   '/titulaciones/grupos',
   '/titulaciones/guiados',
   '/titulaciones/lineas-investigacion',
   '/titulaciones/procesos',
   '/titulaciones/profesores',
   '/titulaciones/propuestas',
   '/titulaciones/roles',
] as const
