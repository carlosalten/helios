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

// Asignatura que se MUESTRA para un paralelo: la equivalente desde la que se programó
// (Paralelo.asignaturaEquivalente) o, si no hay, la de la malla. Solo para mostrar (nombres,
// códigos, títulos de reserva); la lógica sigue con la asignatura de la malla. Las queries que
// la usan tienen que incluir `asignaturaEquivalente` junto a `asignaturaPlan.asignatura`.
export function asignaturaVisibleParalelo<A, E>(paralelo: {
   asignaturaEquivalente?: E | null
   asignaturaPlan: { asignatura: A }
}): A | E {
   return paralelo.asignaturaEquivalente ?? paralelo.asignaturaPlan.asignatura
}

// Paralelo.asignaturaEquivalenteId solo puede apuntar a una equivalente, en ese plan, de la
// asignatura de la malla bajo la que cuelga el paralelo (AsignaturaPlanEquivalente).
export async function validarAsignaturaEquivalente(asignaturaPlanId: number, equivalenteId: number) {
   const equivalencia = await prisma.asignaturaPlanEquivalente.findFirst({
      where: { asignaturaPlanId, asignaturaId: equivalenteId },
   })
   if (!equivalencia) {
      throw createError({ statusCode: 422, message: 'La asignatura elegida no es equivalente a la del plan' })
   }
}
