// Todas las propuestas (de cualquier estudiante), con su estudiante y el historial de estados —
// para la página de revisión /titulaciones/propuestas, /titulaciones/asignacion-guia (agrupa por
// equipo vía `estudiante.grupo` y lee el guía ya asignado vía `comision`) y /titulaciones/guiados
// (agrupa por guía asignado). A diferencia de GET /api/estudiante/propuestas (que filtra por la
// sesión del propio estudiante), acá no hay filtro: cualquier rol con permiso 'ver' en cualquiera
// de las tres rutas ve todas.
export default defineEventHandler(async (event) => {
   await requiereAlgunPermiso(event, [
      ['/titulaciones/propuestas', 'ver'],
      ['/titulaciones/asignacion-guia', 'ver'],
      ['/titulaciones/guiados', 'ver'],
   ])

   return prisma.ttPropuesta.findMany({
      orderBy: { fecha: 'desc' },
      include: {
         estudiante: {
            select: {
               email: true,
               run: true,
               nombres: true,
               apellidoPaterno: true,
               apellidoMaterno: true,
               procesoId: true,
               grupoId: true,
               grupo: { select: { id: true, nombre: true, numero: true, subtitulo: true } },
            },
         },
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
