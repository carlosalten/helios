import { z } from 'zod'

// Rutas que la app expone y que pueden restringirse por rol. '/personas/gestion' usa,
// además de las 4 acciones CRUD, las acciones finas contrasena/cambiarrol/activar
// (gestiona tanto los datos de la persona como su cuenta de acceso). '/permisos' no es
// asignable: solo Administrador lo ve.
export const RUTAS_PERMISO = [
   '/asignaturas',
   '/asignaturas/equivalencias',
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

const ACCIONES_PERMISO = ['ver', 'crear', 'editar', 'borrar', 'contrasena', 'cambiarrol', 'activar'] as const

// El rol es un nombre de la tabla `rol` (administrable desde /personas/tipos), no un enum
// fijo: 'Administrador' nunca se guarda como fila de permiso (bypass hardcodeado en
// requierePermiso), pero cualquier otro nombre de rol existente es válido.
export const crearPermisoSchema = z.object({
   rol: z.string({ error: 'El rol es requerido' }).min(1, 'El rol es requerido').max(30, 'Máximo 30 caracteres'),
   ruta: z.enum(RUTAS_PERMISO, { error: 'La ruta es requerida' }),
   accion: z.enum(ACCIONES_PERMISO, { error: 'La acción es requerida' }),
})

export type CrearPermisoInput = z.infer<typeof crearPermisoSchema>
