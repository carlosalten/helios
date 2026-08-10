import type { EventoHorario } from '~/types/horarioEvento'

// Bus de eventos en memoria para avisar, en tiempo real, que el horario cambió. Lo publica
// cada endpoint que muta el horario y lo consume el stream SSE de
// `server/api/horario/eventos.get.ts`.
//
// Alcance: este bus vive dentro del proceso Nitro. Si algún día la app se despliega con
// más de una instancia o worker, cada una tendría su propio bus y un usuario solo vería
// los cambios hechos contra su misma instancia; en ese caso hay que reemplazarlo por un
// canal compartido (Redis pub/sub o LISTEN/NOTIFY de PostgreSQL). Hoy corre en un único
// proceso, así que alcanza.

type Suscriptor = (evento: EventoHorario) => void

const suscriptores = new Set<Suscriptor>()

export function suscribirHorario(suscriptor: Suscriptor) {
   suscriptores.add(suscriptor)
   return () => {
      suscriptores.delete(suscriptor)
   }
}

export function publicarEventoHorario(evento: EventoHorario) {
   for (const suscriptor of suscriptores) {
      // Un suscriptor con el stream ya cerrado no debe cortar el aviso al resto.
      try {
         suscriptor(evento)
      } catch {
         suscriptores.delete(suscriptor)
      }
   }
}

// Atajo para los endpoints de /reservas/horario. Una reserva se ubica por sala y fecha, no
// cuelga de un semestre ni de un curso: por eso ambos van en `null` y el aviso le llega a
// todos los clientes, tengan el semestre que tengan en pantalla.
export function publicarEventoReserva(
   usuario: { email: string; nombre: string; apellido: string },
   accion: EventoHorario['accion'],
   salaCodigo: string
) {
   publicarEventoHorario({
      tipo: 'reserva',
      accion,
      semestreId: null,
      cursoId: null,
      descripcion: `Sala ${salaCodigo}`,
      autorEmail: usuario.email,
      autorNombre: `${usuario.nombre} ${usuario.apellido}`,
   })
}
