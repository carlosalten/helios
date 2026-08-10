export interface Plan {
   id: number
   numero: number
   vigente: boolean
   carreraCodigo: number
   cantidadSemestres: number
   // Habilita el cuadro de Electivos en /planes/asignacion para este plan.
   tieneElectivos: boolean
   carrera: { codigo: number; nombre: string; nombreCorto: string }
}

export interface AsignaturaConAsignacion {
   id: number
   codigo: string
   nombre: string
   asignado: boolean
   asignaturaPlanId: number | null
   semestre: number
   orden: number
   // Si es electiva, va en el cuadro de Electivos en vez de la columna de `semestre`, y en
   // /paralelos/asignacion se puede asignar a un curso de cualquier semestre.
   esElectiva: boolean
}
