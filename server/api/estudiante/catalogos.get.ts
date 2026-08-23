// Catálogos para el formulario de nueva propuesta (/estudiante/propuestas): roles y líneas de
// investigación. Solo activo:true en ambos — un rol o línea desactivados no deben poder elegirse
// en una propuesta nueva, aunque sigan existiendo en propuestas ya creadas.
export default defineEventHandler(async (event) => {
   await requiereSesionEstudiante(event)

   const [roles, lineasInvestigacion] = await Promise.all([
      prisma.ttRol.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
      prisma.ttLineaInvestigacion.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
   ])

   return { roles, lineasInvestigacion }
})
