export type AlcanceFeriado = 'SOLO_CLASES' | 'TOTAL'

export const ALCANCES_FERIADO: { valor: AlcanceFeriado; label: string }[] = [
   { valor: 'SOLO_CLASES', label: 'Solo clases (permite reuniones y otras actividades)' },
   { valor: 'TOTAL', label: 'Todo (clases y actividades)' },
]

export interface Feriado {
   id: number
   fecha: string
   // Ambos null: feriado de día completo. Ambos con valor: feriado parcial (constraint
   // `feriado_horas_validas` en BD).
   horaInicio: string | null
   horaTermino: string | null
   alcance: AlcanceFeriado
   semestreId: number
   semestre: { id: number; nombre: string }
}
