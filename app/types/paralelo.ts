import type { AsignaturaPlan } from '~/types/asignaturaPlan'

export interface Paralelo {
   id: number
   codigo: string
   cupo: number
   orden: number
   color: string | null
   asignaturaPlanId: number
   cursoId: number
   asignaturaPlan: AsignaturaPlan
   curso: { id: number; nombre: string; planId: number; semestreId: number; semestre: { id: number; nombre: string } }
}
