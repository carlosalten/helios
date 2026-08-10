// Salas de las que el usuario logueado es encargado (ver EncargadoSala, administrable desde
// /salas/asignacion). Alimenta el panel de salas de /horario: cada quien solo arrastra a la
// matriz las salas que tiene a cargo, no el listado completo del departamento.
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/horario', 'ver')

   const persona = await prisma.persona.findUnique({ where: { email: usuario.email } })
   if (!persona) return []

   return prisma.sala.findMany({
      where: { encargados: { some: { personaId: persona.id } } },
      orderBy: { codigo: 'asc' },
      include: { tipoSala: true },
   })
})
