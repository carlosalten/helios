<script setup lang="ts">
definePageMeta({ layout: 'estudiante' })

const { user } = useUserSession()
</script>

<template>
   <div class="space-y-6">
      <div class="rounded-2xl border border-default bg-default p-6">
         <h2 class="text-lg font-semibold text-usm-text dark:text-white">Hola, {{ user?.nombres }}</h2>
         <p class="mt-1 text-sm text-usm-text-muted dark:text-slate-400">
            Bienvenido al portal de estudiantes de trabajo de título.
         </p>
      </div>

      <NuxtLink
         to="/estudiante/propuestas"
         class="flex items-center gap-4 rounded-2xl border border-default bg-default p-6 transition-colors hover:bg-elevated"
      >
         <div
            class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-usm-blue/10 text-usm-blue dark:bg-usm-cyan/10 dark:text-usm-cyan"
         >
            <UIcon name="i-lucide-file-text" class="size-6" />
         </div>
         <div class="min-w-0 flex-1">
            <p class="font-medium text-usm-text dark:text-white">Propuestas de TT</p>
            <p class="text-sm text-usm-text-muted dark:text-slate-400">Revisa el estado de tu propuesta de título.</p>
         </div>
         <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-usm-text-muted dark:text-slate-400" />
      </NuxtLink>
   </div>
</template>
