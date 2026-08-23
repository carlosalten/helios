// Todos los estudiantes (de cualquier proceso), para el buscador "agregar integrante" del
// slideover de /titulaciones/grupos — el frontend filtra al proceso del grupo seleccionado.
// Gateado con el permiso de esta misma ruta (no `/titulaciones/estudiantes`, que es un permiso
// aparte) para no exigirle al usuario un segundo permiso solo por buscar a quién agregar.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/grupos', 'ver')

   return prisma.ttEstudiante.findMany({
      orderBy: [{ apellidoPaterno: 'asc' }, { nombres: 'asc' }],
      select: {
         email: true,
         run: true,
         nombres: true,
         apellidoPaterno: true,
         apellidoMaterno: true,
         procesoId: true,
         grupoId: true,
         grupo: { select: { nombre: true } },
      },
   })
})
