import type { AsignaturaPlan } from '~/types/asignaturaPlan'

export interface Paralelo {
   id: number
   codigo: string
   cupo: number
   orden: number
   color: string | null
   asignaturaPlanId: number
   cursoId: number
   // Equivalente desde la que se programó el paralelo; null = asignatura de la malla.
   asignaturaEquivalenteId: number | null
   asignaturaEquivalente: { id: number; codigo: string; nombre: string; nombreCorto: string | null } | null
   asignaturaPlan: AsignaturaPlan
   curso: { id: number; nombre: string; planId: number; semestreId: number; semestre: { id: number; nombre: string } }
}
