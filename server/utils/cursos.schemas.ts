import { z } from 'zod'

export const crearCursoSchema = z.object({
   nombre: z
      .string({ error: 'El nombre es requerido' })
      .trim()
      .min(1, 'El nombre es requerido')
      .max(50, 'Máximo 50 caracteres'),
   numero: z.number({ error: 'El número es requerido' }).int().min(1, 'El número debe ser mayor o igual a 1'),
   numeroSemestre: z
      .number({ error: 'El semestre del plan es requerido' })
      .int()
      .min(1, 'Debe ser entre 1 y 12')
      .max(12, 'Debe ser entre 1 y 12'),
   planId: z.number({ error: 'El plan es requerido' }).int(),
   semestreId: z.number({ error: 'El semestre es requerido' }).int(),
})
