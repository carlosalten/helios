import { z } from 'zod'

export const ALCANCES_FERIADO = ['SOLO_CLASES', 'TOTAL'] as const

const fechaSchema = z
   .string({ error: 'La fecha es requerida' })
   .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
   .transform((v) => new Date(`${v}T00:00:00.000Z`))

// null/undefined pasan directo (feriado de día completo); si viene un string, debe ser
// una hora válida.
const horaSchema = z
   .string()
   .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora inválido (HH:MM)')
   .transform((v) => new Date(`1970-01-01T${v}:00.000Z`))
   .nullish()

export const crearFeriadoSchema = z
   .object({
      semestreId: z.number({ error: 'El semestre es requerido' }).int(),
      fecha: fechaSchema,
      alcance: z.enum(ALCANCES_FERIADO, { error: 'El alcance es requerido' }),
      // Solo determina cómo tratar horaInicio/horaTermino a continuación; no se guarda.
      esDiaCompleto: z.boolean().default(true),
      horaInicio: horaSchema,
      horaTermino: horaSchema,
   })
   .refine((data) => data.esDiaCompleto || (data.horaInicio != null && data.horaTermino != null), {
      error: 'Debe indicar la hora de inicio y de término, o marcar el día completo',
      path: ['horaTermino'],
   })
   .refine((data) => !data.horaInicio || !data.horaTermino || data.horaTermino > data.horaInicio, {
      error: 'La hora de término debe ser posterior a la hora de inicio',
      path: ['horaTermino'],
   })
   // Si es día completo, las horas quedan en null sin importar lo que haya llegado en el
   // body: el servidor no confía en que el frontend las haya limpiado (constraint
   // `feriado_horas_validas` en BD las exige o ambas null o ambas con valor).
   .transform(({ esDiaCompleto, ...data }) => ({
      ...data,
      horaInicio: esDiaCompleto ? null : data.horaInicio,
      horaTermino: esDiaCompleto ? null : data.horaTermino,
   }))

export type CrearFeriadoInput = z.infer<typeof crearFeriadoSchema>
