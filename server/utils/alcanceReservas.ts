// Alcance para MODIFICAR (editar/borrar) una reserva ya existente — también la base del alcance
// para suspender (ver `puedeSuspenderReserva` más abajo, que lo amplía para los roles marcados
// con `Rol.suspenderCualquierReserva`). Reglas de negocio:
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

// Alcance para SUSPENDER una reserva ajena — más amplio que `puedeModificarReserva` para los
// roles marcados con `Rol.suspenderCualquierReserva` (administrable desde /configuracion): esos
// roles pueden suspender/reactivar cualquier reserva, aunque no puedan editarla ni borrarla.
// Para el resto de roles el alcance es exactamente el mismo que editar/borrar.
export async function puedeSuspenderReserva(
   usuario: { email: string; rol: string },
   reserva: ReservaConAlcance
): Promise<boolean> {
   if (usuario.rol === 'Administrador') return true
   const rol = await prisma.rol.findFirst({ where: { nombre: usuario.rol } })
   if (rol?.suspenderCualquierReserva) return true
   return puedeModificarReserva(usuario, reserva)
}

// Include mínimo necesario para que `puedeModificarReserva`/`puedeSuspenderReserva` evalúen el
// alcance — vacío por ahora (ya no necesita relaciones), pero se mantiene como punto de
// extensión único para los `findUnique` de los endpoints de edición/borrado/suspensión.
export const incluirAlcanceReserva = {} as const
