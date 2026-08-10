// Resumen que alimenta la portada (`/`). Lo arma server/api/dashboard.get.ts.

export type AlcanceFeriado = 'SOLO_CLASES' | 'TOTAL'

export interface EventoDia {
   inicio: string
   fin: string
   titulo: string
   detalle: string | null
   salaCodigo: string | null
   color: string | null
   esClase: boolean
}

export interface SalaOcupada {
   codigo: string
   ocupados: number
   total: number
}

export interface FeriadoProximo {
   fecha: string
   alcance: AlcanceFeriado
   // Ambos nulos = feriado de día completo; con valor = feriado parcial.
   horaInicio: string | null
   horaTermino: string | null
}

// Forma de la portada: 'global' son los indicadores de todo el sistema (solo Administrador),
// 'personal' los acota a las carreras y salas de la persona (el resto de los roles). Ver
// server/utils/alcanceDashboard.ts.
export type ModoDashboard = 'global' | 'personal'

// Una carrera del alcance del usuario, con el avance de su planificación en el semestre.
// Solo llega en modo personal.
export interface CarreraResumen {
   codigo: number
   nombre: string
   nombreCorto: string
   // La persona dirige esta carrera (Carrera.jefePersonaId), en vez de solo estar asignada.
   esJefe: boolean
   cursos: number
   paralelos: number
   clasesTotales: number
   clasesConSala: number
   clasesConProfesor: number
}

// Una sala a cargo del usuario (EncargadoSala), con su actividad de hoy. Solo en modo personal.
export interface SalaResumen {
   codigo: string
   tipoSala: string
   capacidad: number
   ocupadosHoy: number
   totalBloques: number
   clasesHoy: number
   reservasHoy: number
}

// Una clase que viene en alguna de las salas a cargo del usuario. Se calcula sobre las
// reservas (ya fechadas y sin feriados), no sobre la plantilla semanal de sesiones.
export interface ClaseProxima {
   fecha: string
   inicio: string
   fin: string
   salaCodigo: string
   asignaturaCodigo: string
   asignaturaNombre: string
   paraleloCodigo: string
   carrera: string
   carreraCorta: string
   // Nulo mientras la clase no tenga profesor asignado.
   profesor: string | null
   color: string | null
   // Ya empezó y todavía no termina (hoy, entre inicio y fin).
   enCurso: boolean
}

// Una reserva de sala que NO viene de una sesión de clases (ayudantía, reunión, evento…), en
// alguna de las salas a cargo del usuario.
export interface ReservaProxima {
   fecha: string
   inicio: string
   fin: string
   salaCodigo: string
   titulo: string
   tipo: string
   color: string | null
   // Nulo si la reserva no tiene responsable designado.
   responsable: string | null
   enCurso: boolean
}

export interface Dashboard {
   alcance: {
      modo: ModoDashboard
      // Solo el Administrador puede alternar entre la portada global y la personal.
      puedeCambiarModo: boolean
   }
   semestre: {
      id: number
      nombre: string
      fechaInicio: string
      fechaFin: string
      semanaActual: number
      totalSemanas: number
      enCurso: boolean
   } | null
   hoy: {
      fecha: string
      diaSemana: number
      feriado: { alcance: AlcanceFeriado; horaInicio: string | null; horaTermino: string | null } | null
      clases: number
      reservas: number
      // Cursos y profesores con clase hoy en las salas a cargo del usuario (EncargadoSala),
      // sin importar el modo: es información personal, igual que `proximasClases`.
      cursosConClase: number
      profesoresConClase: number
   }
   totales: {
      carreras: number
      paralelos: number
      salas: number
      personasActivas: number
   }
   // Nulo cuando no hay semestre vigente: no hay planificación que medir. El total de
   // paralelos (denominador de `paralelosCompletos`) vive en `totales.paralelos`.
   planificacion: {
      clasesTotales: number
      clasesConSala: number
      clasesConProfesor: number
      paralelosCompletos: number
      topesSala: number
      topesProfesor: number
   } | null
   miAgenda: EventoDia[]
   salasOcupadasHoy: SalaOcupada[]
   proximosFeriados: FeriadoProximo[]
   // Ambas vacías en modo global.
   misCarreras: CarreraResumen[]
   misSalas: SalaResumen[]
   // Ambas siempre acotadas a las salas a cargo del usuario, en los dos modos: es información
   // personal incluso en la portada global del Administrador.
   proximasClases: ClaseProxima[]
   proximasReservas: ReservaProxima[]
}
