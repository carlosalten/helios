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
