// Reporte de la validación previa del CSV de programación académica
// (POST /api/cursos/carga-masiva/validar).
export interface ErrorCargaMasiva {
   titulo: string
   detalles: string[]
}

export interface ReporteCargaMasiva {
   lectura: {
      filasArchivo: number
      filasIgnoradasFormato: number
      filasOtroCampus: number
      filasOtraCarrera: number
      // Filas descartadas por no ser Cátedra ni Práctico (el horario solo modela esos dos).
      filasOtroTipo: number
      filasConsideradas: number
   }
   // Con al menos un error la carga queda bloqueada.
   errores: ErrorCargaMasiva[]
   advertencias: string[]
   aEliminar: { cursos: number; paralelos: number; sesiones: number; reservas: number }
   aCrear: { cursosNuevos: string[]; paralelos: number; sesiones: number; reservas: number }
}

// Resultado de la carga (POST /api/cursos/carga-masiva).
export interface ResultadoCargaMasiva {
   cursosCreados: number
   paralelosCreados: number
   sesionesCreadas: number
   reservasCreadas: number
   eliminados: { cursos: number; paralelos: number; sesiones: number; reservas: number }
   advertencias: string[]
}
