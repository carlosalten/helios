import type { Sala } from '~/types/sala'

export interface PantallaPublica {
   id: number
   nombre: string
   codigo: string
   segundosPorSlide: number
   // Cuántas próximas clases se muestran por sala en la pantalla pública; `null` = todas las
   // que queden por comenzar hoy.
   proximasPorSala: number | null
   salas: Sala[]
}

/* ── Forma que devuelve el endpoint público /api/pantallas/publico/[codigo] ──────────────
   Clases EN CURSO y PRÓXIMAS A INICIAR hoy en las salas de la pantalla — no el horario
   completo. Deliberadamente distinta (y más plana) que `Reserva` (app/types/reserva.ts): la
   pantalla pública no necesita ids de edición ni el detalle completo de sesión/persona. */
export interface ClasePantalla {
   id: number
   salaCodigo: string
   carreraNombre: string
   asignaturaCodigo: string
   asignaturaNombre: string
   paraleloCodigo: string
   inicio: string
   fin: string
   profesor: string | null
   cancelada: boolean
}

export interface DatosPantallaPublica {
   pantalla: { nombre: string; codigo: string; segundosPorSlide: number }
   hoy: string | null
   enCurso: ClasePantalla[]
   proximas: ClasePantalla[]
}
