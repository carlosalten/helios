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

// Equivalencias de un plan para /asignaturas/equivalencias (GET /api/asignaturas/equivalencias):
// la malla con las equivalentes de cada asignatura, y las candidatas (asignaturas fuera de la
// malla). Ver AsignaturaPlanEquivalente en schema.prisma.
export interface AsignaturaBasica {
   id: number
   codigo: string
   nombre: string
}
export interface AsignaturaMallaConEquivalentes extends AsignaturaBasica {
   asignaturaPlanId: number
   semestre: number
   esElectiva: boolean
   equivalentes: AsignaturaBasica[]
}
export interface EquivalenciasPlan {
   malla: AsignaturaMallaConEquivalentes[]
   candidatas: AsignaturaBasica[]
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
