// Códigos de sala de las que el usuario logueado es encargado (EncargadoSala). Lo usa
// /reservas/horario para saber, sin volver a llamar al servidor por cada reserva, si el rol
// Apoyo Docente puede modificar una reserva ajena por estar en una sala a su cargo (ver
// server/utils/alcanceReservas.ts, misma regla aplicada del lado del servidor).
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/reservas/horario', 'ver')

   const persona = await prisma.persona.findUnique({ where: { email: usuario.email } })
   if (!persona) return []

   const encargos = await prisma.encargadoSala.findMany({
      where: { personaId: persona.id },
      select: { salaCodigo: true },
   })
   return encargos.map((e) => e.salaCodigo)
})
