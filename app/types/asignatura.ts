export interface Asignatura {
   id: number
   codigo: string
   nombre: string
   // Nombre abreviado para espacios reducidos (ej. tarjetas de la pantalla pública). Nulo: se
   // usa `nombre` completo donde haga falta.
   nombreCorto: string | null
   bloquesTeoria: number
   bloquesPractica: number
   asignaturasPlan: {
      id: number
      semestre: number
      plan: { id: number; numero: number; carrera: { codigo: number; nombre: string } }
   }[]
}

// Fila del panel derecho de /asignaturas/equivalencias: cada asignatura del sistema con el
// booleano de si es equivalente a la seleccionada (GET /api/asignaturas/[id]/equivalencias).
export interface AsignaturaConEquivalencia {
   id: number
   codigo: string
   nombre: string
   equivalente: boolean
}

// Fila del panel "Profesores que han dictado esta asignatura" de /horario (GET
// /api/asignaturas/[id]/profesores-historial). `vecesDictada` cuenta paralelos distintos (dos
// secciones en el mismo semestre cuentan dos veces). El orden ya viene del más reciente al
// más antiguo.
export interface ProfesorHistorialAsignatura {
   id: number
   nombre: string
   apellido: string
   vecesDictada: number
}
