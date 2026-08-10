export interface TipoSala {
    id: number
    nombre: string
}

export interface Sala {
    codigo: string
    capacidad: number
    tipoSalaId: number
    tipoSala: TipoSala
}

import type { PersonaBase } from '~/types/persona'

export interface PersonaConAsignacion extends PersonaBase {
    asignado: boolean
}
