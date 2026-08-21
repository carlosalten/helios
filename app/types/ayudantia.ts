// Fila de GET /api/ayudantias/resumen: una ayudantía (serie recurrente colapsada en una sola
// fila) con su carrera/plan, asignatura, paralelo, ayudante, sala y horario semanal.
export interface AyudantiaResumen {
   reservaId: number
   serieId: string | null
   carreraNombre: string
   carreraCodigo: number
   planId: number
   planNumero: number
   asignaturaCodigo: string
   asignaturaNombre: string
   paraleloCodigo: string
   // Nulo: la ayudantía no tiene un ayudante asignado (personaId nulo en la reserva).
   ayudanteNombre: string | null
   salaCodigo: string
   // ISO: 1 = Lunes … 7 = Domingo — ver app/types/dia.ts.
   diaSemana: number
   inicio: string
   fin: string
}
