<script setup lang="ts">
import type { Plan } from '~/types/plan'
import type { AsignaturaPlanConExencion } from '~/types/configuracion'

const toast = useToast()
const { puedeEditar } = usePermiso('/configuracion')

const { data: planes, status: statusPlanes } = await useFetch<Plan[]>('/api/configuracion/planes')

function labelPlan(plan: Plan) {
   return `${plan.carrera.nombre} · Plan N° ${plan.numero}${plan.vigente ? ' · Vigente' : ''}`
}

const opcionesPlan = computed(() => (planes.value ?? []).map((p) => ({ label: labelPlan(p), value: p.id })))

const planSeleccionadoId = ref<number>()
watchEffect(() => {
   if (!opcionesPlan.value.some((o) => o.value === planSeleccionadoId.value)) {
      planSeleccionadoId.value = opcionesPlan.value[0]?.value
   }
})

/* ── Asignaturas del plan seleccionado ──────────────────────────────────── */
const asignaturas = ref<AsignaturaPlanConExencion[]>([])
const cargandoAsignaturas = ref(false)

async function cargarAsignaturas() {
   if (planSeleccionadoId.value == null) {
      asignaturas.value = []
      return
   }
   cargandoAsignaturas.value = true
   try {
      asignaturas.value = await $fetch<AsignaturaPlanConExencion[]>(
         `/api/configuracion/planes/${planSeleccionadoId.value}/asignaturas`
      )
   } finally {
      cargandoAsignaturas.value = false
   }
}

watch(planSeleccionadoId, cargarAsignaturas, { immediate: true })

const busqueda = ref('')
const asignaturasFiltradas = computed(() =>
   asignaturas.value.filter(
      (a) =>
         normalizarTexto(a.codigo).includes(normalizarTexto(busqueda.value)) ||
         normalizarTexto(a.nombre).includes(normalizarTexto(busqueda.value))
   )
)

/* ── Toggle exención ─────────────────────────────────────────────────────── */
const toggling = ref<number | null>(null)

async function toggleExencion(asignatura: AsignaturaPlanConExencion) {
   if (toggling.value) return
   toggling.value = asignatura.asignaturaPlanId
   try {
      const { exentaTope } = await $fetch<{ exentaTope: boolean }>(
         `/api/configuracion/asignaturas/${asignatura.asignaturaPlanId}/toggle`,
         { method: 'POST' }
      )
      asignatura.exentaTope = exentaTope
   } catch {
      toast.add({ title: 'Error al actualizar la exención', color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      toggling.value = null
   }
}

const exentasCount = computed(() => asignaturas.value.filter((a) => a.exentaTope).length)
</script>

<template>
   <div class="space-y-6">
      <p class="text-sm text-usm-text-muted dark:text-slate-400">
         Elige un plan y marca qué asignaturas quedan exentas de las advertencias de topes de horario (choque de sala o
         de profesor) en <strong>/horario</strong> y <strong>/cursos</strong>. Útil para asignaturas que comparten sala
         o profesor a propósito.
      </p>

      <TableSkeleton v-if="statusPlanes === 'pending'" :rows="6" />

      <EmptyState
         v-else-if="!opcionesPlan.length"
         icon="i-lucide-book-open"
         message="No hay planes disponibles para configurar."
      />

      <div v-else class="space-y-4">
         <USelect
            v-model="planSeleccionadoId"
            :items="opcionesPlan"
            value-key="value"
            placeholder="Selecciona un plan…"
            class="w-full sm:w-96"
         />

         <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <UInput v-model="busqueda" icon="i-lucide-search" placeholder="Buscar asignatura…" class="w-full sm:w-72" />
            <span class="text-sm text-usm-text-muted dark:text-slate-400">
               {{ exentasCount }} exenta{{ exentasCount !== 1 ? 's' : '' }} de {{ asignaturas.length }}
            </span>
         </div>

         <TableSkeleton v-if="cargandoAsignaturas" :rows="6" />

         <EmptyState
            v-else-if="!asignaturas.length"
            icon="i-lucide-layers"
            message="Este plan no tiene asignaturas asociadas."
         />

         <EmptyState
            v-else-if="!asignaturasFiltradas.length"
            icon="i-lucide-search-x"
            message="No se encontraron asignaturas."
         />

         <div v-else class="overflow-hidden rounded-2xl border border-default bg-default divide-y divide-default">
            <div
               v-for="asignatura in asignaturasFiltradas"
               :key="asignatura.asignaturaPlanId"
               class="flex items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
               <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-usm-text dark:text-white">
                     {{ asignatura.codigo }} · {{ asignatura.nombre }}
                  </p>
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">
                     {{ asignatura.esElectiva ? 'Electivo' : `Semestre ${asignatura.semestre}` }}
                  </p>
               </div>

               <UBadge v-if="asignatura.exentaTope" variant="subtle" color="warning" class="shrink-0">
                  Sin aviso de topes
               </UBadge>

               <UCheckbox
                  :model-value="asignatura.exentaTope"
                  :disabled="toggling !== null || !puedeEditar"
                  :ui="{ base: toggling === asignatura.asignaturaPlanId ? 'opacity-50' : '' }"
                  @update:model-value="toggleExencion(asignatura)"
               />
            </div>
         </div>
      </div>
   </div>
</template>
