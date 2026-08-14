// El hash de la contraseña nunca sale de acá: el omit global en server/utils/prisma.ts lo
// excluye por defecto de cualquier query sobre TtEstudiante.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/estudiantes', 'ver')

   return prisma.ttEstudiante.findMany({
      orderBy: [{ apellidoPaterno: 'asc' }, { nombres: 'asc' }],
      include: { proceso: true, grupo: true },
   })
})
