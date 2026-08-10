import { z } from 'zod'

export const TIPOS_SESION = ['TEORIA', 'PRACTICA'] as const

export const crearSesionSchema = z.object({
    paraleloId: z.number({ error: 'El paralelo es requerido' }).int(),
    diaSemana: z.number({ error: 'El día es requerido' }).int().min(1, 'Día inválido').max(7, 'Día inválido'),
    bloqueId: z.number({ error: 'El bloque es requerido' }).int(),
    tipo: z.enum(TIPOS_SESION, { error: 'El tipo de sesión es requerido' }),
})

// Asignación de sala y/o profesor a una sesión existente (drag-and-drop).
// Cada campo es opcional; `null` desasigna, ausente = no se toca.
export const asignarSesionSchema = z.object({
    salaCodigo: z.string().max(20).nullable().optional(),
    profesorId: z.number().int().nullable().optional(),
})

// Mover una sesión a otra celda (otro día y/o bloque), conservando tipo/sala/profesor.
export const moverSesionSchema = z.object({
    diaSemana: z.number({ error: 'El día es requerido' }).int().min(1, 'Día inválido').max(7, 'Día inválido'),
    bloqueId: z.number({ error: 'El bloque es requerido' }).int(),
})
