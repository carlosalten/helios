// Paleta fija de colores para los tipos de reserva: el usuario elige por nombre, se guarda
// el hex. Cada reserva en /reservas/horario toma el color de su tipo.
export const COLORES_RESERVA = [
   { nombre: 'Rojo', hex: '#EF4444' },
   { nombre: 'Naranjo', hex: '#F97316' },
   { nombre: 'Ámbar', hex: '#F59E0B' },
   { nombre: 'Amarillo', hex: '#EAB308' },
   { nombre: 'Lima', hex: '#84CC16' },
   { nombre: 'Verde', hex: '#22C55E' },
   { nombre: 'Esmeralda', hex: '#10B981' },
   { nombre: 'Turquesa', hex: '#14B8A6' },
   { nombre: 'Cian', hex: '#06B6D4' },
   { nombre: 'Celeste', hex: '#0EA5E9' },
   { nombre: 'Azul', hex: '#3B82F6' },
   { nombre: 'Índigo', hex: '#6366F1' },
   { nombre: 'Violeta', hex: '#8B5CF6' },
   { nombre: 'Púrpura', hex: '#A855F7' },
   { nombre: 'Fucsia', hex: '#D946EF' },
   { nombre: 'Rosado', hex: '#EC4899' },
   { nombre: 'Rosa', hex: '#F43F5E' },
   { nombre: 'Café', hex: '#92400E' },
   { nombre: 'Gris', hex: '#6B7280' },
   { nombre: 'Pizarra', hex: '#1E293B' },
   { nombre: 'Rojo Oscuro', hex: '#B91C1C' },
   { nombre: 'Naranjo Oscuro', hex: '#C2410C' },
   { nombre: 'Amarillo Oscuro', hex: '#A16207' },
   { nombre: 'Verde Oscuro', hex: '#15803D' },
   { nombre: 'Turquesa Oscuro', hex: '#0F766E' },
   { nombre: 'Celeste Oscuro', hex: '#0369A1' },
   { nombre: 'Azul Oscuro', hex: '#1D4ED8' },
   { nombre: 'Violeta Oscuro', hex: '#6D28D9' },
   { nombre: 'Fucsia Oscuro', hex: '#A21CAF' },
   { nombre: 'Rosa Oscuro', hex: '#BE123C' },
   { nombre: 'Rojo Claro', hex: '#FCA5A5' },
   { nombre: 'Naranjo Claro', hex: '#FDBA74' },
   { nombre: 'Amarillo Claro', hex: '#FDE047' },
   { nombre: 'Lima Claro', hex: '#BEF264' },
   { nombre: 'Verde Claro', hex: '#86EFAC' },
   { nombre: 'Turquesa Claro', hex: '#5EEAD4' },
   { nombre: 'Celeste Claro', hex: '#7DD3FC' },
   { nombre: 'Azul Claro', hex: '#93C5FD' },
   { nombre: 'Violeta Claro', hex: '#C4B5FD' },
   { nombre: 'Rosado Claro', hex: '#F9A8D4' },
] as const

export interface TipoReserva {
   id: number
   nombre: string
   color: string
}

export interface Reserva {
   id: number
   salaCodigo: string
   titulo: string
   fecha: string
   inicio: string
   fin: string
   // Nulo: reserva sin responsable designado (p. ej. una clase con sala pero sin profesor).
   personaId: number | null
   tipoReservaId: number
   sesionParaleloId: number | null
   // Comparte serieId toda ocurrencia generada por la misma reserva recurrente (semanal);
   // null en una reserva no recurrente.
   serieId: string | null
   // Si la reserva aparece en la vista impresa de /reservas/horario.
   imprimir: boolean
   // Cancelada: no se borra (sigue tomando la sala en la BD), pero se destaca en rojo y con la
   // etiqueta "Cancelada" en vez de mostrarse como una reserva normal. Solo afecta esta
   // ocurrencia puntual, nunca la serie recurrente completa.
   cancelada: boolean
   sala: { codigo: string; capacidad: number }
   persona: { id: number; nombre: string; apellido: string } | null
   tipoReserva: TipoReserva
   // Presente solo si la reserva viene de una sesión de clases (ver sesionParaleloId).
   sesionParalelo: {
      paralelo: {
         codigo: string
         // Color del paralelo en la matriz de horario; nulo mientras no se le asigne uno.
         color: string | null
         asignaturaPlan: {
            asignatura: { nombre: string }
            plan: { numero: number; carreraCodigo: number; carrera: { nombre: string; nombreCorto: string } }
         }
      }
   } | null
}
