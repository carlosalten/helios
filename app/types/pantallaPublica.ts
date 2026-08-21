import type { Sala } from '~/types/sala'

export interface PantallaPublica {
   id: number
   nombre: string
   codigo: string
   segundosPorSlide: number
   // Cuántas próximas clases se muestran por sala en la pantalla pública; `null` = todas las
   // que queden por comenzar hoy.
   proximasPorSala: number | null
   // Ventana horaria en que la pantalla debe refrescarse; ambas nulas = sin restricción
   // (refresco las 24 horas) — ver app/pages/pantallas/[codigo].vue.
   horaInicio: string | null
   horaFin: string | null
   salas: Sala[]
}

/* ── Forma que devuelve el endpoint público /api/pantallas/publico/[codigo] ──────────────
   Reservas EN CURSO y PRÓXIMAS A INICIAR hoy en las salas de la pantalla — no el horario
   completo. Incluye cualquier tipo de reserva pública (clases, reuniones, eventos, bloqueos
   manuales…), no solo sesiones de clases — ver `esClase`. Deliberadamente distinta (y más
   plana) que `Reserva` (app/types/reserva.ts): la pantalla pública no necesita ids de edición
   ni el detalle completo de sesión/persona. */
export interface ClasePantalla {
   id: number
   salaCodigo: string
   titulo: string
   // Nombre de la ayudantía (asignatura) cuando la reserva es una Ayudantía creada desde
   // /ayudantias, sin sesión de paralelo asociada — ver Reserva.subtitulo. Nulo en cualquier
   // otro caso.
   subtitulo: string | null
   // Si se lee como una clase (asignatura/carrera/profesor) o como una reserva genérica
   // (título/tipo/responsable) — mismo criterio que `esClase` en /reservas/horario: el tipo es
   // "Clase" o "Ayudantía", tenga o no sesión de paralelo asociada.
   esClase: boolean
   // Presentes solo si `esClase` y la reserva viene de una sesión de paralelo real.
   asignaturaCodigo: string | null
   // Ya resuelto en el backend: nombre corto de la asignatura si tiene uno definido, si no el
   // completo — mismo criterio que `nombreAsignaturaDe` en /reservas/horario.
   asignaturaNombre: string | null
   paraleloCodigo: string | null
   carreraNombre: string | null
   tipoReservaNombre: string
   tipoReservaColor: string
   inicio: string
   fin: string
   responsable: string | null
   cancelada: boolean
}

export interface DatosPantallaPublica {
   pantalla: {
      nombre: string
      codigo: string
      segundosPorSlide: number
      horaInicio: string | null
      horaFin: string | null
   }
   hoy: string | null
   enCurso: ClasePantalla[]
   proximas: ClasePantalla[]
}
