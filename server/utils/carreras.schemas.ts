import { z } from 'zod'

const nombreCortoSchema = z
   .string({ error: 'El nombre corto es requerido' })
   .trim()
   .min(1, 'El nombre corto es requerido')
   .max(30, 'Máximo 30 caracteres')

export const crearCarreraSchema = z.object({
   codigo: z.number({ error: 'El código es requerido' }).int().positive('El código debe ser positivo'),
   nombre: z
      .string({ error: 'El nombre es requerido' })
      .trim()
      .min(1, 'El nombre es requerido')
      .max(100, 'Máximo 100 caracteres'),
   nombreCorto: nombreCortoSchema,
   jefePersonaId: z.number({ error: 'El jefe de carrera es requerido' }).int(),
   jornada: z.enum(JORNADAS, { error: 'La jornada es requerida' }),
})

export const editarCarreraSchema = z.object({
   nombre: z
      .string({ error: 'El nombre es requerido' })
      .trim()
      .min(1, 'El nombre es requerido')
      .max(100, 'Máximo 100 caracteres'),
   nombreCorto: nombreCortoSchema,
   jefePersonaId: z.number({ error: 'El jefe de carrera es requerido' }).int(),
   jornada: z.enum(JORNADAS, { error: 'La jornada es requerida' }),
})

export const toggleAsignacionCarreraSchema = z.object({
   carreraCodigo: z.number({ error: 'El código de carrera es requerido' }).int(),
   personaId: z.number({ error: 'La persona es requerida' }).int(),
})
