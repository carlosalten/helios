// La lista de bloques la consume tanto /bloques y /bloques/copiar (para administrarlos) como
// /horario, /horario/profesor, /reservas/horario y /reservas/imprimir (para dibujar la
// plantilla de horas de su matriz, de solo lectura). Basta con tener 'ver' en cualquiera de las
// seis — un Apoyo Docente con permiso en /reservas/horario pero no en /bloques también necesita
// esta plantilla para que la matriz no aparezca vacía.
export default defineEventHandler(async (event) => {
   await requiereAlgunPermiso(event, [
      ['/bloques', 'ver'],
      ['/bloques/copiar', 'ver'],
      ['/horario', 'ver'],
      ['/horario/profesor', 'ver'],
      ['/reservas/horario', 'ver'],
      ['/reservas/imprimir', 'ver'],
   ])

   const bloques = await prisma.bloque.findMany({
      orderBy: [{ semestreId: 'asc' }, { numero: 'asc' }],
      include: { semestre: true, protecciones: { select: { diaSemana: true } } },
   })

   return bloques.map(({ protecciones, ...bloque }) => ({
      ...bloque,
      diasProtegidos: protecciones.map((p) => p.diaSemana).sort((a, b) => a - b),
   }))
})
