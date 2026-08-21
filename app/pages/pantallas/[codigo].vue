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

// Reloj visible en el header: además de ser útil en un hall, deja claro de un vistazo que la
// pantalla sigue viva y no se congeló. Se declara antes del refresco porque `estaEnHorario`
// (más abajo) depende de `ahora`.
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

// Ventana horaria en que la pantalla debe refrescarse (configurable por pantalla en
// /salas/pantallas) — nulo/nulo = sin restricción, siempre en horario. Si `horaFin` es menor
// que `horaInicio`, la ventana cruza la medianoche (ej. 20:00–06:00). Un rango de 0 minutos
// (por algún dato corrupto) se trata como "sin restricción" para no dejar la pantalla apagada
// todo el día por error.
function horaAMinutos(horaHHMM: string) {
   const [h, m] = horaHHMM.split(':').map(Number)
   return h! * 60 + m!
}
const estaEnHorario = computed(() => {
   const { horaInicio, horaFin } = data.value?.pantalla ?? {}
   if (!horaInicio || !horaFin) return true
   const inicioMin = horaAMinutos(horaInicio)
   const finMin = horaAMinutos(horaFin)
   if (inicioMin === finMin) return true
   const ahoraMin = ahora.value.getHours() * 60 + ahora.value.getMinutes()
   if (inicioMin < finMin) return ahoraMin >= inicioMin && ahoraMin < finMin
   return ahoraMin >= inicioMin || ahoraMin < finMin
})

// Refresco frecuente: a diferencia de un horario semanal, "en curso"/"próximas" cambia solo
// con que pase el tiempo (una clase empieza o termina) sin que nadie edite nada — un refresco
// cada 5 minutos, como en otras páginas, dejaría una clase "en curso" en pantalla varios
// minutos después de terminada. Fuera de la ventana configurada no se pide nada al servidor —
// la pantalla queda en modo de ahorro (ver plantilla) hasta que `estaEnHorario` vuelva a ser
// verdadero, sin gastar tráfico de madrugada.
const UN_MINUTO_MS = 60 * 1000
let temporizadorRefresco: ReturnType<typeof setInterval> | null = null
onMounted(() => {
   temporizadorRefresco = setInterval(() => {
      if (estaEnHorario.value) refresh()
   }, UN_MINUTO_MS)
})
onUnmounted(() => {
   if (temporizadorRefresco) clearInterval(temporizadorRefresco)
})

/* ── Slideshow: alterna entre "en curso" y "próximas" ────────────────────
   Solo dos vistas fijas (a diferencia de la versión anterior, que rotaba una sala por slide):
   acá lo que cambia es el criterio (en curso / próximas), no la sala — ambas vistas ya cubren
   todas las salas de la pantalla a la vez. */
type Vista = 'enCurso' | 'proximas'
const VISTAS: Vista[] = ['enCurso', 'proximas']
const vistaActual = ref<Vista>('enCurso')

// Se incrementa cada vez que arranca un ciclo de espera (cambio de vista, o el watcher de
// segundosPorSlide reiniciándolo). La barra de progreso se `:key`-ea con esto para que el
// navegador la vuelva a montar desde 0% en cada ciclo — si solo cambiara `animation-duration`
// sobre el mismo elemento, la animación en curso no se reinicia sola.
const cicloSlide = ref(0)

let temporizadorSlide: ReturnType<typeof setTimeout> | null = null
function programarSiguienteSlide() {
   if (temporizadorSlide) clearTimeout(temporizadorSlide)
   const segundos = data.value?.pantalla.segundosPorSlide ?? 15
   cicloSlide.value++
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

// Color de la franja superior de la pantalla: verde para "en curso" (algo pasando ahora
// mismo), celeste para "próximas" (algo agendado) — la misma asociación que ya usa el resto
// de la app para "En curso" (badge verde con punto animado, ver app/pages/index.vue). Gris
// mientras no hay una vista definida todavía (cargando, error, sin salas).
const colorBarraSuperior = computed(() => {
   if (!data.value?.hoy) return 'bg-white/10'
   return vistaActual.value === 'enCurso' ? 'bg-emerald-400' : 'bg-sky-400'
})

// Un color por carrera (no por paralelo, como en /reservas/horario): en esta pantalla lo que
// importa de un vistazo es "a qué carrera pertenece esta clase", así que todas las clases de
// una misma carrera comparten color. Se deriva de forma estable a partir del nombre — no es
// aleatorio, la misma carrera sale siempre del mismo color. Una reserva sin carrera (no es una
// clase, o es una clase sin sesión de paralelo asociada) usa directamente el color de su tipo
// de reserva (el mismo que se le asignó en Reservas → Tipos), igual que /reservas/horario.
function colorDe(clase: ClasePantalla) {
   if (!clase.esClase || !clase.carreraNombre) return clase.tipoReservaColor
   let indice = 0
   for (const caracter of clase.carreraNombre) indice = (indice * 31 + caracter.charCodeAt(0)) % COLORES_RESERVA.length
   return COLORES_RESERVA[indice]!.hex
}
</script>

<template>
   <div class="flex h-full flex-col">
      <!-- Franja superior de color: la señal más visible a distancia de qué pantalla es cuál
           (en curso = verde, próximas = celeste) — ver `colorBarraSuperior`. -->
      <div class="h-2 shrink-0 transition-colors duration-500" :class="colorBarraSuperior" />

      <div class="flex min-h-0 flex-1 flex-col p-6">
         <!-- Cargando -->
         <div v-if="status === 'pending'" class="flex flex-1 items-center justify-center">
            <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-white/40" />
         </div>

         <!-- Pantalla inexistente -->
         <div v-else-if="error" class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <UIcon name="i-lucide-monitor-x" class="size-14 text-white/30" />
            <p class="text-2xl font-semibold text-white">Pantalla no encontrada</p>
            <p class="text-white">No existe ninguna pantalla pública con el código «{{ codigo }}».</p>
         </div>

         <template v-else-if="data">
            <!-- Sin salas asignadas -->
            <div v-if="!data.hoy" class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
               <UIcon name="i-lucide-door-open" class="size-14 text-white/30" />
               <p class="text-2xl font-semibold text-white">{{ data.pantalla.nombre }}</p>
               <p class="text-white">Esta pantalla todavía no tiene salas asignadas.</p>
            </div>

            <!-- Fuera de la ventana horaria configurada: modo de ahorro, sin refrescar. -->
            <div v-else-if="!estaEnHorario" class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
               <UIcon name="i-lucide-moon" class="size-14 text-white/30" />
               <p class="text-2xl font-semibold text-white">{{ data.pantalla.nombre }}</p>
               <p class="text-white">
                  Fuera de horario de exhibición ({{ data.pantalla.horaInicio }}–{{ data.pantalla.horaFin }}).
               </p>
               <p class="shrink-0 font-mono text-3xl tabular-nums text-white/70">{{ horaActual }}</p>
            </div>

            <template v-else>
               <!-- Header -->
               <div class="mb-6 flex shrink-0 items-start justify-between gap-4">
                  <div class="min-w-0">
                     <div class="flex items-center gap-2.5">
                        <span
                           v-if="vistaActual === 'enCurso'"
                           class="inline-block size-3 shrink-0 animate-pulse rounded-full bg-emerald-400"
                        />
                        <UIcon v-else name="i-lucide-clock" class="size-7 shrink-0 text-sky-400" />
                        <h1
                           class="text-3xl font-bold"
                           :class="vistaActual === 'enCurso' ? 'text-emerald-400' : 'text-sky-400'"
                        >
                           {{ vistaActual === 'enCurso' ? 'Clases en curso' : 'Próximas clases' }}
                        </h1>
                     </div>
                     <p class="text-white">{{ data.pantalla.nombre }}</p>
                  </div>
                  <p class="shrink-0 font-mono text-3xl tabular-nums text-white">{{ horaActual }}</p>
               </div>

               <!-- Lista de clases -->
               <div class="min-h-0 flex-1 overflow-y-auto">
                  <div
                     v-if="!clasesVista.length"
                     class="flex h-full flex-col items-center justify-center gap-3 text-center text-white"
                  >
                     <UIcon name="i-lucide-coffee" class="size-14 text-white" />
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
                        class="rounded-xl border border-s-4 p-4"
                        :class="clase.cancelada ? 'border-red-500 bg-red-500/10' : 'border-white/15 bg-white/8'"
                        :style="clase.cancelada ? {} : { borderInlineStartColor: colorDe(clase) }"
                     >
                        <div
                           v-if="clase.cancelada"
                           class="mb-2 flex items-center gap-1.5 rounded-lg bg-red-500 px-2.5 py-1 text-sm font-bold text-white"
                        >
                           <UIcon name="i-lucide-ban" class="size-4 shrink-0" />
                           Cancelada
                        </div>
                        <div class="mb-2 flex items-start justify-between gap-3">
                           <span
                              class="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-lg font-bold"
                           >
                              <UIcon name="i-lucide-door-open" class="size-4" />
                              {{ clase.salaCodigo }}
                           </span>
                           <span class="shrink-0 font-mono text-lg font-semibold tabular-nums text-white">
                              {{ clase.inicio }}–{{ clase.fin }}
                           </span>
                        </div>
                        <p
                           class="truncate text-xl font-bold text-white"
                           :class="clase.cancelada ? 'line-through opacity-70' : ''"
                        >
                           {{ (clase.esClase && clase.asignaturaNombre) || clase.subtitulo || clase.titulo }}
                        </p>
                        <p v-if="clase.esClase && clase.asignaturaCodigo" class="truncate text-white">
                           {{ clase.asignaturaCodigo }} · Paralelo {{ clase.paraleloCodigo }}
                        </p>
                        <!-- Ayudantía sin sesión de paralelo real: el subtítulo (nombre de la asignatura) ocupó
                             el título grande de arriba, así que acá el título (código+paralelo) baja a detalle,
                             mismo lugar que ocupa "código · Paralelo N" en una clase real. -->
                        <p v-else-if="clase.subtitulo" class="truncate text-white">{{ clase.titulo }}</p>
                        <p v-if="clase.esClase && clase.carreraNombre" class="truncate text-white">
                           {{ clase.carreraNombre }}
                        </p>
                        <p v-if="!clase.esClase" class="truncate text-white">{{ clase.tipoReservaNombre }}</p>
                        <p class="mt-2 flex items-center gap-1.5 truncate text-white">
                           <UIcon name="i-lucide-user" class="size-4 shrink-0" />
                           <span :class="clase.responsable ? '' : 'italic'">
                              {{ clase.responsable ?? 'Sin responsable asignado' }}
                           </span>
                        </p>
                     </div>
                  </div>
               </div>

               <!-- Progreso del slideshow: el indicador de la vista activa se llena de a poco
                 durante los `segundosPorSlide` que faltan para el cambio; el de la otra vista
                 queda como un punto quieto. Se remonta (`:key="cicloSlide"`) en cada ciclo para
                 que la animación arranque siempre desde 0%. -->
               <div class="mt-4 flex shrink-0 items-center justify-center gap-2">
                  <span
                     v-for="v in VISTAS"
                     :key="v"
                     class="h-2 overflow-hidden rounded-full bg-white/10 transition-[width] duration-300"
                     :class="vistaActual === v ? 'w-96' : 'w-6'"
                  >
                     <span
                        v-if="vistaActual === v"
                        :key="cicloSlide"
                        class="block h-full rounded-full"
                        :class="v === 'enCurso' ? 'bg-emerald-400' : 'bg-sky-400'"
                        :style="{ animation: `pantalla-progreso ${data.pantalla.segundosPorSlide}s linear forwards` }"
                     />
                  </span>
               </div>
            </template>
         </template>
      </div>
   </div>
</template>

<style>
/* Sin `scoped`: se referencia por nombre desde un `:style` inline (`animation: pantalla-progreso …`),
   y el CSS scoping de Vue solo reescribe `@keyframes` cuando la animación se aplica vía clase
   dentro del propio bloque `<style>` — un binding inline no se toca, así que con `scoped` el
   nombre dejaba de calzar y la animación nunca corría. */
@keyframes pantalla-progreso {
   from {
      width: 0%;
   }
   to {
      width: 100%;
   }
}
</style>
