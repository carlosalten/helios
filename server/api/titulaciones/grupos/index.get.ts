export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/grupos', 'ver')

   const grupos = await prisma.ttGrupo.findMany({
      orderBy: { nombre: 'asc' },
      include: {
         proceso: true,
         estudiantes: {
            orderBy: { nombres: 'asc' },
            select: {
               email: true,
               run: true,
               nombres: true,
               apellidoPaterno: true,
               apellidoMaterno: true,
               // Solo la propuesta más reciente (y de esa, solo su estado más reciente y el guía
               // asignado si tiene): es lo único que necesitan las columnas "Integrantes" y "Guía
               // asignado" de /titulaciones/grupos.
               propuestas: {
                  orderBy: { fecha: 'desc' },
                  take: 1,
                  select: {
                     estados: { orderBy: { fechaHora: 'desc' }, take: 1, select: { estado: true } },
                     comision: {
                        where: { rol: ROL_COMISION_GUIA },
                        select: { profesor: { select: { email: true, nombre: true, apellido: true } } },
                     },
                  },
               },
            },
         },
      },
   })

   return grupos.map((grupo) => ({
      ...grupo,
      estudiantes: grupo.estudiantes.map((estudiante) => {
         const { propuestas, ...datos } = estudiante
         return {
            ...datos,
            estadoPropuesta: propuestas[0]?.estados[0]?.estado ?? null,
            guia: propuestas[0]?.comision[0]?.profesor ?? null,
         }
      }),
   }))
})
