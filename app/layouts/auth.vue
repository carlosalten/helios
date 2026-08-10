<template>
    <div
        class="relative min-h-screen bg-usm-light dark:bg-slate-950 text-usm-text dark:text-slate-100 transition-colors duration-300">
        <div class="fixed top-4 right-4 z-50">
            <UButton :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'" variant="ghost" color="neutral" size="sm"
                :aria-label="isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'" @click="toggleTheme" />
        </div>
        <slot />
    </div>
</template>

<script setup lang="ts">
const colorMode = useColorMode()

const isDark = computed(() => colorMode.value === 'dark')

function toggleTheme() {
    colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>
