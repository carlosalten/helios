import { z } from 'zod'

export const crearParaleloSchema = z.object({
   codigo: z
      .string({ error: 'El código es requerido' })
      .trim()
      .min(1, 'El código es requerido')
      .max(10, 'Máximo 10 caracteres'),
   cupo: z.number({ error: 'El cupo es requerido' }).int().min(0, 'Debe ser entre 0 y 100').max(100, 'Debe ser entre 0 y 100'),
   // Color de los bloques de este paralelo en la matriz de horario. Omitido: no se toca
   // (permite que otras ediciones del paralelo no pisen el color ya asignado); null: sin color.
   color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido (formato hex, ej: #3B82F6)')
      .nullish(),
   asignaturaPlanId: z.number({ error: 'La asignatura es requerida' }).int(),
   cursoId: z.number({ error: 'El curso es requerido' }).int(),
})

export const reordenarParalelosSchema = z.object({
   cursoId: z.number({ error: 'El curso es requerido' }).int(),
   // IDs de paralelo del curso completo, en el orden final deseado.
   ordenIds: z.array(z.number().int()).min(1, 'La lista de orden no puede estar vacía'),
})
