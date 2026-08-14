// Catálogos para el formulario de nueva propuesta (/estudiante/propuestas): roles y líneas de
// investigación. Solo activo:true en roles — un rol desactivado no debe poder elegirse en una
// propuesta nueva, aunque siga existiendo en propuestas ya creadas.
export default defineEventHandler(async (event) => {
   await requiereSesionEstudiante(event)

   const [roles, lineasInvestigacion] = await Promise.all([
      prisma.ttRol.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
      prisma.ttLineaInvestigacion.findMany({ orderBy: { nombre: 'asc' } }),
   ])

   return { roles, lineasInvestigacion }
})
