import { z } from 'zod'

// El código va directo en la URL pública (/pantallas/<codigo>): se restringe a caracteres
// simples para no depender de codificación de URL.
const codigoPantallaSchema = z
   .string({ error: 'El código es requerido' })
   .min(1, 'El código es requerido')
   .max(20, 'Máximo 20 caracteres')
   .regex(/^[A-Za-z0-9_-]+$/, 'Solo letras, números, guiones y guion bajo')

export const crearPantallaPublicaSchema = z.object({
   nombre: z
      .string({ error: 'El nombre es requerido' })
      .min(1, 'El nombre es requerido')
      .max(60, 'Máximo 60 caracteres'),
   codigo: codigoPantallaSchema,
   segundosPorSlide: z
      .number({ error: 'Los segundos por slide son requeridos' })
      .int()
      .min(3, 'Mínimo 3 segundos')
      .max(300, 'Máximo 300 segundos'),
})

export const editarPantallaPublicaSchema = crearPantallaPublicaSchema

export const toggleSalaPantallaSchema = z.object({
   pantallaId: z.number({ error: 'La pantalla es requerida' }).int(),
   salaCodigo: z.string({ error: 'La sala es requerida' }).min(1),
})
