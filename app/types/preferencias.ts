export type TemaPreferido = 'CLARO' | 'OSCURO'

export const TEMAS_PREFERIDOS: { valor: TemaPreferido; label: string }[] = [
   { valor: 'CLARO', label: 'Claro' },
   { valor: 'OSCURO', label: 'Oscuro' },
]

export type SemestrePorDefecto = 'VIGENTE' | 'BORRADOR'

export const SEMESTRES_POR_DEFECTO: { valor: SemestrePorDefecto; label: string }[] = [
   { valor: 'VIGENTE', label: 'Semestre vigente' },
   { valor: 'BORRADOR', label: 'Semestre borrador' },
]
