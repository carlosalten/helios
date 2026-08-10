import { z } from 'zod'

export const crearSemestreSchema = z
    .object({
        nombre: z
            .string({ error: 'El nombre es requerido' })
            .trim()
            .min(1, 'El nombre es requerido')
            .max(20, 'Máximo 20 caracteres'),
        fechaInicio: z.coerce.date({ error: 'La fecha de inicio es requerida' }),
        fechaFin: z.coerce.date({ error: 'La fecha de fin es requerida' }),
        vigente: z.boolean({ error: 'Vigente es requerido' }),
    })
    .refine((data) => data.fechaFin > data.fechaInicio, {
        error: 'La fecha de fin debe ser posterior a la fecha de inicio',
        path: ['fechaFin'],
    })
