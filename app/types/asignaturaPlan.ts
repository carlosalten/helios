export interface AsignaturaPlan {
   id: number
   asignaturaId: number
   planId: number
   semestre: number
   // Electiva en este plan: se puede crear su paralelo en un curso de cualquier semestre.
   esElectiva: boolean
   asignatura: {
      id: number
      codigo: string
      nombre: string
      nombreCorto: string | null
      bloquesTeoria: number
      bloquesPractica: number
   }
   // Equivalentes de esta asignatura en este plan (AsignaturaPlanEquivalente). Solo lo trae
   // GET /api/asignaturas-plan; no viene dentro de un Paralelo.
   equivalentes?: { asignatura: { id: number; codigo: string; nombre: string } }[]
   plan: {
      id: number
      numero: number
      vigente: boolean
      carreraCodigo: number
      carrera: { codigo: number; nombre: string }
   }
}
