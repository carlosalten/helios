export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/profesores', 'ver')

   return prisma.ttProfesor.findMany({ orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }] })
})
