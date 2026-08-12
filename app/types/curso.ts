export interface ParaleloTope {
   diaSemana: number
   bloqueId: number
   bloqueNumero: number
   bloqueInicio: string
   bloqueFin: string
   tipo: 'sala' | 'profesor'
   recurso: string
   otros: TopeOtroParalelo[]
}

// El otro extremo de un tope. `planId` es el del curso al que pertenece ese paralelo: si no
// coincide con el del curso mirado, el tope cruza a otro plan (y probablemente a otra carrera),
// así que en /cursos se lista aparte — resolverlo requiere coordinar con la otra carrera.
export interface TopeOtroParalelo {
   asignaturaNombre: string
   asignaturaCodigo: string
   paraleloCodigo: string
   cursoNombre: string
   planId: number
   planNumero: number
   carreraNombreCorto: string
}

export interface ParaleloDeCurso {
   id: number
   codigo: string
   asignaturaNombre: string
   asignaturaCodigo: string
   profesores: { id: number; nombre: string; apellido: string }[]
   bloquesTeoriaAsignados: number
   bloquesTeoriaRequeridos: number
   bloquesPracticaAsignados: number
   bloquesPracticaRequeridos: number
   horasCompletas: boolean
   topes: ParaleloTope[]
}

export interface Curso {
   id: number
   nombre: string
   numero: number
   numeroSemestre: number
   planId: number
   semestreId: number
   plan: {
      id: number
      numero: number
      vigente: boolean
      carreraCodigo: number
      carrera: { codigo: number; nombre: string }
   }
   semestre: { id: number; nombre: string }
   // Cantidad de asignaturas distintas con al menos un paralelo creado en este curso.
   cantidadAsignaturas: number
   // De esas, cuántas tienen profesor asignado en TODAS sus sesiones (y al menos una sesión creada).
   cantidadAsignaturasConProfesor: number
   cantidadParalelos: number
   // true si algún paralelo del curso tiene al menos un tope (ver `paralelos[].topes`).
   tieneTopes: boolean
   paralelos: ParaleloDeCurso[]
}
