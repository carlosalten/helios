export interface ReservaResumenItem {
   id: number
   titulo: string
   fecha: string
   inicio: string
   fin: string
   salaCodigo: string
   persona: { id: number; nombre: string; apellido: string } | null
   tipoReserva: { id: number; nombre: string; color: string }
}

export interface ResumenReservas {
   hoy: string
   semana: { desde: string; hasta: string }
   mes: { desde: string; hasta: string }
   reservas: ReservaResumenItem[]
}

// Tipos que representan el uso normal del horario (clases y ayudantías agendadas), no una
// reserva puntual — se excluyen por defecto en /reservas/resumen.
export const TIPOS_RESERVA_HORARIO = ['Clase', 'Ayudantía']
