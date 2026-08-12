export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/salas/pantallas', 'ver')

   const pantallas = await prisma.pantallaPublica.findMany({
      orderBy: { nombre: 'asc' },
      include: { salas: { include: { sala: { include: { tipoSala: true } } }, orderBy: { salaCodigo: 'asc' } } },
   })

   return pantallas.map(({ salas, ...pantalla }) => ({
      ...pantalla,
      salas: salas.map((ps) => ps.sala),
   }))
})
