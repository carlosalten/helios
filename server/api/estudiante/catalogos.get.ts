// Catálogos para el formulario de nueva propuesta (/estudiante/propuestas): roles y líneas de
// investigación. Solo activo:true en ambos — un rol o línea desactivados no deben poder elegirse
// en una propuesta nueva, aunque sigan existiendo en propuestas ya creadas.
// También trae `mostrarGuia` (TtProceso.mostrarGuiaEstudiantes del proceso del propio
// estudiante): se reaprovecha este fetch, que ya hacen ambas páginas de /estudiante/propuestas,
// en vez de agregar un endpoint aparte solo para ese dato.
export default defineEventHandler(async (event) => {
   const estudiante = await requiereSesionEstudiante(event)

   const [roles, lineasInvestigacion] = await Promise.all([
      prisma.ttRol.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
      prisma.ttLineaInvestigacion.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
   ])

   return { roles, lineasInvestigacion, mostrarGuia: estudiante.proceso.mostrarGuiaEstudiantes }
})
