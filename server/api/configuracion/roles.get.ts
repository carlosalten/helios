// Roles para la lista de "Profesores visibles en /horario" de /configuracion. A diferencia de
// GET /api/personas/roles (compartido por /personas/tipos y /personas/gestion), acá el gate es
// el permiso de esta misma página — un Jefe de Carrera con acceso a /configuracion no
// necesariamente tiene permiso en esas otras rutas.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/configuracion', 'ver')

   return prisma.rol.findMany({ orderBy: { nombre: 'asc' } })
})
