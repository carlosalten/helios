// Próxima posición libre al final de una columna del tablero de /planes/asignacion, para que
// una asignatura recién asignada o movida aparezca al final en vez de empatada en 0 con las
// que ya estaban ahí. Las electivas forman una única columna (el cuadro de Electivos) que no
// se agrupa por semestre; el resto se agrupa por (planId, semestre) como siempre.
export async function siguienteOrdenAsignaturaPlan(planId: number, semestre: number, esElectiva: boolean) {
   const maximo = await prisma.asignaturaPlan.aggregate({
      where: esElectiva ? { planId, esElectiva: true } : { planId, esElectiva: false, semestre },
      _max: { orden: true },
   })
   return (maximo._max.orden ?? -1) + 1
}
