import { z } from 'zod'

export const JORNADAS = ['DIURNA', 'VESPERTINA'] as const

const horaSchema = (mensajeRequerido: string) =>
    z
        .string({ error: mensajeRequerido })
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora inválido (HH:MM)')
        .transform((v) => new Date(`1970-01-01T${v}:00.000Z`))

export const crearBloqueSchema = z
    .object({
        semestreId: z.number({ error: 'El semestre es requerido' }).int(),
        numero: z.number({ error: 'El número es requerido' }).int().positive('El número debe ser positivo'),
        inicio: horaSchema('La hora de inicio es requerida'),
        fin: horaSchema('La hora de fin es requerida'),
        jornada: z.enum(JORNADAS, { error: 'La jornada es requerida' }),
        // Marca el último bloque de la mañana (separa mañana/tarde en la matriz de horario).
        // A lo más un bloque por semestre puede tenerlo en true (constraint `bloque_un_ultimo_manana_por_semestre`).
        esUltimoManana: z.boolean().default(false),
        // Días (ISO 1=Lunes … 7=Domingo) en que este bloque queda protegido (sin clases de paralelos).
        diasProtegidos: z
            .array(z.number().int().min(1, 'Día inválido').max(7, 'Día inválido'))
            .default([])
            .transform((dias) => [...new Set(dias)]),
    })
    .refine((data) => data.fin > data.inicio, {
        error: 'La hora de fin debe ser posterior a la hora de inicio',
        path: ['fin'],
    })

export const copiarBloquesSchema = z
    .object({
        semestreOrigenId: z.number({ error: 'El semestre de origen es requerido' }).int(),
        semestreDestinoId: z.number({ error: 'El semestre de destino es requerido' }).int(),
    })
    .refine((data) => data.semestreOrigenId !== data.semestreDestinoId, {
        error: 'El semestre de origen y destino deben ser distintos',
        path: ['semestreDestinoId'],
    })
