<template>
  <div
    class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 py-16 text-center"
  >
    <UIcon :name="icon" class="mb-3 size-10 text-gray-300 dark:text-slate-600" />
    <p class="text-sm text-usm-gray dark:text-slate-400">{{ message }}</p>
    <UButton v-if="action" :label="action" size="sm" class="mt-4" @click="$emit('action')" />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  message: string
  action?: string
}>()

defineEmits<{
  action: []
}>()
</script>
