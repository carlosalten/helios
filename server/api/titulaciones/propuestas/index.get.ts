// Todas las propuestas (de cualquier estudiante), con su estudiante y el historial de estados —
// para la página de revisión /titulaciones/propuestas. A diferencia de
// GET /api/estudiante/propuestas (que filtra por la sesión del propio estudiante), acá no hay
// filtro: cualquier rol con permiso 'ver' en esta ruta ve todas.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/propuestas', 'ver')

   return prisma.ttPropuesta.findMany({
      orderBy: { fecha: 'desc' },
      include: {
         estudiante: {
            select: { email: true, run: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true },
         },
         rol: true,
         lineaInvestigacion: true,
         estados: { orderBy: { fechaHora: 'desc' } },
      },
   })
})
