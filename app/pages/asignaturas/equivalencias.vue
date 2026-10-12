<script setup lang="ts">
import type { AsignaturaBasica, AsignaturaMallaConEquivalentes, EquivalenciasPlan } from '~/types/asignatura'
import type { Plan } from '~/types/plan'

const toast = useToast()
const { user } = useUserSession()
const { puedeEditar } = usePermiso('/asignaturas/equivalencias')
const { tieneAlcanceSobreCarrera } = useAlcanceCarrera()

const { data: planes } = await useFetch<Plan[]>('/api/asignaturas/equivalencias/planes')

/* ── Plan ────────────────────────────────────────────────── */
function labelPlan(plan: Plan) {
   return `${plan.carrera.nombre} — Plan N° ${plan.numero}${plan.vigente ? ' · Vigente' : ''}`
}
const opcionesPlan = computed(() => (planes.value ?? []).map((p) => ({ label: labelPlan(p), value: p.id })))

// Un Jefe de Carrera parte en el plan de la carrera que dirige (el vigente, si tiene uno),
// igual que /paralelos/asignacion; el resto, en el primero de la lista.
function planPorDefecto() {
   const carrerasJefe = user.value?.carrerasJefe ?? []
   const propios = (planes.value ?? []).filter((p) => carrerasJefe.includes(p.carreraCodigo))
   return (propios.find((p) => p.vigente) ?? propios[0] ?? planes.value?.[0])?.id
}
const planSeleccionadoId = ref<number | undefined>(planPorDefecto())
const planSeleccionado = computed(() => (planes.value ?? []).find((p) => p.id === planSeleccionadoId.value) ?? null)

// Editar exige el permiso y, para un Jefe de Carrera, que el plan sea de su carrera (mismo
// criterio que el endpoint toggle).
const puedeEditarPlan = computed(
   () => puedeEditar.value && !!planSeleccionado.value && tieneAlcanceSobreCarrera(planSeleccionado.value.carreraCodigo)
)

const { data: equivalencias, status } = await useFetch<EquivalenciasPlan>('/api/asignaturas/equivalencias', {
   query: { planId: planSeleccionadoId },
   immediate: planSeleccionadoId.value != null,
   watch: [planSeleccionadoId],
})

/* ── Asignatura de la malla seleccionada ─────────────────── */
const asignaturaSeleccionadaId = ref<number | null>(null)
watch(planSeleccionadoId, () => {
   asignaturaSeleccionadaId.value = null
})
const asignaturaSeleccionada = computed(
   () => equivalencias.value?.malla.find((a) => a.asignaturaPlanId === asignaturaSeleccionadaId.value) ?? null
)

const busquedaMalla = ref('')
const busquedaCandidata = ref('')
// Deja ver de un vistazo solo las equivalencias ya marcadas.
const soloEquivalentes = ref(false)

function coincide(a: AsignaturaBasica, busqueda: string) {
   const q = normalizarTexto(busqueda)
   return normalizarTexto(a.codigo).includes(q) || normalizarTexto(a.nombre).includes(q)
}

const mallaFiltrada = computed(() => (equivalencias.value?.malla ?? []).filter((a) => coincide(a, busquedaMalla.value)))

// Asignatura de la malla de la que ya es equivalente cada candidata (a lo más una por plan).
const duenoPorCandidata = computed(() => {
   const mapa = new Map<number, AsignaturaMallaConEquivalentes>()
   for (const a of equivalencias.value?.malla ?? []) for (const e of a.equivalentes) mapa.set(e.id, a)
   return mapa
})
function esEquivalenteDeSeleccionada(candidata: AsignaturaBasica) {
   return duenoPorCandidata.value.get(candidata.id)?.asignaturaPlanId === asignaturaSeleccionadaId.value
}
// Equivalente de otra asignatura de este plan: no se puede marcar acá sin quitarla allá.
function duenoOtro(candidata: AsignaturaBasica) {
   const dueno = duenoPorCandidata.value.get(candidata.id)
   return dueno && dueno.asignaturaPlanId !== asignaturaSeleccionadaId.value ? dueno : null
}

const candidatasFiltradas = computed(() =>
   (equivalencias.value?.candidatas ?? []).filter(
      (c) => coincide(c, busquedaCandidata.value) && (!soloEquivalentes.value || esEquivalenteDeSeleccionada(c))
   )
)

function seleccionarAsignatura(asignatura: AsignaturaMallaConEquivalentes) {
   asignaturaSeleccionadaId.value = asignatura.asignaturaPlanId
   busquedaCandidata.value = ''
   soloEquivalentes.value = false
}

function etiquetaSemestre(asignatura: AsignaturaMallaConEquivalentes) {
   return asignatura.esElectiva ? 'Electivo' : `Semestre ${asignatura.semestre}`
}

/* ── Toggle equivalencia ─────────────────────────────────── */
const toggling = ref<number | null>(null)

async function toggleEquivalencia(candidata: AsignaturaBasica) {
   const seleccionada = asignaturaSeleccionada.value
   if (!seleccionada || toggling.value) return
   toggling.value = candidata.id
   try {
      const { equivalente } = await $fetch<{ equivalente: boolean }>('/api/asignaturas/equivalencias/toggle', {
         method: 'POST',
         body: { asignaturaPlanId: seleccionada.asignaturaPlanId, asignaturaId: candidata.id },
      })
      seleccionada.equivalentes = equivalente
         ? [...seleccionada.equivalentes, candidata].sort((a, b) => a.codigo.localeCompare(b.codigo))
         : seleccionada.equivalentes.filter((e) => e.id !== candidata.id)
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al actualizar la equivalencia'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      toggling.value = null
   }
}
</script>

<template>
   <div class="space-y-6">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Las equivalencias son propias de cada plan: una asignatura equivalente (por ejemplo,
            <strong>HCW100</strong>) se acepta en ese plan como la asignatura de su malla (por ejemplo,
            <strong>HCW100-T</strong>), al cargar el horario y al crear paralelos. No aplica a otros planes, y una
            asignatura puede ser equivalente a lo más a una asignatura de cada malla.
         </p>
         <USelectMenu
            v-model="planSeleccionadoId"
            :items="opcionesPlan"
            value-key="value"
            placeholder="Selecciona un plan…"
            :search-input="{ placeholder: 'Buscar carrera o número…' }"
            class="w-full lg:w-96 lg:shrink-0"
         />
      </div>

      <EmptyState v-if="!planSeleccionado" icon="i-lucide-book-open" message="Selecciona un plan" />

      <template v-else>
         <p
            v-if="puedeEditar && !puedeEditarPlan"
            class="rounded-xl bg-muted px-4 py-2 text-sm text-usm-text-muted dark:text-slate-400"
         >
            Solo puedes ver las equivalencias de este plan: no pertenece a una carrera que dirijas.
         </p>

         <div class="lg:grid lg:grid-cols-[320px_1fr] lg:gap-6">
            <!-- Panel izquierdo: asignaturas de la malla ─────────────────────
               Mismo max-h que el panel derecho, con la lista en flex-1: así los dos paneles
               terminan a la misma altura aunque el derecho tenga más cabecera. -->
            <div class="flex max-h-152 flex-col gap-3">
               <UInput
                  v-model="busquedaMalla"
                  icon="i-lucide-search"
                  placeholder="Buscar asignatura de la malla…"
                  class="w-full"
               />

               <TableSkeleton v-if="status === 'pending'" :rows="6" />

               <div
                  v-else-if="!mallaFiltrada.length"
                  class="rounded-2xl border border-dashed border-default p-6 text-center"
               >
                  <p class="text-sm text-usm-text-muted dark:text-slate-400">
                     {{
                        equivalencias?.malla.length ? 'No se encontraron asignaturas' : 'Este plan no tiene asignaturas'
                     }}
                  </p>
               </div>

               <div v-else class="min-h-0 flex-1 space-y-1 overflow-y-auto">
                  <button
                     v-for="asignatura in mallaFiltrada"
                     :key="asignatura.asignaturaPlanId"
                     class="w-full rounded-xl border px-4 py-3 text-left transition-colors duration-150"
                     :class="
                        asignaturaSeleccionadaId === asignatura.asignaturaPlanId
                           ? 'border-usm-blue bg-usm-blue/10 dark:border-usm-cyan dark:bg-usm-cyan/10'
                           : 'border-default bg-default hover:bg-gray-50 dark:hover:bg-slate-800'
                     "
                     @click="seleccionarAsignatura(asignatura)"
                  >
                     <div class="flex items-center justify-between gap-2">
                        <p
                           class="text-sm font-semibold"
                           :class="
                              asignaturaSeleccionadaId === asignatura.asignaturaPlanId
                                 ? 'text-usm-blue dark:text-usm-cyan'
                                 : 'text-usm-text dark:text-white'
                           "
                        >
                           {{ asignatura.codigo }}
                        </p>
                        <UBadge
                           v-if="asignatura.equivalentes.length"
                           size="xs"
                           variant="subtle"
                           color="secondary"
                           class="shrink-0"
                        >
                           ≡ {{ asignatura.equivalentes.length }}
                        </UBadge>
                     </div>
                     <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">{{ asignatura.nombre }}</p>
                     <p class="text-[11px] text-usm-text-muted/80 dark:text-slate-500">
                        {{ etiquetaSemestre(asignatura) }}
                     </p>
                  </button>
               </div>
            </div>

            <!-- Panel derecho: equivalentes de la asignatura seleccionada -->
            <div class="mt-6 flex max-h-152 flex-col lg:mt-0">
               <EmptyState
                  v-if="!asignaturaSeleccionada"
                  icon="i-lucide-mouse-pointer-click"
                  message="Selecciona una asignatura de la malla para ver y gestionar sus equivalentes en este plan"
               />

               <div v-else class="flex h-full flex-col gap-4">
                  <div>
                     <h3 class="font-semibold text-usm-text dark:text-white">
                        {{ asignaturaSeleccionada.codigo }} · {{ asignaturaSeleccionada.nombre }}
                     </h3>
                     <p class="text-sm text-usm-text-muted dark:text-slate-400">
                        <span class="font-medium text-usm-blue dark:text-usm-cyan">
                           {{ asignaturaSeleccionada.equivalentes.length }} equivalente{{
                              asignaturaSeleccionada.equivalentes.length !== 1 ? 's' : ''
                           }}
                        </span>
                        en {{ labelPlan(planSeleccionado) }}
                     </p>
                  </div>

                  <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                     <UInput
                        v-model="busquedaCandidata"
                        icon="i-lucide-search"
                        placeholder="Buscar asignatura…"
                        class="sm:w-64"
                     />
                     <UCheckbox v-model="soloEquivalentes" label="Solo las equivalentes" />
                  </div>

                  <EmptyState
                     v-if="!candidatasFiltradas.length"
                     icon="i-lucide-search-x"
                     :message="
                        soloEquivalentes
                           ? 'Esta asignatura todavía no tiene equivalentes en este plan'
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
                           <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                              {{ candidata.nombre }}
                           </p>
                        </div>

                        <UBadge v-if="duenoOtro(candidata)" size="xs" variant="subtle" color="neutral" class="shrink-0">
                           Equivalente a {{ duenoOtro(candidata)!.codigo }}
                        </UBadge>

                        <UCheckbox
                           :model-value="esEquivalenteDeSeleccionada(candidata)"
                           :disabled="toggling !== null || !puedeEditarPlan || !!duenoOtro(candidata)"
                           :ui="{ base: toggling === candidata.id ? 'opacity-50' : '' }"
                           @update:model-value="toggleEquivalencia(candidata)"
                        />
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </template>
   </div>
</template>
