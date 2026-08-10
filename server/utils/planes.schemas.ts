import { z } from 'zod'

export const crearPlanSchema = z.object({
   numero: z.number({ error: 'El número es requerido' }).int().positive('El número debe ser positivo'),
   vigente: z.boolean({ error: 'Vigente es requerido' }),
   carreraCodigo: z.number({ error: 'La carrera es requerida' }).int(),
   cantidadSemestres: z
      .number({ error: 'La cantidad de semestres es requerida' })
      .int()
      .min(4, 'La cantidad de semestres debe ser como mínimo 4')
      .max(12, 'La cantidad de semestres debe ser como máximo 12')
      .default(4),
   // Habilita el cuadro de Electivos en /planes/asignacion para este plan.
   tieneElectivos: z.boolean().default(false),
})

// `semestre` se exige siempre (>=1, invariante de BD), incluso cuando `esElectiva` es true: en
// ese caso el valor no se usa para ubicar la asignatura en una columna (va al cuadro de
// Electivos), pero igual debe satisfacer la constraint `asignatura_plan_semestre_positivo`.
export const toggleAsignaturaPlanSchema = z.object({
   planId: z.number({ error: 'El plan es requerido' }).int(),
   asignaturaId: z.number({ error: 'La asignatura es requerida' }).int(),
   semestre: z.number({ error: 'El semestre es requerido' }).int().min(1, 'El semestre debe ser mayor o igual a 1'),
   esElectiva: z.boolean().default(false),
})

export const actualizarSemestreAsignaturaPlanSchema = z.object({
   semestre: z.number({ error: 'El semestre es requerido' }).int().min(1, 'El semestre debe ser mayor o igual a 1'),
   esElectiva: z.boolean().default(false),
})

export const reordenarAsignaturaPlanSchema = z.object({
   planId: z.number({ error: 'El plan es requerido' }).int(),
   semestre: z.number({ error: 'El semestre es requerido' }).int().min(1, 'El semestre debe ser mayor o igual a 1'),
   esElectiva: z.boolean().default(false),
   // IDs de asignatura_plan de la columna completa, en el orden final deseado.
   ordenIds: z.array(z.number().int()).min(1, 'La lista de orden no puede estar vacía'),
})
