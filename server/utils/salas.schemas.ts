import { z } from 'zod';

export const crearTipoSalaSchema = z.object({
    nombre: z
        .string({ error: 'El nombre es requerido' })
        .min(1, 'El nombre es requerido')
        .max(50, 'Máximo 50 caracteres'),
});

export const crearSalaSchema = z.object({
    codigo: z
        .string({ error: 'El código es requerido' })
        .min(1, 'El código es requerido')
        .max(20, 'Máximo 20 caracteres'),
    capacidad: z
        .number({ error: 'La capacidad es requerida' })
        .int()
        .min(1, 'La capacidad debe ser al menos 1'),
    tipoSalaId: z.number({ error: 'El tipo de sala es requerido' }).int(),
});

export const editarSalaSchema = z.object({
    capacidad: z
        .number({ error: 'La capacidad es requerida' })
        .int()
        .min(1, 'La capacidad debe ser al menos 1'),
    tipoSalaId: z.number({ error: 'El tipo de sala es requerido' }).int(),
});

export const toggleAsignacionSchema = z.object({
    codigoSala: z.string({ error: 'El código de sala es requerido' }).min(1),
    personaId: z.number({ error: 'La persona es requerida' }).int(),
});
