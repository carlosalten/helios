export default defineEventHandler(async (event) => {
   await requiereAlgunPermiso(event, [
      ['/titulaciones/profesores', 'ver'],
      ['/titulaciones/asignacion-guia', 'ver'],
      ['/titulaciones/guiados', 'ver'],
   ])

   return prisma.ttProfesor.findMany({ orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }] })
})
