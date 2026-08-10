<script setup lang="ts">
import type { Carrera, PersonaConAsignacion } from '~/types/carrera'

const toast = useToast()

const { data: carreras, status: statusCarreras } = await useFetch<Carrera[]>('/api/carreras')

const { puedeEditar } = usePermiso('/carreras/asignacion')

/* ── Carrera seleccionada ────────────────────────────────── */
const carreraSeleccionada = ref<Carrera | null>(null)
const personas = ref<PersonaConAsignacion[]>([])
const cargandoPersonas = ref(false)

const busquedaCarrera = ref('')
const busquedaPersona = ref('')

const carrerasFiltradas = computed(() =>
   (carreras.value ?? []).filter(
      (c) =>
         normalizarTexto(c.nombre).includes(normalizarTexto(busquedaCarrera.value)) ||
         String(c.codigo).includes(busquedaCarrera.value)
   )
)

const personasFiltradas = computed(() =>
   personas.value.filter(
      (p) =>
         normalizarTexto(`${p.nombre} ${p.apellido}`).includes(normalizarTexto(busquedaPersona.value)) ||
         normalizarTexto(p.email).includes(normalizarTexto(busquedaPersona.value))
   )
)

async function seleccionarCarrera(carrera: Carrera) {
   if (carreraSeleccionada.value?.codigo === carrera.codigo) return
   carreraSeleccionada.value = carrera
   busquedaPersona.value = ''
   cargandoPersonas.value = true
   try {
      const url: string = `/api/carreras/${carrera.codigo}/personas`
      personas.value = await $fetch<PersonaConAsignacion[]>(url)
   } finally {
      cargandoPersonas.value = false
   }
}

/* ── Toggle asignación ───────────────────────────────────── */
const toggling = ref<number | null>(null)

async function toggleAsignacion(persona: PersonaConAsignacion) {
   if (!carreraSeleccionada.value || toggling.value) return
   toggling.value = persona.id
   try {
      const { asignado } = await $fetch<{ asignado: boolean }>('/api/carreras/asignacion/toggle', {
         method: 'POST',
         body: { carreraCodigo: carreraSeleccionada.value.codigo, personaId: persona.id },
      })
      persona.asignado = asignado
   } catch {
      toast.add({ title: 'Error al actualizar la asignación', color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      toggling.value = null
   }
}

const asignadosCount = computed(() => personas.value.filter((p) => p.asignado).length)
</script>

<template>
   <div class="space-y-6">
      <div>
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Selecciona una carrera para gestionar qué directores de departamento, profesores y apoyos docentes están
            asignados a ella.
         </p>
      </div>

      <div class="lg:grid lg:grid-cols-[280px_1fr] lg:gap-6">
         <!-- Panel izquierdo: lista de carreras -->
         <div class="space-y-3">
            <UInput v-model="busquedaCarrera" icon="i-lucide-search" placeholder="Buscar carrera…" class="w-full" />

            <TableSkeleton v-if="statusCarreras === 'pending'" :rows="6" />

            <div
               v-else-if="!carrerasFiltradas.length"
               class="rounded-2xl border border-dashed border-default p-6 text-center"
            >
               <p class="text-sm text-usm-text-muted dark:text-slate-400">No se encontraron carreras</p>
            </div>

            <div v-else class="space-y-1">
               <button
                  v-for="carrera in carrerasFiltradas"
                  :key="carrera.codigo"
                  class="w-full rounded-xl border px-4 py-3 text-left transition-colors duration-150"
                  :class="
                     carreraSeleccionada?.codigo === carrera.codigo
                        ? 'border-usm-blue bg-usm-blue/10 dark:border-usm-cyan dark:bg-usm-cyan/10'
                        : 'border-default bg-default hover:bg-gray-50 dark:hover:bg-slate-800'
                  "
                  @click="seleccionarCarrera(carrera)"
               >
                  <p
                     class="text-sm font-semibold"
                     :class="
                        carreraSeleccionada?.codigo === carrera.codigo
                           ? 'text-usm-blue dark:text-usm-cyan'
                           : 'text-usm-text dark:text-white'
                     "
                  >
                     {{ carrera.nombre }}
                  </p>
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">Código {{ carrera.codigo }}</p>
               </button>
            </div>
         </div>

         <!-- Panel derecho: personas asignadas a la carrera seleccionada -->
         <div class="mt-6 lg:mt-0">
            <EmptyState
               v-if="!carreraSeleccionada"
               icon="i-lucide-mouse-pointer-click"
               message="Selecciona una carrera para ver y gestionar sus personas asignadas"
            />

            <div v-else class="space-y-4">
               <!-- Cabecera del panel -->
               <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                     <h3 class="font-semibold text-usm-text dark:text-white">{{ carreraSeleccionada.nombre }}</h3>
                     <p class="text-sm text-usm-text-muted dark:text-slate-400">
                        Código {{ carreraSeleccionada.codigo }} ·
                        <span class="font-medium text-usm-blue dark:text-usm-cyan">
                           {{ asignadosCount }} asignado{{ asignadosCount !== 1 ? 's' : '' }}
                        </span>
                     </p>
                  </div>
                  <UInput
                     v-model="busquedaPersona"
                     icon="i-lucide-search"
                     placeholder="Buscar persona…"
                     class="sm:w-52"
                  />
               </div>

               <!-- Lista de personas -->
               <TableSkeleton v-if="cargandoPersonas" :rows="5" />

               <div
                  v-else-if="!personasFiltradas.length"
                  class="rounded-2xl border border-dashed border-default p-6 text-center"
               >
                  <p class="text-sm text-usm-text-muted dark:text-slate-400">No se encontraron personas</p>
               </div>

               <div v-else class="overflow-hidden rounded-2xl border border-default bg-default divide-y divide-default">
                  <div
                     v-for="persona in personasFiltradas"
                     :key="persona.id"
                     class="flex items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                     <!-- Avatar -->
                     <div
                        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-usm-blue/10 dark:bg-usm-cyan/10"
                     >
                        <span class="text-xs font-bold text-usm-blue dark:text-usm-cyan">
                           {{ persona.nombre[0] }}{{ persona.apellido[0] }}
                        </span>
                     </div>

                     <!-- Info -->
                     <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium text-usm-text dark:text-white">
                           {{ persona.nombre }} {{ persona.apellido }}
                        </p>
                        <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                           {{ persona.email }}<template v-if="persona.rol"> · {{ persona.rol.nombre }}</template>
                        </p>
                     </div>

                     <!-- Checkbox -->
                     <UCheckbox
                        :model-value="persona.asignado"
                        :disabled="toggling !== null || !puedeEditar"
                        :ui="{ base: toggling === persona.id ? 'opacity-50' : '' }"
                        @update:model-value="toggleAsignacion(persona)"
                     />
                  </div>
               </div>
            </div>
         </div>
      </div>
   </div>
</template>
