import type { ComputedRef, Ref } from 'vue'

export function usePaginacion<T>(items: Ref<T[]> | ComputedRef<T[]>, porPagina = 10) {
   const paginaActual = ref(1)

   watch(
      () => items.value.length,
      () => {
         paginaActual.value = 1
      },
   )

   const itemsPagina = computed(() => {
      const inicio = (paginaActual.value - 1) * porPagina
      return items.value.slice(inicio, inicio + porPagina)
   })

   return { paginaActual, itemsPagina, porPagina }
}
