export default defineEventHandler(async (event) => {
   await requiereAlgunPermiso(event, [
      ['/titulaciones/grupos', 'ver'],
      ['/titulaciones/asignacion-guia', 'ver'],
   ])

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
               // Solo la propuesta más reciente (y de esa, solo su estado más reciente, rol y el
               // guía asignado si tiene): es lo único que necesitan la columna "Integrantes" de
               // /titulaciones/grupos y el tab de Feria de Software de /titulaciones/asignacion-guia.
               propuestas: {
                  orderBy: { fecha: 'desc' },
                  take: 1,
                  select: {
                     id: true,
                     rol: { select: { nombre: true } },
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
         const propuesta = propuestas[0]
         return {
            ...datos,
            propuestaId: propuesta?.id ?? null,
            rolNombre: propuesta?.rol?.nombre ?? null,
            estadoPropuesta: propuesta?.estados[0]?.estado ?? null,
            guia: propuesta?.comision[0]?.profesor ?? null,
         }
      }),
   }))
})
