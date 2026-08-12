import { z } from 'zod'
import { COLORES_RESERVA } from '~/types/reserva'

const capitalizarPrimeraLetra = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// El color debe venir de la paleta fija de 20 (ver COLORES_RESERVA): el formulario solo
// ofrece esas opciones, pero se valida acá también por si llega un valor fuera de la lista.
const colorReservaSchema = z
   .string({ error: 'El color es requerido' })
   .refine((v) => COLORES_RESERVA.some((c) => c.hex === v), { error: 'Color inválido' })

export const crearTipoReservaSchema = z.object({
   nombre: z
      .string({ error: 'El nombre es requerido' })
      .trim()
      .min(1, 'El nombre es requerido')
      .max(30, 'Máximo 30 caracteres')
      .transform(capitalizarPrimeraLetra),
   color: colorReservaSchema,
   // Valor por defecto de Reserva.publica para una reserva nueva de este tipo (ver comentario
   // en schema.prisma). Con default: los payloads viejos que no lo mandan siguen siendo
   // públicos por defecto.
   publicaPorDefecto: z.boolean().default(true),
})

const horaSchema = (mensajeRequerido: string) =>
   z.string({ error: mensajeRequerido }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora inválido (HH:MM)')

// Reservas de sala que no son de clases (reuniones, eventos, etc.): granularidad de 5
// minutos y fin > inicio (constraints `reserva_granularidad_5min` y
// `reserva_fin_mayor_inicio` en BD — ver CLAUDE.md raíz). Se valida acá también para
// devolver un 422 legible en vez de un 500 de constraint.
export const crearReservaSchema = z
   .object({
      salaCodigo: z.string({ error: 'La sala es requerida' }).trim().min(1),
      titulo: z
         .string({ error: 'El título es requerido' })
         .trim()
         .min(1, 'El título es requerido')
         .max(50, 'Máximo 50 caracteres'),
      fecha: z
         .string({ error: 'La fecha es requerida' })
         .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
         .transform((v) => new Date(`${v}T00:00:00.000Z`)),
      inicio: horaSchema('La hora de inicio es requerida'),
      fin: horaSchema('La hora de término es requerida'),
      tipoReservaId: z.number({ error: 'El tipo de reserva es requerido' }).int(),
      // Nulo: reserva sin responsable designado (ver Reserva.personaId en schema.prisma).
      personaId: z.number().int().nullable(),
      // Si se muestra en vistas de cara al público (impresa de /reservas/horario y pantalla
      // pública). Con default: los payloads viejos (sesiones de clases, integraciones) que no
      // mandan el campo siguen mostrándose.
      publica: z.boolean().default(true),
   })
   .refine((data) => data.fin > data.inicio, {
      error: 'La hora de término debe ser posterior a la hora de inicio',
      path: ['fin'],
   })
   .refine((data) => Number(data.inicio.slice(3)) % 5 === 0, {
      error: 'La hora de inicio debe ser múltiplo de 5 minutos',
      path: ['inicio'],
   })
   .refine((data) => Number(data.fin.slice(3)) % 5 === 0, {
      error: 'La hora de término debe ser múltiplo de 5 minutos',
      path: ['fin'],
   })
   .transform((data) => ({
      ...data,
      inicio: new Date(`1970-01-01T${data.inicio}:00.000Z`),
      fin: new Date(`1970-01-01T${data.fin}:00.000Z`),
   }))

export type CrearReservaInput = z.infer<typeof crearReservaSchema>

// Reserva recurrente: misma sala/horario/tipo/persona cada semana, desde `fecha` hasta
// `repetirHasta` (inclusive) — el endpoint genera una fila por semana, todas con el mismo
// `serieId`.
export const crearReservaRecurrenteSchema = z
   .object({
      salaCodigo: z.string({ error: 'La sala es requerida' }).trim().min(1),
      titulo: z
         .string({ error: 'El título es requerido' })
         .trim()
         .min(1, 'El título es requerido')
         .max(50, 'Máximo 50 caracteres'),
      fecha: z.string({ error: 'La fecha es requerida' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
      repetirHasta: z
         .string({ error: 'La fecha de término de la recurrencia es requerida' })
         .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
      inicio: horaSchema('La hora de inicio es requerida'),
      fin: horaSchema('La hora de término es requerida'),
      tipoReservaId: z.number({ error: 'El tipo de reserva es requerido' }).int(),
      // Nulo: reserva sin responsable designado (ver Reserva.personaId en schema.prisma).
      personaId: z.number().int().nullable(),
      // Si las reservas de la serie se muestran en vistas de cara al público (impresa y
      // pantalla pública).
      publica: z.boolean().default(true),
   })
   .refine((data) => data.fin > data.inicio, {
      error: 'La hora de término debe ser posterior a la hora de inicio',
      path: ['fin'],
   })
   .refine((data) => Number(data.inicio.slice(3)) % 5 === 0, {
      error: 'La hora de inicio debe ser múltiplo de 5 minutos',
      path: ['inicio'],
   })
   .refine((data) => Number(data.fin.slice(3)) % 5 === 0, {
      error: 'La hora de término debe ser múltiplo de 5 minutos',
      path: ['fin'],
   })
   .refine((data) => data.repetirHasta >= data.fecha, {
      error: 'La fecha de término de la recurrencia debe ser igual o posterior a la fecha de inicio',
      path: ['repetirHasta'],
   })
   // Tope superior: el endpoint genera una fila por semana entre `fecha` y `repetirHasta`, así
   // que sin límite un rango como 9999-12-31 crearía cientos de miles de filas de una sola
   // petición (agotamiento de recursos). Un año cubre de sobra cualquier reserva académica.
   .refine(
      (data) => {
         const inicio = new Date(`${data.fecha}T00:00:00.000Z`).getTime()
         const fin = new Date(`${data.repetirHasta}T00:00:00.000Z`).getTime()
         return fin - inicio <= 366 * 24 * 60 * 60 * 1000
      },
      { error: 'La recurrencia no puede abarcar más de un año', path: ['repetirHasta'] }
   )

export type CrearReservaRecurrenteInput = z.infer<typeof crearReservaRecurrenteSchema>
