// Catálogos para el formulario de edición de una propuesta desde /titulaciones/propuestas: roles
// y líneas de investigación. A diferencia de GET /api/estudiante/catalogos (gate de sesión de
// estudiante), acá el gate es el permiso 'ver' de esta misma ruta — evita depender de que la
// jefatura tenga además permiso en /titulaciones/roles o /titulaciones/lineas-investigacion, que
// son rutas de administración de catálogos, no de revisión de propuestas.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/propuestas', 'ver')

   const [roles, lineasInvestigacion] = await Promise.all([
      prisma.ttRol.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
      prisma.ttLineaInvestigacion.findMany({ orderBy: { nombre: 'asc' } }),
   ])

   return { roles, lineasInvestigacion }
})
