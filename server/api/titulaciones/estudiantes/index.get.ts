// El hash de la contraseña nunca sale de acá: el omit global en server/utils/prisma.ts lo
// excluye por defecto de cualquier query sobre TtEstudiante.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/estudiantes', 'ver')

   const estudiantes = await prisma.ttEstudiante.findMany({
      orderBy: [{ apellidoPaterno: 'asc' }, { nombres: 'asc' }],
      include: {
         proceso: true,
         grupo: true,
         // Solo la propuesta más reciente (y de esa, solo su estado más reciente): es lo único
         // que necesita la columna "Propuesta" de /titulaciones/estudiantes.
         propuestas: {
            orderBy: { fecha: 'desc' },
            take: 1,
            select: { estados: { orderBy: { fechaHora: 'desc' }, take: 1, select: { estado: true } } },
         },
      },
   })

   return estudiantes.map((estudiante) => {
      const { propuestas, ...datos } = estudiante
      return { ...datos, estadoPropuesta: propuestas[0]?.estados[0]?.estado ?? null }
   })
})
