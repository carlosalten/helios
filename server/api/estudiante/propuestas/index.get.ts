// Propuestas del propio estudiante logueado, con su historial de estados (el más reciente
// primero, para que el frontend solo mire `estados[0]` como estado actual).
export default defineEventHandler(async (event) => {
   const estudiante = await requiereSesionEstudiante(event)

   const propuestas = await prisma.ttPropuesta.findMany({
      where: { estudianteEmail: estudiante.email },
      orderBy: { fecha: 'desc' },
      include: {
         rol: true,
         lineaInvestigacion: true,
         estados: { orderBy: { fechaHora: 'desc' } },
         comision: {
            where: { rol: ROL_COMISION_GUIA },
            include: { profesor: { select: { email: true, nombre: true, apellido: true } } },
         },
      },
   })

   // Si el proceso todavía no habilita mostrar el guía a sus estudiantes, no viaja el dato al
   // cliente — no basta con ocultarlo en el frontend (ver TtProceso.mostrarGuiaEstudiantes).
   if (!estudiante.proceso.mostrarGuiaEstudiantes) {
      return propuestas.map((p) => ({ ...p, comision: [] }))
   }
   return propuestas
})
