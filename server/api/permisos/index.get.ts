export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/permisos', 'ver')

   return prisma.permiso.findMany({ orderBy: [{ rol: 'asc' }, { ruta: 'asc' }, { accion: 'asc' }] })
})
