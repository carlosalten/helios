// Alcance para MODIFICAR (editar/cancelar) una reserva ya existente. Reglas de negocio:
//  - Administrador: todas.
//  - Cualquier persona: las propias, salvo que sean de una clase (sesionParaleloId no nulo)
//    — esas las agenda/gestiona el horario de clases, no quien figura como responsable.
//  - Jefe de Carrera: además, las reservas de clases (propias o no) de las carreras que dirige.
//  - Apoyo Docente: además, cualquier reserva en una sala de la que sea encargado
//    (EncargadoSala), sin importar si es propia o de clase.
type ReservaConAlcance = {
   personaId: number | null
   sesionParaleloId: number | null
   salaCodigo: string
   sesionParalelo: {
      paralelo: { asignaturaPlan: { plan: { carreraCodigo: number } } }
   } | null
}

export async function puedeModificarReserva(
   usuario: { email: string; rol: string },
   reserva: ReservaConAlcance
): Promise<boolean> {
   if (usuario.rol === 'Administrador') return true

   const persona = await prisma.persona.findUnique({ where: { email: usuario.email } })
   if (!persona) return false

   const esClase = reserva.sesionParaleloId != null
   if (!esClase && reserva.personaId === persona.id) return true

   if (usuario.rol === 'Jefe de Carrera' && esClase && reserva.sesionParalelo) {
      const carrerasJefe = await resolverCarrerasJefe(usuario.rol, usuario.email)
      if (carrerasJefe?.includes(reserva.sesionParalelo.paralelo.asignaturaPlan.plan.carreraCodigo)) return true
   }

   if (usuario.rol === 'Apoyo Docente') {
      const encargado = await prisma.encargadoSala.findUnique({
         where: { personaId_salaCodigo: { personaId: persona.id, salaCodigo: reserva.salaCodigo } },
      })
      if (encargado) return true
   }

   return false
}

// Include mínimo necesario para que `puedeModificarReserva` pueda evaluar el caso de Jefe de
// Carrera (carrera de la clase). Se usa en el `findUnique` de la reserva de cada endpoint de
// edición/borrado, antes de llamar a la función de arriba.
export const incluirAlcanceReserva = {
   sesionParalelo: {
      select: {
         paralelo: {
            select: { asignaturaPlan: { select: { plan: { select: { carreraCodigo: true } } } } },
         },
      },
   },
} as const
