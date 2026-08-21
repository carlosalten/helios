// Alcance para MODIFICAR (editar/cancelar) una reserva ya existente. Reglas de negocio:
//  - Administrador: todas.
//  - Jefe de Carrera: todas también, sin importar a nombre de quién estén ni si son de clase
//    — coordina el horario completo de su carrera, no solo lo que él mismo agendó.
//  - Cualquier otra persona: las propias, salvo que sean de una clase (sesionParaleloId no
//    nulo) — esas las agenda/gestiona el horario de clases, no quien figura como responsable.
//  - Apoyo Docente: además, cualquier reserva en una sala de la que sea encargado
//    (EncargadoSala), sin importar si es propia o de clase.
type ReservaConAlcance = {
   personaId: number | null
   sesionParaleloId: number | null
   salaCodigo: string
}

export async function puedeModificarReserva(
   usuario: { email: string; rol: string },
   reserva: ReservaConAlcance
): Promise<boolean> {
   if (usuario.rol === 'Administrador' || usuario.rol === 'Jefe de Carrera') return true

   const persona = await prisma.persona.findUnique({ where: { email: usuario.email } })
   if (!persona) return false

   const esClase = reserva.sesionParaleloId != null
   if (!esClase && reserva.personaId === persona.id) return true

   if (usuario.rol === 'Apoyo Docente') {
      const encargado = await prisma.encargadoSala.findUnique({
         where: { personaId_salaCodigo: { personaId: persona.id, salaCodigo: reserva.salaCodigo } },
      })
      if (encargado) return true
   }

   return false
}

// Include mínimo necesario para que `puedeModificarReserva` evalúe el alcance — vacío por
// ahora (ya no necesita relaciones), pero se mantiene como punto de extensión único para los
// `findUnique` de los endpoints de edición/borrado.
export const incluirAlcanceReserva = {} as const
