// Propuestas del propio estudiante logueado, con su historial de estados (el más reciente
// primero, para que el frontend solo mire `estados[0]` como estado actual).
export default defineEventHandler(async (event) => {
   const estudiante = await requiereSesionEstudiante(event)

   return prisma.ttPropuesta.findMany({
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
})
