<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

defineProps<{
   title: string
   confirmLabel: string
   confirmColor?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
   confirmIcon?: string
   loading?: boolean
}>()

defineEmits<{ confirm: [] }>()
</script>

<template>
   <UModal v-model:open="open" :title="title" :ui="{ footer: 'justify-end' }">
      <template #body>
         <slot />
      </template>
      <template #footer>
         <div class="flex gap-3">
            <UButton type="button" color="neutral" variant="outline" :disabled="loading" @click="() => { open = false }">
               Cancelar
            </UButton>
            <UButton type="button" :icon="confirmIcon" :color="confirmColor ?? 'primary'" :loading="loading"
               @click="$emit('confirm')">
               {{ confirmLabel }}
            </UButton>
         </div>
      </template>
   </UModal>
</template>
