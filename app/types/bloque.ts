export type Jornada = 'DIURNA' | 'VESPERTINA'

export const JORNADAS: { valor: Jornada; label: string }[] = [
    { valor: 'DIURNA', label: 'Diurna' },
    { valor: 'VESPERTINA', label: 'Vespertina' },
]

export interface Bloque {
    id: number
    semestreId: number
    numero: number
    inicio: string
    fin: string
    jornada: Jornada
    esUltimoManana: boolean
    diasProtegidos: number[]
    semestre: { id: number; nombre: string }
}
