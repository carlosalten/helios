<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { user, fetch: fetchSession } = useUserSession()
const route = useRoute()
const colorMode = useColorMode()
const sidebarOpen = ref(false)

const { isLoading: navegando } = useLoadingIndicator()

const isDark = computed(() => colorMode.value === 'dark')
function toggleTheme() {
   colorMode.preference = isDark.value ? 'light' : 'dark'
}

// Navbar reducido del portal de estudiantes: a diferencia de app/layouts/default.vue, no hay
// permisos que filtrar (TtEstudiante no tiene rol ni fila en `permiso`) — es la misma lista
// fija para cualquier estudiante logueado.
const navItems: NavigationMenuItem[][] = [
   [
      { to: '/estudiante', icon: 'i-lucide-house', label: 'Inicio' },
      { to: '/estudiante/propuestas', icon: 'i-lucide-file-text', label: 'Propuestas de TT' },
   ],
]

// Cambiar contraseña va aparte, anclado al fondo (mismo criterio que `navItemsPreferencias`
// en default.vue): es autoservicio de la cuenta, no una sección de contenido.
const navItemsCuenta: NavigationMenuItem[][] = [
   [{ to: '/estudiante/contrasena', icon: 'i-lucide-key-round', label: 'Cambiar contraseña' }],
]

const nombreCompleto = computed(() => `${user.value?.nombres ?? ''} ${user.value?.apellidoPaterno ?? ''}`.trim())
const initials = computed(() => {
   const n = user.value?.nombres?.[0] ?? ''
   const a = user.value?.apellidoPaterno?.[0] ?? ''
   return `${n}${a}`.toUpperCase() || 'ES'
})

async function logout() {
   await $fetch('/api/auth/logout', { method: 'POST' })
   // Ver comentario equivalente en app/layouts/default.vue.
   await fetchSession()
   await navigateTo('/estudiante/login')
}

const pageTitles: Record<string, string> = {
   '/estudiante': 'Inicio',
   '/estudiante/propuestas': 'Propuestas de TT',
   '/estudiante/contrasena': 'Cambiar contraseña',
}
// '/estudiante/propuestas/[id]' no tiene entrada fija en pageTitles (el id es dinámico).
const esDetallePropuesta = computed(
   () => route.path.startsWith('/estudiante/propuestas/') && route.path !== '/estudiante/propuestas'
)
const pageTitle = computed(() => {
   if (esDetallePropuesta.value) return 'Detalle de la propuesta'
   return pageTitles[route.path] ?? 'Portal de Estudiantes'
})

useHead({ title: computed(() => `HELIOS - ${pageTitle.value}`) })

const pageIcons: Record<string, string> = {
   '/estudiante': 'i-lucide-house',
   '/estudiante/propuestas': 'i-lucide-file-text',
   '/estudiante/contrasena': 'i-lucide-key-round',
}
const pageIcon = computed(() => {
   if (esDetallePropuesta.value) return 'i-lucide-file-text'
   return pageIcons[route.path] ?? 'i-lucide-layout-dashboard'
})
</script>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
   transition: opacity 0.2s ease;
}

.overlay-enter-from,
.overlay-leave-to {
   opacity: 0;
}
</style>

<template>
   <div
      class="flex min-h-screen bg-usm-light text-usm-text transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100"
   >
      <!-- Mobile overlay -->
      <Transition name="overlay">
         <div v-if="sidebarOpen" class="fixed inset-0 z-20 bg-black/50 lg:hidden" @click="sidebarOpen = false" />
      </Transition>

      <!-- Sidebar -->
      <aside
         class="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900"
         :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
      >
         <!-- Brand -->
         <div class="flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 px-4 dark:border-slate-800">
            <div class="flex size-12 shrink-0 items-center justify-center rounded-lg">
               <NuxtImg src="/images/isotipo-usm.png" format="webp" quality="80" alt="UTFSM" />
            </div>
            <div class="min-w-0 leading-tight">
               <p class="truncate text-sm font-bold text-usm-text dark:text-white">HELIOS</p>
               <p class="truncate text-xs text-usm-gray dark:text-slate-400">Portal Estudiante</p>
            </div>
            <UButton
               icon="i-lucide-x"
               variant="ghost"
               color="neutral"
               size="sm"
               class="ml-auto lg:hidden"
               aria-label="Cerrar menú"
               @click="
                  () => {
                     sidebarOpen = false
                  }
               "
            />
         </div>

         <!-- Nav -->
         <UNavigationMenu orientation="vertical" :items="navItems" class="flex-1 overflow-y-auto p-3" />

         <!-- Cuenta: separado del contenido, anclado al fondo (el flex-1 de arriba lo empuja). -->
         <UNavigationMenu
            orientation="vertical"
            :items="navItemsCuenta"
            class="shrink-0 border-t border-gray-200 p-3 dark:border-slate-800"
         />

         <!-- Sidebar footer -->
         <div class="shrink-0 border-t border-gray-200 p-3 dark:border-slate-800">
            <div class="flex items-center gap-3 rounded-xl px-3 py-2.5">
               <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-full bg-usm-blue text-xs font-bold text-white"
               >
                  {{ initials }}
               </div>
               <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-usm-text dark:text-white">{{ nombreCompleto }}</p>
                  <p class="truncate text-xs text-usm-gray dark:text-slate-400">Estudiante</p>
               </div>
               <UTooltip text="Cerrar sesión">
                  <UButton
                     icon="i-lucide-log-out"
                     variant="ghost"
                     color="neutral"
                     size="sm"
                     aria-label="Cerrar sesión"
                     @click="logout"
                  />
               </UTooltip>
            </div>
         </div>
      </aside>

      <!-- Content area -->
      <div class="flex min-w-0 flex-1 flex-col lg:pl-64">
         <!-- Topbar: mismo encabezado que app/layouts/default.vue (icono + título de la página
              + toggle de tema), sin las particularidades de staff (colapsar sidebar, etc.). -->
         <header
            class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-6"
         >
            <UButton
               icon="i-lucide-menu"
               variant="ghost"
               color="neutral"
               size="sm"
               class="lg:hidden"
               @click="
                  () => {
                     sidebarOpen = true
                  }
               "
            />
            <UIcon :name="pageIcon" class="size-5 shrink-0" />
            <h1 class="flex-1 truncate text-base font-semibold text-usm-text dark:text-white">
               {{ pageTitle }}
            </h1>
            <UButton
               :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
               variant="ghost"
               color="neutral"
               size="sm"
               :aria-label="isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
               @click="toggleTheme"
            />
         </header>

         <!-- Page -->
         <main class="relative flex-1 p-4 sm:p-6 lg:p-8">
            <slot />

            <Transition name="overlay">
               <div
                  v-if="navegando"
                  class="absolute inset-0 z-10 bg-usm-light/70 dark:bg-slate-950/70"
                  role="status"
                  aria-live="polite"
               >
                  <div class="sticky top-24 flex justify-center">
                     <span
                        class="inline-flex items-center gap-2 rounded-full border border-default bg-default px-4 py-2 text-sm font-medium text-usm-text shadow-lg dark:text-white"
                     >
                        <UIcon
                           name="i-lucide-loader-circle"
                           class="size-4 animate-spin text-usm-blue dark:text-usm-cyan"
                        />
                        Cargando…
                     </span>
                  </div>
               </div>
            </Transition>
         </main>

         <footer class="shrink-0 border-t border-gray-200 px-4 py-3 dark:border-slate-800 sm:px-6">
            <p class="text-center text-xs text-usm-gray dark:text-slate-500">
               Desarrollado por Departamento Electrotecnia e Informática ELINF
            </p>
         </footer>
      </div>
   </div>
</template>
