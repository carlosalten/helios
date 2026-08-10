<script setup lang="ts">
import type { Asignatura, AsignaturaConEquivalencia } from '~/types/asignatura'

const toast = useToast()

const { data: asignaturas, status: statusAsignaturas } = await useFetch<Asignatura[]>('/api/asignaturas')

const { puedeEditar } = usePermiso('/asignaturas/equivalencias')

/* ── Asignatura seleccionada ─────────────────────────────── */
const asignaturaSeleccionada = ref<Asignatura | null>(null)
const candidatas = ref<AsignaturaConEquivalencia[]>([])
const cargandoCandidatas = ref(false)

const busquedaAsignatura = ref('')
const busquedaCandidata = ref('')
// Deja ver de un vistazo solo las equivalencias ya marcadas, sin tener que buscarlas entre
// todas las asignaturas del sistema.
const soloEquivalentes = ref(false)

const asignaturasFiltradas = computed(() =>
   (asignaturas.value ?? []).filter(
      (a) =>
         normalizarTexto(a.codigo).includes(normalizarTexto(busquedaAsignatura.value)) ||
         normalizarTexto(a.nombre).includes(normalizarTexto(busquedaAsignatura.value))
   )
)

const candidatasFiltradas = computed(() =>
   candidatas.value.filter(
      (a) =>
         (normalizarTexto(a.codigo).includes(normalizarTexto(busquedaCandidata.value)) ||
            normalizarTexto(a.nombre).includes(normalizarTexto(busquedaCandidata.value))) &&
         (!soloEquivalentes.value || a.equivalente)
   )
)

async function seleccionarAsignatura(asignatura: Asignatura) {
   if (asignaturaSeleccionada.value?.id === asignatura.id) return
   asignaturaSeleccionada.value = asignatura
   busquedaCandidata.value = ''
   soloEquivalentes.value = false
   cargandoCandidatas.value = true
   try {
      const url: string = `/api/asignaturas/${asignatura.id}/equivalencias`
      candidatas.value = await $fetch<AsignaturaConEquivalencia[]>(url)
   } finally {
      cargandoCandidatas.value = false
   }
}

/* ── Toggle equivalencia ─────────────────────────────────── */
const toggling = ref<number | null>(null)

async function toggleEquivalencia(candidata: AsignaturaConEquivalencia) {
   if (!asignaturaSeleccionada.value || toggling.value) return
   toggling.value = candidata.id
   try {
      const { equivalente } = await $fetch<{ equivalente: boolean }>('/api/asignaturas/equivalencias/toggle', {
         method: 'POST',
         body: { asignaturaId: asignaturaSeleccionada.value.id, equivalenteId: candidata.id },
      })
      candidata.equivalente = equivalente
   } catch {
      toast.add({ title: 'Error al actualizar la equivalencia', color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      toggling.value = null
   }
}

const equivalentesCount = computed(() => candidatas.value.filter((a) => a.equivalente).length)
</script>

<template>
   <div class="space-y-6">
      <div>
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Dos asignaturas son equivalentes cuando se dictan como la misma asignatura con distinto código (por ejemplo,
            <strong>HCW100_T</strong> en el plan y <strong>HCW100</strong> en la programación del semestre). La carga
            masiva de horario acepta paralelos de una asignatura que no está en el plan si es equivalente a una que sí
            lo está. La equivalencia es recíproca: al marcarla, ambas quedan equivalentes entre sí.
         </p>
      </div>

      <div class="lg:grid lg:grid-cols-[320px_1fr] lg:gap-6">
         <!-- Panel izquierdo: lista de asignaturas ─────────────────────────────
            Mismo max-h que el panel derecho (no h-full): con align-items:stretch por
            defecto en el grid, ambos paneles ya quedan con la misma altura exterior, pero
            si cada lista interna limitara su propio alto (p. ej. con max-h en vez del
            contenedor), el panel derecho —que trae más "cabecera" (título + filtros) antes
            de su lista— terminaría más alto que el izquierdo. Poniendo el mismo max-h en el
            contenedor y dejando la lista en flex-1 (sin su propio max-h), ambas listas se
            estiran para ocupar lo que les sobra y los dos paneles siempre terminan a la
            misma altura, sin importar cuánta "cabecera" tenga cada uno. -->
         <div class="flex max-h-152 flex-col gap-3">
            <UInput
               v-model="busquedaAsignatura"
               icon="i-lucide-search"
               placeholder="Buscar asignatura…"
               class="w-full"
            />

            <TableSkeleton v-if="statusAsignaturas === 'pending'" :rows="6" />

            <div
               v-else-if="!asignaturasFiltradas.length"
               class="rounded-2xl border border-dashed border-default p-6 text-center"
            >
               <p class="text-sm text-usm-text-muted dark:text-slate-400">No se encontraron asignaturas</p>
            </div>

            <div v-else class="min-h-0 flex-1 space-y-1 overflow-y-auto">
               <button
                  v-for="asignatura in asignaturasFiltradas"
                  :key="asignatura.id"
                  class="w-full rounded-xl border px-4 py-3 text-left transition-colors duration-150"
                  :class="
                     asignaturaSeleccionada?.id === asignatura.id
                        ? 'border-usm-blue bg-usm-blue/10 dark:border-usm-cyan dark:bg-usm-cyan/10'
                        : 'border-default bg-default hover:bg-gray-50 dark:hover:bg-slate-800'
                  "
                  @click="seleccionarAsignatura(asignatura)"
               >
                  <p
                     class="text-sm font-semibold"
                     :class="
                        asignaturaSeleccionada?.id === asignatura.id
                           ? 'text-usm-blue dark:text-usm-cyan'
                           : 'text-usm-text dark:text-white'
                     "
                  >
                     {{ asignatura.codigo }}
                  </p>
                  <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">{{ asignatura.nombre }}</p>
               </button>
            </div>
         </div>

         <!-- Panel derecho: equivalencias de la asignatura seleccionada -->
         <div class="mt-6 flex max-h-152 flex-col lg:mt-0">
            <EmptyState
               v-if="!asignaturaSeleccionada"
               icon="i-lucide-mouse-pointer-click"
               message="Selecciona una asignatura para ver y gestionar sus equivalencias"
            />

            <div v-else class="flex h-full flex-col gap-4">
               <!-- Cabecera del panel -->
               <div>
                  <h3 class="font-semibold text-usm-text dark:text-white">
                     {{ asignaturaSeleccionada.codigo }} · {{ asignaturaSeleccionada.nombre }}
                  </h3>
                  <p class="text-sm text-usm-text-muted dark:text-slate-400">
                     <span class="font-medium text-usm-blue dark:text-usm-cyan">
                        {{ equivalentesCount }} equivalencia{{ equivalentesCount !== 1 ? 's' : '' }}
                     </span>
                  </p>
               </div>

               <!-- Filtros de asignaturas candidatas -->
               <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <UInput
                     v-model="busquedaCandidata"
                     icon="i-lucide-search"
                     placeholder="Buscar asignatura…"
                     class="sm:w-64"
                  />
                  <UCheckbox v-model="soloEquivalentes" label="Solo las equivalentes" />
               </div>

               <!-- Lista de asignaturas candidatas -->
               <TableSkeleton v-if="cargandoCandidatas" :rows="5" />

               <EmptyState
                  v-else-if="!candidatasFiltradas.length"
                  icon="i-lucide-search-x"
                  :message="
                     soloEquivalentes
                        ? 'Esta asignatura todavía no tiene equivalencias'
                        : 'No se encontraron asignaturas'
                  "
               />

               <div
                  v-else
                  class="min-h-0 flex-1 divide-y divide-default overflow-y-auto rounded-2xl border border-default bg-default"
               >
                  <div
                     v-for="candidata in candidatasFiltradas"
                     :key="candidata.id"
                     class="flex items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                     <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium text-usm-text dark:text-white">
                           {{ candidata.codigo }}
                        </p>
                        <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">{{ candidata.nombre }}</p>
                     </div>

                     <UCheckbox
                        :model-value="candidata.equivalente"
                        :disabled="toggling !== null || !puedeEditar"
                        :ui="{ base: toggling === candidata.id ? 'opacity-50' : '' }"
                        @update:model-value="toggleEquivalencia(candidata)"
                     />
                  </div>
               </div>
            </div>
         </div>
      </div>
   </div>
</template>
