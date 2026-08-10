import { z } from 'zod'

export const TEMAS_PREFERIDOS = ['CLARO', 'OSCURO'] as const

// Todos los campos son opcionales: /cuenta/preferencias tiene una tarjeta por criterio, cada
// una con su propio botón Guardar, así que cada PATCH solo manda los campos de esa tarjeta.
export const actualizarPreferenciasSchema = z.object({
   temaPreferido: z.enum(TEMAS_PREFERIDOS, { error: 'Tema inválido' }).optional(),
   mostrarTopesEspejo: z.boolean({ error: 'Valor inválido' }).optional(),
   colorTopesEspejo: z
      .string({ error: 'Color inválido' })
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido')
      .optional(),
})

export type ActualizarPreferenciasInput = z.infer<typeof actualizarPreferenciasSchema>
