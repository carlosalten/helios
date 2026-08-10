// Próxima posición libre al final de un curso en el tablero de /paralelos/asignacion,
// para que un paralelo recién creado o movido de curso aparezca al final en vez de
// empatado en 0 con los que ya estaban ahí.
export async function siguienteOrdenParalelo(cursoId: number) {
   const maximo = await prisma.paralelo.aggregate({
      where: { cursoId },
      _max: { orden: true },
   })
   return (maximo._max.orden ?? -1) + 1
}
