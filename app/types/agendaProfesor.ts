// Un bloque de la agenda semanal de un profesor (/horario/profesor). Unifica en una sola forma
// las dos cosas que le ocupan tiempo: sus clases y sus reservas de sala.
//
// Las horas vienen ya como 'HH:MM' y la fecha como 'YYYY-MM-DD' (no como ISO completo, que es
// lo que devuelve Prisma para @db.Time/@db.Date) para que la vista no tenga que recortar
// strings ni preocuparse por husos horarios.
export interface EventoAgenda {
   // Único dentro de la semana. Las clases sin sala no tienen fila propia en la BD, así que su
   // id combina la sesión con la fecha proyectada.
   id: string
   fecha: string
   inicio: string
   fin: string
   titulo: string
   // 'clase': viene de una sesión de clases (con o sin sala). 'reserva': reserva de sala suelta.
   tipo: 'clase' | 'reserva'
   salaCodigo: string | null
   color: string | null
   asignatura: string | null
   carreraCorta: string | null
   paraleloCodigo: string | null
   cursoNombre: string | null
   tipoReserva: string | null
}
