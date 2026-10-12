import type { ComputedRef, Ref } from 'vue'
import { REGISTROS_POR_PAGINA_DEFECTO } from '~/types/preferencias'

// `porPagina` arranca en la preferencia del usuario (/cuenta/preferencias, en la sesión) y cada
// tabla la puede cambiar localmente con el selector de <PaginacionTabla> — ese cambio no se
// guarda, vale mientras la página esté abierta.
export function usePaginacion<T>(items: Ref<T[]> | ComputedRef<T[]>) {
   const { user } = useUserSession()
   const paginaActual = ref(1)
   const porPagina = ref(user.value?.registrosPorPagina ?? REGISTROS_POR_PAGINA_DEFECTO)

   watch([() => items.value.length, porPagina], () => {
      paginaActual.value = 1
   })

   const itemsPagina = computed(() => {
      const inicio = (paginaActual.value - 1) * porPagina.value
      return items.value.slice(inicio, inicio + porPagina.value)
   })

   return { paginaActual, itemsPagina, porPagina }
}
