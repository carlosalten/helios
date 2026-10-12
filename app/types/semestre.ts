export interface Semestre {
   id: number
   nombre: string
   fechaInicio: string
   fechaFin: string
   vigente: boolean
   borrador: boolean
   visible: boolean
}

// 'todas' y 'mias' son del Administrador (todo el sistema / carreras que dirige o tiene
// asignadas); 'dirige' y 'asignadas', del resto de los roles. Ver
// server/api/semestres/resumen.get.ts.
export type ModoResumenSemestres = 'todas' | 'mias' | 'dirige' | 'asignadas'

export interface ConteoCarreraResumen {
   codigo: number
   nombre: string
   cursos: number
   cursosVisibles: number
   paralelos: number
}

export interface TarjetaSemestreResumen {
   id: number
   nombre: string
   fechaInicio: string
   fechaFin: string
   visible: boolean
   cursos: number
   cursosVisibles: number
   paralelos: number
   carreras: ConteoCarreraResumen[]
}

export interface ResumenSemestres {
   modo: ModoResumenSemestres
   opcionesModo: { label: string; value: ModoResumenSemestres }[]
   // Solo en modo 'dirige': el Jefe de Carrera puede ocultar/mostrar los cursos de las
   // carreras que dirige en el semestre borrador.
   puedeGestionarVisibilidad: boolean
   vigente: TarjetaSemestreResumen | null
   borrador: TarjetaSemestreResumen | null
}
