import { z } from 'zod'

export const crearAsignaturaSchema = z
   .object({
      codigo: z
         .string({ error: 'El código es requerido' })
         .trim()
         .min(1, 'El código es requerido')
         .max(20, 'Máximo 20 caracteres'),
      nombre: z
         .string({ error: 'El nombre es requerido' })
         .trim()
         .min(1, 'El nombre es requerido')
         .max(100, 'Máximo 100 caracteres'),
      // Nombre abreviado para espacios reducidos. Nulo: se usa `nombre` completo donde haga
      // falta. Un string vacío se guarda como nulo, no como cadena vacía.
      nombreCorto: z
         .string()
         .trim()
         .max(50, 'Máximo 50 caracteres')
         .nullable()
         .transform((v) => (v ? v : null)),
      bloquesTeoria: z.number({ error: 'Los bloques de teoría son requeridos' }).int().min(0, 'No puede ser negativo'),
      bloquesPractica: z
         .number({ error: 'Los bloques de práctica son requeridos' })
         .int()
         .min(0, 'No puede ser negativo'),
   })
   .refine((data) => data.bloquesTeoria > 0 || data.bloquesPractica > 0, {
      message: 'Debe tener al menos un bloque de teoría o de práctica',
      path: ['bloquesPractica'],
   })

// Alta/baja de una equivalencia entre dos asignaturas (ver AsignaturaEquivalencia en
// schema.prisma). El endpoint la guarda en las dos direcciones; acá solo se valida el par.
export const toggleEquivalenciaSchema = z.object({
   asignaturaId: z.number({ error: 'La asignatura es requerida' }).int(),
   equivalenteId: z.number({ error: 'La asignatura equivalente es requerida' }).int(),
})
