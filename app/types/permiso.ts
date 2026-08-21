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
   '/titulaciones/estudiantes',
   '/titulaciones/grupos',
   '/titulaciones/lineas-investigacion',
   '/titulaciones/procesos',
   '/titulaciones/profesores',
   '/titulaciones/propuestas',
   '/titulaciones/roles',
] as const
