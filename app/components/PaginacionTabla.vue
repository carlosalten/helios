<script setup lang="ts">
import { OPCIONES_REGISTROS_POR_PAGINA } from '~/types/preferencias'

// Pie de tabla: selector de registros por página + paginación. Va junto a `usePaginacion`:
//   <PaginacionTabla v-model:page="paginaActual" v-model:por-pagina="porPagina" :total="lista.length" />
// Se oculta entero si la lista cabe en la opción más chica (no hay nada que elegir), y la
// paginación sola si cabe en una página.
const props = defineProps<{ total: number }>()
const pagina = defineModel<number>('page', { required: true })
const porPagina = defineModel<number>('porPagina', { required: true })

const opciones = OPCIONES_REGISTROS_POR_PAGINA.map((n): { label: string; value: number } => ({
   label: String(n),
   value: n,
}))
const visible = computed(() => props.total > OPCIONES_REGISTROS_POR_PAGINA[0])
</script>

<template>
   <div v-if="visible" class="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <div class="flex items-center gap-2 text-sm text-usm-text-muted dark:text-slate-400">
         <span>Registros por página</span>
         <USelect v-model="porPagina" :items="opciones" value-key="value" size="sm" class="w-20" />
      </div>
      <UPagination v-if="total > porPagina" v-model:page="pagina" :total="total" :items-per-page="porPagina" />
   </div>
</template>
