export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/feriados', 'ver')

   return prisma.feriado.findMany({
      orderBy: [{ semestreId: 'asc' }, { fecha: 'asc' }],
      include: { semestre: true },
   })
})
