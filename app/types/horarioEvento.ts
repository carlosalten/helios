// Aviso de que algo que la página de horario muestra cambió, emitido por el stream SSE
// `/api/horario/eventos`. No lleva los datos del cambio: cada cliente vuelve a pedir sus
// propios endpoints, así el alcance por carrera se sigue aplicando en el servidor.
export interface EventoHorario {
   // Qué cambió: una sesión de clases, un paralelo (código, color, cupo), los recursos de
   // los paneles laterales (salas y profesores, que se arrastran sobre la matriz) o una
   // reserva de sala de /reservas/horario.
   //
   // Ojo con 'sesion': asignarle sala a una sesión genera además su reserva recurrente (ver
   // server/utils/reservasSesion.ts), así que /reservas/horario también tiene que reaccionar
   // a ese tipo, no solo a 'reserva'. A la inversa, una reserva suelta no altera la matriz de
   // clases y /horario ignora los eventos 'reserva'.
   tipo: 'sesion' | 'paralelo' | 'sala' | 'profesor' | 'reserva'
   accion: 'crear' | 'editar' | 'mover' | 'borrar'
   // Sesiones y paralelos cuelgan de un curso dentro de un semestre. Salas, profesores y
   // reservas son globales del departamento (una reserva se ubica por sala y fecha, no por
   // semestre): van en `null` y le importan a todos los clientes, sea cual sea el semestre
   // que tengan en pantalla.
   semestreId: number | null
   cursoId: number | null
   // Qué se tocó, solo para el aviso que ve el usuario: nombre del curso, código de la sala
   // o nombre del profesor.
   descripcion: string
   autorEmail: string
   autorNombre: string
}
