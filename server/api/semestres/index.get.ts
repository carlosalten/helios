// La lista de semestres la consume /semestres (para administrarlos) y, de solo lectura, un
// buen número de páginas que solo necesitan saber cuál es el vigente o dejar elegir uno:
// /horario, /horario/profesor, /horario/profesores, /cursos, /cursos/carga-masiva,
// /paralelos, /paralelos/asignacion, /feriados, /horario/salas-semanal, /reservas/imprimir, /bloques,
// /bloques/copiar y /ayudantias/resumen (exportar CSV). Basta con tener 'ver' en cualquiera de esas rutas — de lo contrario un rol
// con permiso en, por ejemplo, /horario/salas-semanal pero no en /semestres se queda sin poder
// elegir semestre y la página parece no tener nada configurado.
export default defineEventHandler(async (event) => {
   await requiereAlgunPermiso(event, [
      ['/semestres', 'ver'],
      ['/horario', 'ver'],
      ['/horario/profesor', 'ver'],
      ['/horario/profesores', 'ver'],
      ['/cursos', 'ver'],
      ['/cursos/carga-masiva', 'ver'],
      ['/paralelos', 'ver'],
      ['/paralelos/asignacion', 'ver'],
      ['/feriados', 'ver'],
      ['/horario/salas-semanal', 'ver'],
      ['/horario/salas-semestral', 'ver'],
      ['/reservas/imprimir', 'ver'],
      ['/bloques', 'ver'],
      ['/bloques/copiar', 'ver'],
      ['/ayudantias', 'ver'],
      ['/ayudantias/resumen', 'ver'],
   ])

   return prisma.semestre.findMany({ orderBy: { fechaInicio: 'desc' } })
})
