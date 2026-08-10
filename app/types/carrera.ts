import type { PersonaBase } from '~/types/persona'
import type { Jornada } from '~/types/bloque'

export interface Carrera {
   codigo: number
   nombre: string
   nombreCorto: string
   jefePersonaId: number
   jefe: PersonaBase
   jornada: Jornada
}

export interface PersonaConAsignacion extends PersonaBase {
   asignado: boolean
}
