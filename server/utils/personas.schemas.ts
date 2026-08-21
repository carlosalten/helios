import { z } from 'zod'

// El nombre/apellido puede venir compuesto de varias palabras (ej. "Juan Pablo"): cada una se
// capitaliza por separado, no solo la primera del campo completo.
const capitalizar = (s: string) =>
   s
      .split(' ')
      .map((palabra) => (palabra ? palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase() : palabra))
      .join(' ')

const nombrePropioSchema = (mensajeRequerido: string) =>
   z
      .string({ error: mensajeRequerido })
      .trim()
      .min(1, mensajeRequerido)
      .max(50, 'Máximo 50 caracteres')
      .transform(capitalizar)

// Política única de contraseñas: la usan tanto el Administrador al asignarle una contraseña a
// otra persona (/personas/gestion) como el propio usuario al cambiar la suya (/cuenta/contrasena).
// Se mantiene en un solo lugar para que nadie pueda quedar con una contraseña más débil según
// por dónde se haya fijado.
export const passwordSchema = z
   .string({ error: 'La contraseña es requerida' })
   .min(8, 'Mínimo 8 caracteres')
   .regex(/\d/, 'Debe contener al menos un número')
   .regex(/[a-z]/, 'Debe contener al menos una minúscula')
   .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
   .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un símbolo')

export const crearRolSchema = z.object({
   nombre: z
      .string({ error: 'El nombre es requerido' })
      .min(1, 'El nombre es requerido')
      .max(30, 'Máximo 30 caracteres'),
   // Mayor número = más alto en la jerarquía. Determina qué roles puede asignar una persona
   // de este rol al crear/editar a otra en /personas/gestion — ver jerarquiaRol en la sesión.
   jerarquia: z
      .number({ error: 'La jerarquía es requerida' })
      .int('Debe ser un número entero')
      .min(0, 'Debe ser mayor o igual a 0')
      .max(1000, 'Máximo 1000'),
})

export const JORNADAS_LABORALES = ['COMPLETA', 'PARCIAL'] as const

// Un solo emoji (o una secuencia ZWJ de varios codepoints — familia, tono de piel, etc.)
// elegido de https://unicode.org/emoji/charts/full-emoji-list.html. String vacío se guarda
// como nulo, no como cadena vacía (mismo criterio que TtRol.descripcion).
const emojiSchema = z
   .string()
   .trim()
   .max(32, 'Máximo 32 caracteres')
   .nullable()
   .transform((v) => (v ? v : null))

export const crearPersonaSchema = z.object({
   email: z
      .string({ error: 'El email es requerido' })
      .trim()
      .toLowerCase()
      .email('Email inválido')
      .max(50, 'Máximo 50 caracteres'),
   nombre: nombrePropioSchema('El nombre es requerido'),
   apellido: nombrePropioSchema('El apellido es requerido'),
   rolId: z.number({ error: 'El rol es requerido' }).int(),
   // Solo aplica a profesores; el resto de los roles la deja en null.
   jornadaLaboral: z.enum(JORNADAS_LABORALES, { error: 'Jornada laboral inválida' }).nullable(),
   emoji: emojiSchema,
})

export const editarPersonaSchema = z.object({
   nombre: nombrePropioSchema('El nombre es requerido'),
   apellido: nombrePropioSchema('El apellido es requerido'),
   jornadaLaboral: z.enum(JORNADAS_LABORALES, { error: 'Jornada laboral inválida' }).nullable(),
   emoji: emojiSchema,
})

// Alta/edición de un Ayudante desde /ayudantias/gestion: mismo criterio de nombre/email que
// crearPersonaSchema, pero sin rolId/jornadaLaboral/emoji — el endpoint fija el rol en
// 'Ayudante', nunca a elección de quien llena el formulario.
export const crearAyudanteSchema = z.object({
   email: z
      .string({ error: 'El email es requerido' })
      .trim()
      .toLowerCase()
      .email('Email inválido')
      .max(50, 'Máximo 50 caracteres'),
   nombre: nombrePropioSchema('El nombre es requerido'),
   apellido: nombrePropioSchema('El apellido es requerido'),
})

export const editarAyudanteSchema = z.object({
   nombre: nombrePropioSchema('El nombre es requerido'),
   apellido: nombrePropioSchema('El apellido es requerido'),
})

export const cambiarRolPersonaSchema = z.object({
   rolId: z.number({ error: 'El rol es requerido' }).int(),
})

export const cambiarPasswordPersonaSchema = z.object({
   password: passwordSchema,
})

// Cambio de contraseña propio (/cuenta/contrasena). A diferencia del anterior exige la
// contraseña actual: el Administrador asigna contraseñas sin conocer la vigente, pero el propio
// usuario tiene que demostrar que la sesión es suya y no de un equipo que quedó abierto.
export const cambiarMiPasswordSchema = z
   .object({
      passwordActual: z
         .string({ error: 'La contraseña actual es requerida' })
         .min(1, 'La contraseña actual es requerida'),
      password: passwordSchema,
      passwordRepetida: z.string({ error: 'Repite la nueva contraseña' }).min(1, 'Repite la nueva contraseña'),
   })
   .refine((datos) => datos.password === datos.passwordRepetida, {
      message: 'Las contraseñas no coinciden',
      path: ['passwordRepetida'],
   })
   .refine((datos) => datos.password !== datos.passwordActual, {
      message: 'La nueva contraseña debe ser distinta de la actual',
      path: ['password'],
   })
