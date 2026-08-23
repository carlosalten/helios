<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { user, fetch: fetchSession } = useUserSession()
const route = useRoute()
const colorMode = useColorMode()
const sidebarOpen = ref(false)
const collapsed = ref(false)

// Estado de carga de la navegación (el mismo que alimenta la barra de progreso de `app.vue`):
// las páginas hacen `await useFetch(...)` en su `<script setup>`, así que Nuxt suspende la
// navegación y deja la página anterior en pantalla mientras llegan los datos. Además de la
// barra superior, el área de contenido se atenúa y muestra un spinner para que ese lapso se
// lea como "cargando" y no como un click perdido. `useLoadingIndicator` ya viene con throttle,
// así que una navegación instantánea no alcanza a mostrar nada.
const { isLoading: navegando } = useLoadingIndicator()

const isDark = computed(() => colorMode.value === 'dark')
function toggleTheme() {
   colorMode.preference = isDark.value ? 'light' : 'dark'
}

// Aplica una sola vez, al montar el layout (no en cada navegación: el layout no se remonta
// entre páginas), la preferencia de theme guardada en la cuenta — así sigue a la persona a un
// dispositivo nuevo. Después de esto manda lo que la persona toque acá o en /cuenta/preferencias,
// sin que este efecto vuelva a pisarlo.
onMounted(() => {
   if (user.value?.temaPreferido) colorMode.preference = user.value.temaPreferido === 'OSCURO' ? 'dark' : 'light'
})

type NavChild = { to: string; label: string }
type NavItem = { to: string; icon: string; label: string; children?: NavChild[] }

// El menú va agrupado por temas: cada grupo es un array y UNavigationMenu (vertical) dibuja
// solo un separador entre grupo y grupo. El orden dentro de cada grupo es el definido a mano
// —no alfabético—, porque sigue el flujo de trabajo: primero se define la oferta académica,
// luego el calendario, después se arma el horario y al final la administración.
const gruposNav: NavItem[][] = [
   [{ to: '/', icon: 'i-lucide-house', label: 'Inicio' }],
   [
      {
         to: '/carreras',
         icon: 'i-lucide-graduation-cap',
         label: 'Carreras',
         children: [
            { to: '/carreras', label: 'Gestión de carreras' },
            { to: '/carreras/asignacion', label: 'Asignación de personas' },
         ],
      },
      {
         to: '/asignaturas',
         icon: 'i-lucide-layers',
         label: 'Asignaturas',
         children: [
            { to: '/asignaturas', label: 'Gestión de asignaturas' },
            { to: '/asignaturas/equivalencias', label: 'Equivalencias' },
         ],
      },
      {
         to: '/planes',
         icon: 'i-lucide-book-open',
         label: 'Planes de carrera',
         children: [
            { to: '/planes', label: 'Gestión de planes' },
            { to: '/planes/asignacion', label: 'Asociar asignaturas' },
         ],
      },
      {
         to: '/salas',
         icon: 'i-lucide-door-open',
         label: 'Salas',
         children: [
            { to: '/salas/tipos', label: 'Tipos de sala' },
            { to: '/salas/gestion', label: 'Gestión de salas' },
            { to: '/salas/asignacion', label: 'Asignación' },
            { to: '/salas/pantallas', label: 'Pantallas Público' },
         ],
      },
   ],
   [
      { to: '/semestres', icon: 'i-lucide-calendar-range', label: 'Semestres' },
      {
         to: '/bloques',
         icon: 'i-lucide-clock',
         label: 'Bloques horarios',
         children: [
            { to: '/bloques', label: 'Gestión de bloques' },
            { to: '/bloques/copiar', label: 'Copiar entre semestres' },
         ],
      },
      { to: '/feriados', icon: 'i-lucide-calendar-off', label: 'Feriados' },
   ],
   [
      {
         to: '/ayudantias',
         icon: 'i-lucide-user-check',
         label: 'Ayudantías',
         children: [
            { to: '/ayudantias', label: 'Horario de ayudantías' },
            { to: '/ayudantias/resumen', label: 'Resumen' },
            { to: '/ayudantias/gestion', label: 'Gestión de ayudantes' },
         ],
      },
      {
         to: '/cursos',
         icon: 'i-lucide-school',
         label: 'Cursos',
         children: [
            { to: '/cursos', label: 'Gestión de cursos' },
            { to: '/cursos/carga-masiva', label: 'Carga masiva de horario' },
         ],
      },
      {
         to: '/horario',
         icon: 'i-lucide-calendar-clock',
         label: 'Horario',
         children: [
            { to: '/horario', label: 'Horarios de carreras' },
            { to: '/horario/profesor', label: 'Horario de profesor' },
         ],
      },
      {
         to: '/paralelos',
         icon: 'i-lucide-users-round',
         label: 'Paralelos',
         children: [
            { to: '/paralelos', label: 'Gestión de paralelos' },
            { to: '/paralelos/asignacion', label: 'Asignación de paralelos' },
         ],
      },
      {
         to: '/reservas',
         icon: 'i-lucide-calendar',
         label: 'Reservas',
         children: [
            { to: '/reservas/horario', label: 'Horario de salas' },
            { to: '/reservas/imprimir', label: 'Imprimir horarios' },
            { to: '/reservas/resumen', label: 'Resumen de reservas' },
            { to: '/reservas/tipos', label: 'Tipos de reserva' },
         ],
      },
   ],
   [
      {
         to: '/titulaciones',
         icon: 'i-lucide-award',
         label: 'Titulaciones',
         children: [
            { to: '/titulaciones/propuestas', label: '1: Revisión de propuestas' },
            { to: '/titulaciones/asignacion-guia', label: '2: Asignación por equipo' },
            { to: '/titulaciones/procesos', label: 'Procesos' },
            { to: '/titulaciones/estudiantes', label: 'Estudiantes' },
            { to: '/titulaciones/grupos', label: 'Grupos' },
            { to: '/titulaciones/lineas-investigacion', label: 'Líneas de investigación' },
            { to: '/titulaciones/roles', label: 'Roles' },
            { to: '/titulaciones/profesores', label: 'Profesores' },
         ],
      },
   ],
   [
      {
         to: '/personas',
         icon: 'i-lucide-user-round',
         label: 'Personas',
         children: [
            { to: '/personas/tipos', label: 'Tipos de persona' },
            { to: '/personas/gestion', label: 'Gestión de personas' },
         ],
      },
      { to: '/permisos', icon: 'i-lucide-shield-check', label: 'Permisos' },
      {
         to: '/reportes',
         icon: 'i-lucide-file-bar-chart',
         label: 'Reportes',
         children: [
            { to: '/reportes/bloques-libres', label: 'Bloques Libres Estudiantes' },
            { to: '/reportes/topes-horario', label: 'Topes de Horario' },
            { to: '/reportes/uso-salas', label: 'Uso de Salas' },
            { to: '/horario/profesores', label: 'Bloques por profesor' },
            { to: '/reportes/asignaturas-plan', label: 'Asignaturas por Plan' },
         ],
      },
   ],
   [{ to: '/configuracion', icon: 'i-lucide-settings', label: 'Configuración' }],
]

// Plano, para lo que necesita recorrer todos los ítems sin importar el grupo (ver `pageIcon`).
const navItems: NavItem[] = gruposNav.flat()

const currentUser = reactive({
   nombre: user.value?.nombre,
   apellido: user.value?.apellido,
   rol: user.value?.rol,
   emoji: user.value?.emoji,
})

const initials = computed(() => `${currentUser.nombre![0]}${currentUser.apellido![0]}`.toUpperCase())

async function logout() {
   await $fetch('/api/auth/logout', { method: 'POST' })
   // Sin esto, `useUserSession().user`/`loggedIn` quedan con el valor previo hasta la próxima
   // navegación SSR: auth.global.ts vería "todavía logueado" al entrar a /login y rebotaría de
   // vuelta — mismo criterio que login.vue tras un login exitoso.
   await fetchSession()
   await navigateTo('/login')
}

const pageTitles: Record<string, string> = {
   '/': 'Inicio',
   '/carreras': 'Carreras',
   '/carreras/asignacion': 'Asignación de personas',
   '/planes': 'Planes de carrera',
   '/planes/asignacion': 'Asociar asignaturas',
   '/asignaturas': 'Asignaturas',
   '/asignaturas/equivalencias': 'Equivalencias de asignaturas',
   '/cursos': 'Cursos',
   '/cursos/carga-masiva': 'Carga masiva de horario',
   '/feriados': 'Feriados',
   '/permisos': 'Permisos',
   '/configuracion': 'Configuración',
   '/paralelos': 'Gestión de paralelos',
   '/paralelos/asignacion': 'Asignación de paralelos',
   '/horario': 'Horario',
   '/horario/profesor': 'Horario de profesor',
   '/horario/profesores': 'Bloques por profesor',
   '/semestres': 'Semestres',
   '/bloques': 'Bloques horarios',
   '/bloques/copiar': 'Copiar bloques entre semestres',
   '/reportes/bloques-libres': 'Bloques Libres Estudiantes',
   '/reportes/topes-horario': 'Topes de Horario',
   '/reportes/uso-salas': 'Uso de Salas',
   '/reportes/asignaturas-plan': 'Asignaturas por Plan',
   '/salas/tipos': 'Tipos de sala',
   '/salas/gestion': 'Gestión de salas',
   '/salas/asignacion': 'Asignación de salas',
   '/salas/pantallas': 'Pantallas Público',
   '/personas/tipos': 'Tipos de persona',
   '/personas/gestion': 'Gestión de personas',
   '/reservas/horario': 'Horario de salas',
   '/reservas/imprimir': 'Imprimir horarios',
   '/reservas/resumen': 'Resumen de reservas',
   '/reservas/tipos': 'Tipos de reserva',
   '/ayudantias': 'Ayudantías',
   '/ayudantias/resumen': 'Resumen de ayudantías',
   '/ayudantias/gestion': 'Gestión de ayudantes',
   '/titulaciones/procesos': 'Procesos de titulación',
   '/titulaciones/estudiantes': 'Estudiantes',
   '/titulaciones/grupos': 'Grupos',
   '/titulaciones/lineas-investigacion': 'Líneas de investigación',
   '/titulaciones/roles': 'Roles',
   '/titulaciones/profesores': 'Profesores',
   '/titulaciones/propuestas': 'Fase 1: Revisión de propuestas',
   '/titulaciones/asignacion-guia': 'Fase 2: Asignación por equipo',
   // No están en `navItems` (`/cuenta/contrasena` se llega por el botón del pie; `/cuenta/preferencias`
   // cuelga de su propio `UNavigationMenu`, aparte de `gruposNav`), así que también necesitan su
   // icono acá abajo, en `pageIcon`.
   '/cuenta/contrasena': 'Cambiar su contraseña',
   '/cuenta/preferencias': 'Preferencias',
}

const pageTitle = computed(() => pageTitles[route.path] ?? 'Dashboard')

useHead({ title: computed(() => `HELIOS - ${pageTitle.value}`) })
// Iconos de las rutas que no cuelgan de `navItems` (`gruposNav.flat()`), que si no caerían en el
// icono genérico de dashboard.
const iconosFueraDelMenu: Record<string, string> = {
   '/cuenta/contrasena': 'i-lucide-key-round',
   '/cuenta/preferencias': 'i-lucide-sun-moon',
}

const pageIcon = computed(() => {
   const fueraDelMenu = iconosFueraDelMenu[route.path]
   if (fueraDelMenu) return fueraDelMenu
   for (const item of navItems) {
      if (item.to === route.path) return item.icon
      if (item.children?.some((c) => c.to === route.path)) return item.icon
   }
   return 'i-lucide-layout-dashboard'
})

// Rutas sin recurso de backend propio (ver también app/middleware/auth.global.ts).
const RUTAS_SIN_RESTRICCION = ['/', '/reportes']

function puedeVer(to: string) {
   return (
      user.value?.rol === 'Administrador' ||
      RUTAS_SIN_RESTRICCION.includes(to) ||
      (user.value?.permisos?.some((p) => p.ruta === to && p.acciones.includes('ver')) ?? false)
   )
}

// Filtra por permiso de 'ver' del usuario logueado; agrega `type: 'trigger'` a los grupos
// (para que no naveguen, solo despleguen hijos) y `onSelect` para cerrar el drawer móvil.
// Devuelve un array de arrays: UNavigationMenu vertical dibuja un separador entre cada uno.
// Los grupos que quedan sin ítems visibles se descartan, o el separador de un grupo vacío
// quedaría flotando para los roles con pocos permisos.
const navItemsVisibles = computed<NavigationMenuItem[][]>(() =>
   gruposNav
      .map((grupo) =>
         grupo
            .filter((item) => puedeVer(item.to) || item.children?.some((c) => puedeVer(c.to)))
            .map((item) => {
               if (item.children) {
                  const children = item.children.filter((c) => puedeVer(c.to))
                  return {
                     ...item,
                     // `as const` para que no se ensanche a `string`: al anidar los grupos, el
                     // .map() interno ya no recibe el tipo esperado por contexto.
                     type: 'trigger' as const,
                     defaultOpen: false,
                     children: children.map((child) => ({
                        ...child,
                        onSelect: () => {
                           sidebarOpen.value = false
                        },
                     })),
                  }
               }
               return {
                  ...item,
                  onSelect: () => {
                     sidebarOpen.value = false
                  },
               }
            })
      )
      .filter((grupo) => grupo.length > 0)
)

// Va aparte de `gruposNav`: no es una sección de gestión, es autoservicio de la cuenta (cambiar
// contraseña, preferencias), y se ancla al fondo de la barra lateral en vez de quedar en el
// flujo del menú — ver el `flex-1` de `UNavigationMenu` principal en el template.
const navItemsPreferencias = computed<NavigationMenuItem[][]>(() => [
   [
      {
         to: '/cuenta/contrasena',
         icon: 'i-lucide-key-round',
         label: 'Cambiar contraseña',
         onSelect: () => {
            sidebarOpen.value = false
         },
      },
      {
         to: '/cuenta/preferencias',
         icon: 'i-lucide-sun-moon',
         label: 'Preferencias',
         onSelect: () => {
            sidebarOpen.value = false
         },
      },
   ],
])
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
      class="flex min-h-screen bg-usm-light text-usm-text transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100 print:bg-white!"
   >
      <!-- Mobile overlay -->
      <Transition name="overlay">
         <div v-if="sidebarOpen" class="fixed inset-0 z-20 bg-black/50 lg:hidden" @click="sidebarOpen = false" />
      </Transition>

      <!-- Sidebar -->
      <aside
         class="print:hidden fixed inset-y-0 left-0 z-30 flex flex-col bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transition-all duration-300"
         :class="[
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            collapsed ? 'w-16 max-lg:w-64' : 'w-64',
         ]"
      >
         <!-- Brand -->
         <div
            class="flex shrink-0 items-center border-b border-gray-200 dark:border-slate-800"
            :class="collapsed ? 'flex-col gap-1 px-2 py-2' : 'h-16 gap-3 px-4'"
         >
            <div class="flex shrink-0 items-center justify-center rounded-lg" :class="collapsed ? 'size-8' : 'size-12'">
               <NuxtImg src="/images/isotipo-usm.png" format="webp" quality="80" alt="UTFSM" />
            </div>
            <div v-if="!collapsed" class="min-w-0 leading-tight">
               <p class="truncate text-sm font-bold text-usm-text dark:text-white">HELIOS</p>
               <p class="truncate text-xs text-usm-gray dark:text-slate-400">Gestión Académica</p>
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
            <UButton
               :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
               variant="ghost"
               color="neutral"
               size="sm"
               class="hidden lg:inline-flex"
               :class="collapsed ? '' : 'ml-auto'"
               :aria-label="collapsed ? 'Expandir menú' : 'Colapsar menú'"
               @click="
                  () => {
                     collapsed = !collapsed
                  }
               "
            />
         </div>

         <!-- Nav -->
         <UNavigationMenu
            orientation="vertical"
            :collapsed="collapsed"
            :items="navItemsVisibles"
            tooltip
            popover
            class="flex-1 overflow-y-auto p-3"
         />

         <!-- Preferencias: separado de `gruposNav` y anclado al fondo de la barra lateral (el
              `flex-1` del menú de arriba empuja este bloque hasta pegarlo con el pie). -->
         <UNavigationMenu
            orientation="vertical"
            :collapsed="collapsed"
            :items="navItemsPreferencias"
            tooltip
            popover
            class="shrink-0 border-t border-gray-200 p-3 dark:border-slate-800"
         />

         <!-- Sidebar footer -->
         <div class="shrink-0 border-t border-gray-200 dark:border-slate-800 p-3">
            <!-- Authenticated user -->
            <div class="flex items-center gap-3 rounded-xl px-3 py-2.5" :class="collapsed ? 'flex-col px-0' : ''">
               <div
                  class="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-usm-blue text-xs font-bold text-white"
               >
                  {{ initials }}
                  <span v-if="currentUser.emoji" class="absolute -top-1.5 -right-1.5 text-[1.75rem] leading-none">
                     {{ currentUser.emoji }}
                  </span>
               </div>
               <div v-if="!collapsed" class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-usm-text dark:text-white">
                     {{ currentUser.nombre }} {{ currentUser.apellido }}
                  </p>
                  <p class="truncate text-xs text-usm-gray dark:text-slate-400">
                     {{ currentUser.rol }}
                  </p>
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
      <div
         class="flex min-w-0 flex-1 flex-col transition-[padding] duration-300"
         :class="collapsed ? 'lg:pl-16' : 'lg:pl-64'"
      >
         <!-- Topbar -->
         <header
            class="print:hidden sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 sm:px-6"
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

            <!-- Velo de carga mientras se resuelve la navegación a otra página. Va sobre el
                 contenido (que sigue siendo el de la página anterior hasta que Nuxt la
                 reemplaza) para que se lea como "esto se está actualizando". El badge es
                 `sticky` para seguir visible aunque la página sea larga y esté scrolleada. -->
            <Transition name="overlay">
               <div
                  v-if="navegando"
                  class="print:hidden absolute inset-0 z-10 bg-usm-light/70 dark:bg-slate-950/70"
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

         <footer class="print:hidden shrink-0 border-t border-gray-200 dark:border-slate-800 px-4 py-3 sm:px-6">
            <p class="text-center text-xs text-usm-gray dark:text-slate-500">
               Desarrollado por Departamento Electrotecnia e Informática ELINF
            </p>
         </footer>
      </div>
   </div>
</template>
