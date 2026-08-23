// Tipos del módulo de propuestas de trabajo de título (ver comentario en schema.prisma sobre
// por qué TtEstudiante/TtProfesor son entidades propias, separadas de Persona).

export interface TtProceso {
   id: number
   anio: number
}

export interface TtGrupo {
   id: number
   nombre: string
   numero: number
   procesoId: number
   proceso: TtProceso
}

// Integrante de un grupo, para /titulaciones/grupos (columna "Integrantes" y su slideover de
// detalle). `estadoPropuesta` es el estado de la propuesta más reciente que haya presentado (un
// estudiante puede tener más de una si alguna fue rechazada — ver el gate en
// POST /api/estudiante/propuestas); null si nunca presentó ninguna.
export interface TtGrupoIntegrante {
   email: string
   run: string
   nombres: string
   apellidoPaterno: string
   apellidoMaterno: string
   estadoPropuesta: string | null
   // Profesor guía de la propuesta más reciente de este integrante (rol 'Guía' en TtComision),
   // null si no tiene ninguno asignado.
   guia: { email: string; nombre: string; apellido: string } | null
}

// Forma que devuelve GET /api/titulaciones/grupos: igual que TtGrupo pero con sus integrantes,
// para la columna "Integrantes" y el slideover de detalle de /titulaciones/grupos.
export interface TtGrupoConIntegrantes extends TtGrupo {
   estudiantes: TtGrupoIntegrante[]
}

// Fila de GET /api/titulaciones/grupos/estudiantes-disponibles: para el buscador "agregar
// integrante" del slideover de /titulaciones/grupos — trae todos los estudiantes (de cualquier
// proceso) para que el frontend filtre al proceso del grupo seleccionado.
export interface TtEstudianteDisponible {
   email: string
   run: string
   nombres: string
   apellidoPaterno: string
   apellidoMaterno: string
   procesoId: number
   grupoId: number | null
   grupo: { nombre: string } | null
}

export interface TtLineaInvestigacion {
   id: number
   nombre: string
   activo: boolean
}

export interface TtRol {
   id: number
   nombre: string
   descripcion: string | null
   activo: boolean
}

// Sin `password`: el backend nunca la devuelve (omit global en server/utils/prisma.ts).
export interface TtEstudiante {
   email: string
   run: string
   nombres: string
   apellidoPaterno: string
   apellidoMaterno: string
   procesoId: number
   grupoId: number | null
   proceso: TtProceso
   grupo: TtGrupo | null
}

export interface TtProfesor {
   email: string
   run: string
   nombre: string
   apellido: string
   esGuia: boolean
   esInvestigador: boolean
   cupoMaximo: number
}

// 3 modalidades fijas — mismo literal que MODALIDADES_PROPUESTA en
// server/utils/titulaciones.schemas.ts (duplicado a propósito, igual que RUTAS_PERMISO: app/ y
// server/ son proyectos TS separados).
export const MODALIDADES_PROPUESTA = ['Investigación', 'Tesina Feria de Software', 'Proyecto Propio'] as const
export type ModalidadPropuesta = (typeof MODALIDADES_PROPUESTA)[number]

export interface TtPropuesta {
   id: number
   titulo: string
   fecha: string
   modalidad: string
   descripcion: string
   invMotivacion: string | null
   invExperiencia: string | null
   claProblema: string | null
   claObjetivo: string | null
   hayCambios: boolean
   // Solo aplica a "Tesina Feria de Software".
   rolId: number | null
   estudianteEmail: string
   // Solo aplica a "Investigación".
   lineaInvestigacionId: number | null
}

// Respuesta de GET /api/estudiante/catalogos: catálogos para el formulario de nueva propuesta.
export interface CatalogosPropuesta {
   roles: TtRol[]
   lineasInvestigacion: TtLineaInvestigacion[]
}

// Una transición en el historial de estados de una propuesta (ver TtEstado en schema.prisma).
export interface TtEstado {
   id: number
   fechaHora: string
   estado: string
   comentario: string | null
   // Nulo = el estudiante todavía no vio este cambio de estado.
   vistoFechaHora: string | null
   propuestaId: number
}

// Forma que devuelve GET /api/estudiante/propuestas: la propuesta con sus relaciones resueltas
// y el historial de estados ordenado del más reciente al más antiguo — `estados[0]` es el
// estado actual.
export interface TtPropuestaConEstado extends TtPropuesta {
   rol: TtRol | null
   lineaInvestigacion: TtLineaInvestigacion | null
   estados: TtEstado[]
}

// Forma que devuelve GET /api/titulaciones/propuestas (staff, todas las propuestas): igual que
// TtPropuestaConEstado pero además con el estudiante que la presentó, para la tabla/ficha de
// /titulaciones/propuestas. `estudiante.grupo` y `comision` los usa /titulaciones/asignacion-guia
// (agrupar por equipo, ver quién es el guía ya asignado) — ver la ampliación del `include` en
// GET /api/titulaciones/propuestas.
export interface TtPropuestaRevision extends TtPropuestaConEstado {
   estudiante: {
      email: string
      run: string
      nombres: string
      apellidoPaterno: string
      apellidoMaterno: string
      procesoId: number
      grupoId: number | null
      grupo: { id: number; nombre: string; numero: number } | null
   }
   // A lo más un elemento con rol 'Guía' (ver el índice único parcial `tt_comision_propuesta_id_guia_key`
   // en la BD) — sigue siendo un arreglo porque la relación de Prisma es de uno a muchos.
   comision: { profesor: { email: string; nombre: string; apellido: string } }[]
}

// Fila de origen (archivo + número de fila de Excel) de un estudiante que la carga masiva no
// pudo/quiso crear — ver POST /api/titulaciones/estudiantes/carga-masiva.
export interface FilaOmitidaCargaMasiva {
   archivo: string
   fila: number
   run: string
   email: string
}

export interface FilaInvalidaCargaMasiva {
   archivo: string
   fila: number
   motivo: string
}

export interface ResultadoCargaMasivaEstudiantes {
   totalFilas: number
   creados: number
   // Ya existían en la tabla (de una carga anterior o creados a mano).
   omitidosExistian: FilaOmitidaCargaMasiva[]
   // Mismo estudiante repetido dentro de los archivos de esta misma carga.
   omitidosDuplicadosArchivo: FilaOmitidaCargaMasiva[]
   // RUN con formato inválido, o algún campo requerido vacío.
   filasInvalidas: FilaInvalidaCargaMasiva[]
}
