import { z } from 'zod'

// El código va directo en la URL pública (/pantallas/<codigo>): se restringe a caracteres
// simples para no depender de codificación de URL.
const codigoPantallaSchema = z
   .string({ error: 'El código es requerido' })
   .min(1, 'El código es requerido')
   .max(20, 'Máximo 20 caracteres')
   .regex(/^[A-Za-z0-9_-]+$/, 'Solo letras, números, guiones y guion bajo')

const horaPantallaSchema = z
   .string()
   .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora inválido (HH:MM)')
   .nullable()

export const crearPantallaPublicaSchema = z
   .object({
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
      // Cuántas próximas clases mostrar por sala; `null` = todas las que queden por comenzar
      // hoy (opción "Todas" del formulario).
      proximasPorSala: z
         .number({ error: 'Debe ser un número' })
         .int()
         .min(1, 'Mínimo 1')
         .max(50, 'Máximo 50')
         .nullable(),
      // Ventana horaria de refresco (ver PantallaPublica.horaInicio/horaFin en schema.prisma).
      // Ambas nulas = sin restricción, la opción "Sin restricción" del formulario.
      horaInicio: horaPantallaSchema,
      horaFin: horaPantallaSchema,
   })
   .refine((data) => (data.horaInicio == null) === (data.horaFin == null), {
      error: 'Define la hora de inicio y término, o ninguna de las dos',
      path: ['horaFin'],
   })
   .transform((data) => ({
      ...data,
      horaInicio: data.horaInicio == null ? null : new Date(`1970-01-01T${data.horaInicio}:00.000Z`),
      horaFin: data.horaFin == null ? null : new Date(`1970-01-01T${data.horaFin}:00.000Z`),
   }))

export const editarPantallaPublicaSchema = crearPantallaPublicaSchema

export const toggleSalaPantallaSchema = z.object({
   pantallaId: z.number({ error: 'La pantalla es requerida' }).int(),
   salaCodigo: z.string({ error: 'La sala es requerida' }).min(1),
})
