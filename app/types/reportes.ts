import type { Plan } from '~/types/plan'
import type { Semestre } from '~/types/semestre'

export interface OpcionesReporte {
   planes: Plan[]
   semestres: Semestre[]
}

/* ── /reportes/asignaturas-plan ─────────────────────────────────────────── */
export interface SesionReporte {
   diaSemana: number
   salaCodigo: string | null
   profesor: { id: number; nombre: string; apellido: string } | null
   // Un tramo puede fusionar varios bloques contiguos (misma sala/profesor, sin huecos) en uno
   // solo — ver fusionarTramosContiguos en el endpoint. Igual a bloqueNumeroInicio/horaInicio
   // cuando el tramo es de un solo bloque. No distingue teoría de práctica.
   bloqueNumeroInicio: number | null
   bloqueNumeroFin: number | null
   horaInicio: string | null
   horaFin: string | null
}

export interface ParaleloReporte {
   paraleloId: number
   codigo: string
   cursoNombre: string
   sesiones: SesionReporte[]
}

export interface AsignaturaReporte {
   asignaturaId: number
   codigo: string
   nombre: string
   semestre: number
   esElectiva: boolean
   cantidadParalelos: number
   paralelos: ParaleloReporte[]
}
