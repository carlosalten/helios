<template>
  <div
    class="space-y-2 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
  >
    <USkeleton v-for="i in rows" :key="i" class="h-10 w-full" />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ rows?: number }>(), { rows: 3 })
</script>
