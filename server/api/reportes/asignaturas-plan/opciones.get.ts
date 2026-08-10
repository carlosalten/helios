export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/reportes/asignaturas-plan', 'ver')

   return obtenerPlanesYSemestres()
})
