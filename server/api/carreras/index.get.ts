// A diferencia de otras rutas de horario, /carreras (listado) no se restringe por
// carrerasPermitidas: con permiso 'ver' se ven todas las carreras, aunque el rol sea
// 'Jefe de Carrera'. El alcance por carrera sigue aplicando al editar/gestionar.
//
// La lista la consume /carreras y /carreras/asignacion (para administrarlas), /planes (para
// elegir la carrera de un plan) y, de solo lectura, /horario (para poder ver el horario de
// cualquier carrera, no solo la propia — un Apoyo Docente con permiso en /horario pero no en
// /carreras necesita este listado igual). Basta con tener 'ver' en cualquiera de las cuatro.
export default defineEventHandler(async (event) => {
   await requiereAlgunPermiso(event, [
      ['/carreras', 'ver'],
      ['/carreras/asignacion', 'ver'],
      ['/planes', 'ver'],
      ['/horario', 'ver'],
      ['/ayudantias', 'ver'],
   ])

   return prisma.carrera.findMany({
      orderBy: { nombre: 'asc' },
      include: { jefe: { include: { rol: true } } },
   })
})
