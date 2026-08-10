import { z } from 'zod'

// Filtro de /reportes/asignaturas-plan: se calcula sobre los cursos de un plan puntual en
// un semestre puntual.
export const filtroPlanSemestreSchema = z.object({
   planId: z.coerce.number({ error: 'El plan es requerido' }).int().positive(),
   semestreId: z.coerce.number({ error: 'El semestre es requerido' }).int().positive(),
})

export type FiltroPlanSemestreInput = z.infer<typeof filtroPlanSemestreSchema>
