export type TemaPreferido = 'CLARO' | 'OSCURO'

export const TEMAS_PREFERIDOS: { valor: TemaPreferido; label: string }[] = [
   { valor: 'CLARO', label: 'Claro' },
   { valor: 'OSCURO', label: 'Oscuro' },
]

// Opciones de registros por página de las tablas (preferencia en /cuenta/preferencias y
// selector de cada tabla). Deben coincidir con el CHECK persona_registros_por_pagina_valido.
export const OPCIONES_REGISTROS_POR_PAGINA = [10, 20, 30, 40, 50] as const
export const REGISTROS_POR_PAGINA_DEFECTO = 20

export type SemestrePorDefecto = 'VIGENTE' | 'BORRADOR'

export const SEMESTRES_POR_DEFECTO: { valor: SemestrePorDefecto; label: string }[] = [
   { valor: 'VIGENTE', label: 'Semestre vigente' },
   { valor: 'BORRADOR', label: 'Semestre borrador' },
]
