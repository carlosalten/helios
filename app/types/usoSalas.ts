// Respuesta de GET /api/reportes/uso-salas. Ver ese archivo para la definición exacta de
// cada métrica (plantilla semanal vs. reservas reales del semestre).

export interface DesgloseUso {
   nombre: string
   color: string | null
   cantidad: number
   porcentaje: number
}

export interface BloqueLibre {
   diaSemana: number
   bloqueId: number
   bloqueNumero: number
   inicio: string
   fin: string
}

export interface UsoSala {
   codigo: string
   tipoSala: string
   capacidad: number
   bloquesUniverso: number
   bloquesOcupados: number
   bloquesLibres: number
   porcentajeUso: number
   totalReservas: number
   bloquesLibresDetalle: BloqueLibre[]
   porTipo: DesgloseUso[]
   porCarrera: DesgloseUso[]
}

export interface ReporteUsoSalas {
   semestre: { id: number; nombre: string; fechaInicio: string; fechaFin: string } | null
   salas: UsoSala[]
   resumen: {
      totalSalas: number
      usoPromedio: number
      salaMasUsada: { codigo: string; porcentaje: number } | null
      salaMenosUsada: { codigo: string; porcentaje: number } | null
      totalReservasSemestre: number
   } | null
   porTipoGeneral: DesgloseUso[]
   porCarreraGeneral: DesgloseUso[]
}
