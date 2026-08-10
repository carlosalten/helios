<script setup lang="ts">
// Aviso de que otro usuario cambió datos que esta página ya tenía cargados, junto al botón
// para recargarlos.
//
// A diferencia de /horario (que se refresca solo), acá el usuario decide cuándo: estas
// páginas se leen y se comparan, y recargar sin avisar haría saltar la tabla o vaciar el
// panel de detalle que tenga abierto.
const props = defineProps<{
   // Hay cambios de otras personas que esta página todavía no cargó.
   hayCambios: boolean
   // Recarga en curso (deshabilita el botón y muestra el spinner).
   cargando?: boolean
   // Quiénes hicieron esos cambios, para nombrarlos en el aviso.
   autores?: string[]
}>()

const emit = defineEmits<{ actualizar: [] }>()

const textoAviso = computed(() => {
   const autores = props.autores ?? []
   if (autores.length === 1) return `${autores[0]} hizo cambios`
   if (autores.length > 1) return `${autores.length} personas hicieron cambios`
   return 'Hay cambios sin cargar'
})
</script>

<template>
   <div class="flex items-center gap-2">
      <UTooltip v-if="hayCambios" text="Los datos en pantalla quedaron desactualizados">
         <UBadge color="warning" variant="subtle">
            <UIcon name="i-lucide-bell-dot" class="me-1 size-3.5 shrink-0" />
            {{ textoAviso }}
         </UBadge>
      </UTooltip>
      <UButton
         icon="i-lucide-refresh-cw"
         :color="hayCambios ? 'warning' : 'neutral'"
         :variant="hayCambios ? 'solid' : 'ghost'"
         :loading="cargando"
         aria-label="Actualizar"
         @click="emit('actualizar')"
      >
         Actualizar
      </UButton>
   </div>
</template>
