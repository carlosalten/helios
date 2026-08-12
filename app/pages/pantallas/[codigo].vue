<script setup lang="ts">
import type { DatosPantallaPublica, ClasePantalla } from '~/types/pantallaPublica'
import { COLORES_RESERVA } from '~/types/reserva'

// Layout propio (sin sidebar/topbar) y ruta pública: ver app/middleware/auth.global.ts
// (compara por prefijo `/pantallas/`) y server/api/pantallas/publico/[codigo].get.ts (sin
// requierePermiso). No hay nadie logueado mirando esta pantalla.
definePageMeta({ layout: 'pantalla' })

const route = useRoute()
const codigo = computed(() => String(route.params.codigo))

const { data, status, error, refresh } = await useFetch<DatosPantallaPublica>(
   () => `/api/pantallas/publico/${codigo.value}`
)

// Refresco frecuente: a diferencia de un horario semanal, "en curso"/"próximas" cambia solo
// con que pase el tiempo (una clase empieza o termina) sin que nadie edite nada — un refresco
// cada 5 minutos, como en otras páginas, dejaría una clase "en curso" en pantalla varios
// minutos después de terminada.
const UN_MINUTO_MS = 60 * 1000
let temporizadorRefresco: ReturnType<typeof setInterval> | null = null
onMounted(() => {
   temporizadorRefresco = setInterval(() => refresh(), UN_MINUTO_MS)
})
onUnmounted(() => {
   if (temporizadorRefresco) clearInterval(temporizadorRefresco)
})

// Reloj visible en el header: además de ser útil en un hall, deja claro de un vistazo que la
// pantalla sigue viva y no se congeló.
const ahora = ref(new Date())
let temporizadorReloj: ReturnType<typeof setInterval> | null = null
onMounted(() => {
   temporizadorReloj = setInterval(() => {
      ahora.value = new Date()
   }, 1000)
})
onUnmounted(() => {
   if (temporizadorReloj) clearInterval(temporizadorReloj)
})
const horaActual = computed(
   () => `${String(ahora.value.getHours()).padStart(2, '0')}:${String(ahora.value.getMinutes()).padStart(2, '0')}`
)

/* ── Slideshow: alterna entre "en curso" y "próximas" ────────────────────
   Solo dos vistas fijas (a diferencia de la versión anterior, que rotaba una sala por slide):
   acá lo que cambia es el criterio (en curso / próximas), no la sala — ambas vistas ya cubren
   todas las salas de la pantalla a la vez. */
type Vista = 'enCurso' | 'proximas'
const vistaActual = ref<Vista>('enCurso')

let temporizadorSlide: ReturnType<typeof setTimeout> | null = null
function programarSiguienteSlide() {
   if (temporizadorSlide) clearTimeout(temporizadorSlide)
   const segundos = data.value?.pantalla.segundosPorSlide ?? 15
   temporizadorSlide = setTimeout(() => {
      vistaActual.value = vistaActual.value === 'enCurso' ? 'proximas' : 'enCurso'
      programarSiguienteSlide()
   }, segundos * 1000)
}
watch(
   () => data.value?.pantalla.segundosPorSlide,
   () => programarSiguienteSlide()
)
onMounted(() => programarSiguienteSlide())
onUnmounted(() => {
   if (temporizadorSlide) clearTimeout(temporizadorSlide)
})

const clasesVista = computed(() => (data.value ? data.value[vistaActual.value] : []))

// Mismo criterio que /reservas/horario (colorImpresion): cada paralelo lleva el color que se
// le asignó en /horario; si todavía no tiene, se deriva uno estable de su identificador — no
// es aleatorio, el mismo paralelo sale siempre del mismo color.
function colorDe(clase: ClasePantalla) {
   if (clase.color) return clase.color
   const clave = `${clase.asignaturaNombre}·${clase.paraleloCodigo}`
   let indice = 0
   for (const caracter of clave) indice = (indice * 31 + caracter.charCodeAt(0)) % COLORES_RESERVA.length
   return COLORES_RESERVA[indice]!.hex
}
</script>

<template>
   <div class="flex h-full flex-col p-6">
      <!-- Cargando -->
      <div v-if="status === 'pending'" class="flex flex-1 items-center justify-center">
         <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-white/40" />
      </div>

      <!-- Pantalla inexistente -->
      <div v-else-if="error" class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
         <UIcon name="i-lucide-monitor-x" class="size-14 text-white/30" />
         <p class="text-2xl font-semibold text-white/80">Pantalla no encontrada</p>
         <p class="text-white/40">No existe ninguna pantalla pública con el código «{{ codigo }}».</p>
      </div>

      <template v-else-if="data">
         <!-- Sin salas asignadas -->
         <div v-if="!data.hoy" class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <UIcon name="i-lucide-door-open" class="size-14 text-white/30" />
            <p class="text-2xl font-semibold text-white/80">{{ data.pantalla.nombre }}</p>
            <p class="text-white/40">Esta pantalla todavía no tiene salas asignadas.</p>
         </div>

         <template v-else>
            <!-- Header -->
            <div class="mb-6 flex shrink-0 items-start justify-between gap-4">
               <div class="min-w-0">
                  <h1 class="text-3xl font-bold">
                     {{ vistaActual === 'enCurso' ? 'Clases en curso' : 'Próximas clases' }}
                  </h1>
                  <p class="text-white/50">{{ data.pantalla.nombre }}</p>
               </div>
               <p class="shrink-0 font-mono text-3xl tabular-nums text-white/70">{{ horaActual }}</p>
            </div>

            <!-- Lista de clases -->
            <div class="min-h-0 flex-1 overflow-y-auto">
               <div
                  v-if="!clasesVista.length"
                  class="flex h-full flex-col items-center justify-center gap-3 text-center text-white/40"
               >
                  <UIcon name="i-lucide-coffee" class="size-14 text-white/20" />
                  <p class="text-xl">
                     {{
                        vistaActual === 'enCurso'
                           ? 'No hay clases en curso en este momento.'
                           : 'No hay más clases por comenzar hoy.'
                     }}
                  </p>
               </div>
               <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  <div
                     v-for="clase in clasesVista"
                     :key="clase.id"
                     class="rounded-xl border-s-4 bg-white/3 p-4"
                     :style="{ borderColor: colorDe(clase) }"
                  >
                     <div class="mb-2 flex items-start justify-between gap-3">
                        <span
                           class="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-lg font-bold"
                        >
                           <UIcon name="i-lucide-door-open" class="size-4" />
                           {{ clase.salaCodigo }}
                        </span>
                        <span class="shrink-0 font-mono text-lg font-semibold tabular-nums text-white/80">
                           {{ clase.inicio }}–{{ clase.fin }}
                        </span>
                     </div>
                     <p class="truncate text-xl font-bold text-white">{{ clase.asignaturaNombre }}</p>
                     <p class="truncate text-white/60">
                        {{ clase.asignaturaCodigo }} · Paralelo {{ clase.paraleloCodigo }}
                     </p>
                     <p class="truncate text-white/50">{{ clase.carreraNombre }}</p>
                     <p class="mt-2 flex items-center gap-1.5 truncate text-white/60">
                        <UIcon name="i-lucide-user" class="size-4 shrink-0" />
                        <span :class="clase.profesor ? '' : 'italic'">
                           {{ clase.profesor ?? 'Sin profesor asignado' }}
                        </span>
                     </p>
                  </div>
               </div>
            </div>

            <!-- Progreso del slideshow: dos vistas, en curso / próximas -->
            <div class="mt-4 flex shrink-0 justify-center gap-2">
               <span
                  class="h-1.5 rounded-full transition-all"
                  :class="vistaActual === 'enCurso' ? 'w-8 bg-white/70' : 'w-1.5 bg-white/20'"
               />
               <span
                  class="h-1.5 rounded-full transition-all"
                  :class="vistaActual === 'proximas' ? 'w-8 bg-white/70' : 'w-1.5 bg-white/20'"
               />
            </div>
         </template>
      </template>
   </div>
</template>
