// Normaliza texto para comparaciones de búsqueda: minúsculas y sin tildes/diacríticos,
// para que "Di" o "Dí" encuentren "Díaz" sin importar mayúsculas ni acentos.
export function normalizarTexto(texto: string): string {
   return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
