import { z } from 'zod'

export const emailSchema = z
   .string({ error: 'El email es requerido' })
   .trim()
   .toLowerCase()
   .email('Email inválido')
   .max(50, 'Máximo 50 caracteres')

// 7 u 8 dígitos, guion, y dígito verificador (0-9 o K mayúscula). No valida el dígito
// verificador en sí (algoritmo módulo 11) — solo el formato.
export const runSchema = z
   .string({ error: 'El RUN es requerido' })
   .regex(/^\d{7,8}-[0-9K]$/, 'Formato de RUN inválido (ej. 12345678-9 o 12345678-K)')

export const nombreSchema = (mensajeRequerido: string, max: number) =>
   z.string({ error: mensajeRequerido }).trim().min(1, mensajeRequerido).max(max, `Máximo ${max} caracteres`)

// ============================================================
// Procesos
// ============================================================

export const crearTtProcesoSchema = z.object({
   anio: z
      .number({ error: 'El año es requerido' })
      .int('Debe ser un número entero')
      .min(2000, 'Debe ser 2000 o posterior')
      .max(2100, 'Máximo 2100'),
   mostrarGuiaEstudiantes: z.boolean().optional().default(false),
})

// ============================================================
// Grupos
// ============================================================

export const crearTtGrupoSchema = z.object({
   nombre: nombreSchema('El nombre es requerido', 100),
   // Opcional: un string vacío se guarda como nulo, no como cadena vacía (mismo criterio que
   // Asignatura.nombreCorto).
   subtitulo: z
      .string()
      .trim()
      .max(100, 'Máximo 100 caracteres')
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
   // Único dentro del mismo proceso — se valida en el endpoint (ver server/api/titulaciones/grupos).
   numero: z
      .number({ error: 'El número es requerido' })
      .int('Debe ser un número entero')
      .min(1, 'Debe ser mayor o igual a 1'),
   procesoId: z.number({ error: 'El proceso es requerido' }).int(),
})

// POST /api/titulaciones/grupos/[id]/integrantes — agrega un estudiante ya existente al grupo.
export const agregarIntegranteGrupoSchema = z.object({
   email: emailSchema,
})

// ============================================================
// Líneas de investigación
// ============================================================

export const crearTtLineaInvestigacionSchema = z.object({
   nombre: nombreSchema('El nombre es requerido', 50),
   activo: z.boolean().default(true),
})

// ============================================================
// Roles (catálogo de roles dentro de una propuesta)
// ============================================================

export const crearTtRolSchema = z.object({
   nombre: nombreSchema('El nombre es requerido', 100),
   // Opcional: un string vacío se guarda como nulo, no como cadena vacía (mismo criterio que
   // Asignatura.nombreCorto).
   descripcion: z
      .string()
      .trim()
      .max(200, 'Máximo 200 caracteres')
      .nullable()
      .transform((v) => (v ? v : null)),
   activo: z.boolean().default(true),
})

// ============================================================
// Estudiantes
// ============================================================

export const crearTtEstudianteSchema = z.object({
   email: emailSchema,
   run: runSchema,
   password: passwordSchema,
   nombres: nombreSchema('Los nombres son requeridos', 50),
   apellidoPaterno: nombreSchema('El apellido paterno es requerido', 50),
   apellidoMaterno: nombreSchema('El apellido materno es requerido', 50),
   procesoId: z.number({ error: 'El proceso es requerido' }).int(),
   // Nulo: el estudiante todavía no está asignado a un grupo de trabajo.
   grupoId: z.number().int().nullable(),
})

// Igual que crearTtEstudianteSchema, pero la contraseña es opcional: dejarla en blanco en el
// formulario de edición conserva la contraseña actual (mismo criterio que /personas/gestion,
// donde cambiar la contraseña es una acción aparte de editar los datos).
export const editarTtEstudianteSchema = z.object({
   run: runSchema,
   password: passwordSchema.optional(),
   nombres: nombreSchema('Los nombres son requeridos', 50),
   apellidoPaterno: nombreSchema('El apellido paterno es requerido', 50),
   apellidoMaterno: nombreSchema('El apellido materno es requerido', 50),
   procesoId: z.number({ error: 'El proceso es requerido' }).int(),
   grupoId: z.number().int().nullable(),
})

// ============================================================
// Profesores
// ============================================================

const cupoMaximoSchema = z
   .number({ error: 'El cupo máximo es requerido' })
   .int('Debe ser un número entero')
   .min(1, 'Debe ser mayor o igual a 1')

export const crearTtProfesorSchema = z.object({
   email: emailSchema,
   run: runSchema,
   nombre: nombreSchema('El nombre es requerido', 30),
   apellido: nombreSchema('El apellido es requerido', 30),
   esGuia: z.boolean().default(false),
   esInvestigador: z.boolean().default(false),
   cupoMaximo: cupoMaximoSchema,
})

// Igual que crearTtProfesorSchema, sin email: es la clave primaria, no se edita una vez creado
// (mismo criterio que Persona.email).
export const editarTtProfesorSchema = z.object({
   run: runSchema,
   nombre: nombreSchema('El nombre es requerido', 30),
   apellido: nombreSchema('El apellido es requerido', 30),
   esGuia: z.boolean().default(false),
   esInvestigador: z.boolean().default(false),
   cupoMaximo: cupoMaximoSchema,
})

// ============================================================
// Propuestas
// ============================================================

// 3 modalidades fijas — reflejadas también en app/types/titulaciones.ts para el <USelectMenu>
// del formulario (mismo criterio de duplicación que RUTAS_PERMISO entre app/ y server/).
export const MODALIDADES_PROPUESTA = ['Investigación', 'Tesina Feria de Software', 'Proyecto Propio'] as const

// Estado inicial de toda propuesta recién creada (ver POST /api/estudiante/propuestas) y el
// único estado desde el que se puede volver a postular (ver GET, que usa este mismo valor para
// el gate de "puede ingresar una propuesta nueva"). `tt_estado.estado` sigue siendo texto libre
// en la BD (igual que `modalidad`), no un enum de Postgres.
export const ESTADO_PENDIENTE = 'Pendiente'
export const ESTADO_ACEPTADA = 'Aceptada'
export const ESTADO_RECHAZADA = 'Rechazada'
export const ESTADO_ANTECEDENTES = 'Antecedentes solicitados'

// Los 3 estados que puede dar la jefatura al revisar una propuesta desde
// /titulaciones/propuestas (ver POST /api/titulaciones/propuestas/[id]/estado) — 'Pendiente'
// queda afuera a propósito: nace solo, nunca lo asigna un revisor a mano.
export const ESTADOS_DECISION_PROPUESTA = [ESTADO_ACEPTADA, ESTADO_RECHAZADA, ESTADO_ANTECEDENTES] as const

// Rechazar o pedir antecedentes exige explicar por qué (queda en tt_estado.comentario); aceptar
// no necesita justificación.
export const crearTtEstadoPropuestaSchema = z
   .object({
      estado: z.enum(ESTADOS_DECISION_PROPUESTA, { error: 'El estado es requerido' }),
      comentario: z.string().trim().max(3000, 'Máximo 3000 caracteres').optional(),
   })
   .superRefine((data, ctx) => {
      if (data.estado !== ESTADO_ACEPTADA && !data.comentario) {
         ctx.addIssue({ code: 'custom', path: ['comentario'], message: 'El comentario es requerido' })
      }
   })

// inv_motivacion/inv_experiencia solo van con modalidad "Investigación"; cla_problema/
// cla_objetivo solo con "Proyecto Propio" — se exigen o se descartan según la modalidad en
// `superRefine` (el objeto base los deja opcionales). `fecha` y `hayCambios` no van acá: los
// pone el propio endpoint (fecha = ahora, hayCambios = false), el estudiante no los ingresa.
export const crearTtPropuestaSchema = z
   .object({
      titulo: nombreSchema('El título es requerido', 250),
      modalidad: z.enum(MODALIDADES_PROPUESTA, { error: 'La modalidad es requerida' }),
      descripcion: z
         .string({ error: 'La descripción es requerida' })
         .trim()
         .min(1, 'La descripción es requerida')
         .max(3000, 'Máximo 3000 caracteres'),
      invMotivacion: z.string().trim().max(3000, 'Máximo 3000 caracteres').optional(),
      invExperiencia: z.string().trim().max(3000, 'Máximo 3000 caracteres').optional(),
      claProblema: z.string().trim().max(3000, 'Máximo 3000 caracteres').optional(),
      claObjetivo: z.string().trim().max(3000, 'Máximo 3000 caracteres').optional(),
      // rolId solo aplica a "Tesina Feria de Software"; lineaInvestigacionId solo a
      // "Investigación" — cada propuesta completa a lo más uno de los dos (ver superRefine).
      rolId: z.number().int().optional(),
      lineaInvestigacionId: z.number().int().optional(),
   })
   .superRefine((data, ctx) => {
      if (data.modalidad === 'Investigación') {
         if (!data.invMotivacion)
            ctx.addIssue({ code: 'custom', path: ['invMotivacion'], message: 'La motivación es requerida' })
         if (!data.invExperiencia)
            ctx.addIssue({ code: 'custom', path: ['invExperiencia'], message: 'La experiencia es requerida' })
         if (!data.lineaInvestigacionId)
            ctx.addIssue({
               code: 'custom',
               path: ['lineaInvestigacionId'],
               message: 'La línea de investigación es requerida',
            })
      }
      if (data.modalidad === 'Proyecto Propio') {
         if (!data.claProblema)
            ctx.addIssue({ code: 'custom', path: ['claProblema'], message: 'El problema es requerido' })
         if (!data.claObjetivo)
            ctx.addIssue({ code: 'custom', path: ['claObjetivo'], message: 'El objetivo es requerido' })
      }
      if (data.modalidad === 'Tesina Feria de Software') {
         if (!data.rolId) ctx.addIssue({ code: 'custom', path: ['rolId'], message: 'El rol es requerido' })
      }
   })

// ============================================================
// Comisión — asignación de profesor guía
// ============================================================

// Valor de `TtComision.rol` para la fila que representa al profesor guía de una propuesta (a
// diferencia de otros roles de comisión — presidente, revisor — texto libre, no un enum de
// Postgres, igual que `modalidad`/`estado`). Ver el índice único parcial
// `tt_comision_propuesta_id_guia_key` (a lo más un profesor con este rol por propuesta) y
// POST /api/titulaciones/asignacion-guia/asignar.
export const ROL_COMISION_GUIA = 'Guía'

// Body de POST /api/titulaciones/asignacion-guia/asignar: `propuestaIds` es más de uno cuando se
// asigna a todo un equipo de Feria de Software (una fila de comisión por integrante que postuló),
// y exactamente uno para Investigación/Proyecto propio. `profesorEmail` nulo = quitar el guía
// asignado (deja al equipo/propuesta "Sin asignar").
export const asignarGuiaSchema = z.object({
   propuestaIds: z.array(z.number().int()).min(1, 'Debe incluir al menos una propuesta'),
   profesorEmail: emailSchema.nullable(),
})

// ============================================================
// Carga masiva de estudiantes
// ============================================================

// Una fila ya extraída del Excel en el browser (ver app/pages/titulaciones/estudiantes.vue),
// validada estrictamente. La contraseña NO viene acá: se autogenera en el servidor a partir
// de run/apellidoPaterno/nombres (ver `generarPasswordEstudiante` en
// titulacionesCargaMasiva.ts) y por eso no pasa por `passwordSchema` — es un valor derivado,
// no elegido por nadie.
// Normaliza "PEREZ soto" / "juan CARLOS" a "Perez Soto" / "Juan Carlos": primera letra de cada
// palabra en mayúscula, el resto en minúscula. Solo se aplica acá (carga masiva) porque el
// Excel de origen suele venir todo en mayúsculas; en creación/edición manual se respeta lo que
// la persona escriba.
const capitalizarPalabras = (valor: string) =>
   valor
      .toLocaleLowerCase('es')
      .split(' ')
      .map((palabra) => (palabra ? palabra.charAt(0).toLocaleUpperCase('es') + palabra.slice(1) : palabra))
      .join(' ')

export const filaCargaMasivaEstudianteSchema = z.object({
   run: runSchema,
   apellidoPaterno: nombreSchema('El apellido paterno es requerido', 50).transform(capitalizarPalabras),
   apellidoMaterno: nombreSchema('El apellido materno es requerido', 50).transform(capitalizarPalabras),
   nombres: nombreSchema('Los nombres son requeridos', 50).transform(capitalizarPalabras),
   email: emailSchema,
   // Nombre del archivo y número de fila de origen (1-indexado, tal como se ve en Excel) —
   // solo para poder reportar errores de forma legible, no se guardan en la BD.
   archivo: z.string(),
   fila: z.number().int(),
})

// Forma "cruda" de una fila, sin las reglas de negocio (formato de RUN, largos máximos, etc.):
// se usa para el parseo inicial del body completo, para que una fila con datos inválidos no
// tire abajo la carga completa. Cada fila se revalida individualmente después con
// `filaCargaMasivaEstudianteSchema` — ver server/api/titulaciones/estudiantes/carga-masiva.post.ts.
const filaCrudaSchema = z.object({
   run: z.string(),
   apellidoPaterno: z.string(),
   apellidoMaterno: z.string(),
   nombres: z.string(),
   email: z.string(),
   archivo: z.string(),
   fila: z.number().int(),
})

export const cargaMasivaEstudiantesSchema = z.object({
   procesoId: z.number({ error: 'El proceso es requerido' }).int(),
   // Sin límite superior explícito: el propio tamaño del body HTTP ya acota cuántas filas
   // caben en una carga.
   filas: z.array(filaCrudaSchema),
})
