import type { Bloque } from '~/types/bloque'

export type TipoSesion = 'TEORIA' | 'PRACTICA'

export interface SesionParalelo {
   id: number
   paraleloId: number
   diaSemana: number
   tipo: TipoSesion
   salaCodigo: string | null
   profesorId: number | null
   bloqueId: number | null
   bloque: Bloque | null
   paralelo: {
      id: number
      codigo: string
      cursoId: number
      cupo: number
      color: string | null
      curso: { id: number; nombre: string }
      asignaturaPlan: {
         asignatura: { id: number; codigo: string; nombre: string; bloquesTeoria: number; bloquesPractica: number }
         plan: { carrera: { codigo: number; nombre: string } }
         // Si la asignatura queda exenta de las advertencias de topes de horario en este plan
         // (/configuracion) — ver `conflictosSala`/`conflictosProfesor` en /horario.
         exentaTope: boolean
      }
   }
   sala: { codigo: string; capacidad: number } | null
   profesor: { id: number; nombre: string; apellido: string } | null
}
