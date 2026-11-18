// Asignatura que se MUESTRA para un paralelo: la equivalente desde la que se programó
// (Paralelo.asignaturaEquivalente) o, si no hay, la de la malla. La lógica de bloques requeridos
// y duplicados sigue usando la asignatura de la malla, que es bajo la que cuelga el paralelo; el
// reconocimiento de clases conjuntas (`claveClase`) sí usa esta. Mismo criterio que
// `asignaturaVisibleParalelo` en el servidor.
export function asignaturaVisible<A, E>(paralelo: {
   asignaturaEquivalente?: E | null
   asignaturaPlan: { asignatura: A }
}): A | E {
   return paralelo.asignaturaEquivalente ?? paralelo.asignaturaPlan.asignatura
}

// Clave de "misma clase" (clase conjunta registrada en más de un curso, incluso de carreras
// distintas) SIN la celda: asignatura visible + código de paralelo + profesor + sala (la misma, o
// ninguna de las dos con sala). Sin profesor la clase solo es igual a sí misma. Copia exacta de `claveClase` en
// server/utils/sesionesEspejo.ts (ver ahí la regla completa): mantener ambas iguales.
export function claveClase(
   paralelo: {
      id: number
      codigo: string
      asignaturaPlan: { asignatura: { codigo: string } }
      asignaturaEquivalente?: { codigo: string } | null
   },
   profesorId: number | null,
   salaCodigo: string | null
) {
   if (profesorId === null) return `paralelo-${paralelo.id}`
   // Sin sala: compatible solo con otra sesión también sin sala.
   return `conjunta|${asignaturaVisible(paralelo).codigo}|${paralelo.codigo}|${profesorId}|${salaCodigo || 'sin-sala'}`
}

// Un mismo curso no puede tener dos paralelos de la misma asignatura con el mismo código de
// paralelo (ej. dos paralelos "300" de EIN125-B en "1er año"). Usado por app/pages/paralelos/
// index.vue y app/pages/paralelos/asignacion.vue antes de crear/editar/mover un paralelo.
interface ParaleloComparable {
   id: number
   cursoId: number
   codigo: string
   asignaturaPlan: { asignatura: { codigo: string } }
}

export function existeParaleloDuplicado(
   paralelos: ParaleloComparable[],
   opciones: { cursoId: number; asignaturaCodigo: string; codigo: string; excluirId?: number }
): boolean {
   const codigo = normalizarTexto(opciones.codigo.trim())
   return paralelos.some(
      (p) =>
         p.id !== opciones.excluirId &&
         p.cursoId === opciones.cursoId &&
         p.asignaturaPlan.asignatura.codigo === opciones.asignaturaCodigo &&
         normalizarTexto(p.codigo.trim()) === codigo
   )
}
