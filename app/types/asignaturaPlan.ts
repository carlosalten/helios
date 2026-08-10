export interface AsignaturaPlan {
   id: number
   asignaturaId: number
   planId: number
   semestre: number
   // Electiva en este plan: se puede crear su paralelo en un curso de cualquier semestre.
   esElectiva: boolean
   asignatura: { id: number; codigo: string; nombre: string; bloquesTeoria: number; bloquesPractica: number }
   plan: {
      id: number
      numero: number
      vigente: boolean
      carreraCodigo: number
      carrera: { codigo: number; nombre: string }
   }
}
