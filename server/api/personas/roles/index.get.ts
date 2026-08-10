// Lista de roles: la usan tanto /personas/tipos (para administrar los roles en sí) como
// /personas/gestion (para poblar el selector de "Cambiar rol"/"Crear persona"). Basta con
// tener 'ver' en cualquiera de las dos — un Jefe de Carrera con permiso en /personas/gestion
// pero no en /personas/tipos también necesita ver los nombres de rol, no solo su id.
export default defineEventHandler(async (event) => {
   await requiereAlgunPermiso(event, [
      ['/personas/tipos', 'ver'],
      ['/personas/gestion', 'ver'],
   ])

   return prisma.rol.findMany({ orderBy: { nombre: 'asc' } })
})
