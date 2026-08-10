import type { JornadaLaboral } from '~/types/persona'

export interface ProfesorBloques {
    id: number
    nombre: string
    apellido: string
    jornadaLaboral: JornadaLaboral | null
    rol: string | null
    cantidadBloques: number
    topes: {
        diaSemana: number
        bloqueId: number
        bloqueNumero: number
        bloqueInicio: string
        bloqueFin: string
        clases: {
            asignaturaId: number
            asignaturaNombre: string
            asignaturaCodigo: string
            planId: number
            codigoParalelo: string
        }[]
    }[]
    bloquesPorPlan: {
        planId: number
        cantidadBloques: number
        asignaturas: {
            asignaturaId: number
            nombre: string
            codigo: string
            paralelos: { codigo: string; cantidadBloques: number }[]
        }[]
    }[]
}
