// Fila de la lista de /configuracion: una asignatura del plan seleccionado, con si está
// exenta de las advertencias de topes de horario (GET
// /api/configuracion/planes/[id]/asignaturas).
export interface AsignaturaPlanConExencion {
   asignaturaPlanId: number
   asignaturaId: number
   codigo: string
   nombre: string
   semestre: number
   esElectiva: boolean
   exentaTope: boolean
}
