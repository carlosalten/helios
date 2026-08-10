<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { OpcionesReporte, AsignaturaReporte } from '~/types/reportes'
import { nombreCortoDia } from '~/types/dia'

const { data: opciones, status: statusOpciones } = await useFetch<OpcionesReporte>(
   '/api/reportes/asignaturas-plan/opciones'
)

/* ── Carrera → Plan → Semestre (cascada) ────────────────────────────────── */
const opcionesCarrera = computed(() => {
   const vistas = new Map<number, string>()
   for (const plan of opciones.value?.planes ?? []) {
      if (!vistas.has(plan.carreraCodigo)) vistas.set(plan.carreraCodigo, plan.carrera.nombre)
   }
   return [...vistas.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
})

const carreraSeleccionada = ref<number>()
watchEffect(() => {
   if (carreraSeleccionada.value == null && opcionesCarrera.value.length) {
      carreraSeleccionada.value = opcionesCarrera.value[0]!.value
   }
})

function labelPlan(plan: { numero: number; vigente: boolean }) {
   return `Plan N° ${plan.numero}${plan.vigente ? ' · Vigente' : ''}`
}

const opcionesPlan = computed(() =>
   (opciones.value?.planes ?? [])
      .filter((p) => p.carreraCodigo === carreraSeleccionada.value)
      .map((p) => ({ value: p.id, label: labelPlan(p) }))
)

const planSeleccionadoId = ref<number>()
watch(
   [carreraSeleccionada, opcionesPlan],
   () => {
      if (!opcionesPlan.value.some((o) => o.value === planSeleccionadoId.value)) {
         planSeleccionadoId.value = opcionesPlan.value[0]?.value
      }
   },
   { immediate: true }
)

const opcionesSemestre = computed(() =>
   (opciones.value?.semestres ?? []).map((s) => ({ value: s.id, label: s.nombre }))
)

const semestreSeleccionadoId = ref<number>()
watchEffect(() => {
   if (semestreSeleccionadoId.value == null && opciones.value?.semestres?.length) {
      semestreSeleccionadoId.value =
         opciones.value.semestres.find((s) => s.vigente)?.id ?? opciones.value.semestres[0]!.id
   }
})

/* ── Reporte del (plan, semestre) seleccionado ──────────────────────────── */
const asignaturas = ref<AsignaturaReporte[]>([])
const cargandoReporte = ref(false)

async function cargarReporte() {
   if (planSeleccionadoId.value == null || semestreSeleccionadoId.value == null) {
      asignaturas.value = []
      return
   }
   cargandoReporte.value = true
   try {
      const respuesta = await $fetch<{ asignaturas: AsignaturaReporte[] }>('/api/reportes/asignaturas-plan', {
         query: { planId: planSeleccionadoId.value, semestreId: semestreSeleccionadoId.value },
      })
      asignaturas.value = respuesta.asignaturas
   } finally {
      cargandoReporte.value = false
   }
}

watch([planSeleccionadoId, semestreSeleccionadoId], cargarReporte, { immediate: true })

/* ── Panel de detalle: horario de los paralelos de la asignatura seleccionada ───────────── */
const asignaturaSeleccionada = ref<AsignaturaReporte | null>(null)

function seleccionarAsignatura(row: { original: AsignaturaReporte }) {
   asignaturaSeleccionada.value = row.original
}

const filaSeleccionada = computed<Record<string, boolean>>({
   get: () => (asignaturaSeleccionada.value ? { [String(asignaturaSeleccionada.value.asignaturaId)]: true } : {}),
   set: (valor) => {
      const id = Object.keys(valor).find((clave) => valor[clave])
      asignaturaSeleccionada.value = id ? (asignaturas.value.find((a) => String(a.asignaturaId) === id) ?? null) : null
   },
})

watch(asignaturas, () => {
   if (asignaturaSeleccionada.value) {
      asignaturaSeleccionada.value =
         asignaturas.value.find((a) => a.asignaturaId === asignaturaSeleccionada.value!.asignaturaId) ?? null
   }
})

function labelProfesores(paralelo: AsignaturaReporte['paralelos'][number]) {
   const nombres = new Map<number, string>()
   for (const sesion of paralelo.sesiones) {
      if (sesion.profesor) nombres.set(sesion.profesor.id, `${sesion.profesor.nombre} ${sesion.profesor.apellido}`)
   }
   return [...nombres.values()]
}

const columnas: TableColumn<AsignaturaReporte>[] = [
   { id: 'asignatura', header: 'Asignatura' },
   { id: 'semestre', header: 'Semestre', size: 100 },
   { id: 'cantidadParalelos', header: 'Paralelos', size: 100 },
]

const { paginaActual, itemsPagina: asignaturasPagina, porPagina } = usePaginacion(asignaturas)
</script>

<template>
   <div class="space-y-6">
      <p class="text-sm text-usm-text-muted dark:text-slate-400">
         Asignaturas que se dictan en un plan y semestre, con la cantidad de paralelos de cada una. Al hacer click se
         muestra el horario de cada paralelo y sus profesores asignados.
      </p>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
         <USelect
            v-model="carreraSeleccionada"
            :items="opcionesCarrera"
            value-key="value"
            placeholder="Carrera"
            class="w-full sm:w-64"
         />
         <USelect
            v-model="planSeleccionadoId"
            :items="opcionesPlan"
            value-key="value"
            placeholder="Plan"
            class="w-full sm:w-56"
         />
         <USelect
            v-model="semestreSeleccionadoId"
            :items="opcionesSemestre"
            value-key="value"
            placeholder="Semestre"
            class="w-full sm:w-48"
         />
      </div>

      <TableSkeleton v-if="statusOpciones === 'pending'" :rows="6" />

      <div v-else class="lg:grid lg:grid-cols-[1fr_400px] lg:items-start lg:gap-6">
         <div class="space-y-6">
            <div class="overflow-hidden rounded-2xl border border-default bg-default">
               <EmptyState
                  v-if="!cargandoReporte && !asignaturas.length"
                  icon="i-lucide-layers"
                  message="No hay asignaturas con paralelos en ese plan y semestre."
               />
               <TableSkeleton v-else-if="cargandoReporte" :rows="5" />
               <UTable
                  v-else
                  v-model:row-selection="filaSeleccionada"
                  :data="asignaturasPagina"
                  :columns="columnas"
                  :get-row-id="(row) => String(row.asignaturaId)"
                  @select="(_e, row) => seleccionarAsignatura(row)"
               >
                  <template #asignatura-cell="{ row }">
                     <span class="text-usm-text dark:text-white"
                        >{{ row.original.codigo }} · {{ row.original.nombre }}</span
                     >
                  </template>
                  <template #semestre-cell="{ row }">
                     <UBadge variant="subtle" :color="row.original.esElectiva ? 'warning' : 'neutral'">
                        {{ row.original.esElectiva ? 'Electivo' : row.original.semestre }}
                     </UBadge>
                  </template>
                  <template #cantidadParalelos-cell="{ row }">
                     <UBadge variant="subtle" color="neutral">{{ row.original.cantidadParalelos }}</UBadge>
                  </template>
               </UTable>
            </div>

            <div v-if="asignaturas.length > porPagina" class="flex justify-center">
               <UPagination v-model:page="paginaActual" :total="asignaturas.length" :items-per-page="porPagina" />
            </div>
         </div>

         <!-- Panel de detalle: horario por paralelo de la asignatura seleccionada -->
         <div class="mt-6 space-y-3 lg:sticky lg:top-6 lg:mt-0">
            <h3 class="font-semibold text-usm-text dark:text-white">Detalle de la asignatura</h3>
            <div v-if="asignaturaSeleccionada" class="space-y-3">
               <div class="rounded-2xl border border-default bg-default p-4">
                  <div class="mb-3 flex items-start justify-between gap-2">
                     <p class="truncate text-sm font-semibold text-usm-text dark:text-white">
                        {{ asignaturaSeleccionada.codigo }} · {{ asignaturaSeleccionada.nombre }}
                     </p>
                     <UButton
                        icon="i-lucide-x"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        aria-label="Cerrar"
                        @click="
                           () => {
                              asignaturaSeleccionada = null
                           }
                        "
                     />
                  </div>

                  <div class="space-y-2.5">
                     <div
                        v-for="paralelo in asignaturaSeleccionada.paralelos"
                        :key="paralelo.paraleloId"
                        class="rounded-lg border border-default p-2.5 text-xs"
                     >
                        <div class="mb-1 flex items-start justify-between gap-2">
                           <p class="font-medium text-usm-text dark:text-white">Paralelo {{ paralelo.codigo }}</p>
                           <UBadge variant="subtle" color="neutral" class="shrink-0">{{ paralelo.cursoNombre }}</UBadge>
                        </div>

                        <p class="mb-1.5 text-usm-text-muted dark:text-slate-400">
                           <template v-if="labelProfesores(paralelo).length">
                              {{ labelProfesores(paralelo).join(', ') }}
                           </template>
                           <template v-else>Sin profesor asignado</template>
                        </p>

                        <EmptyState
                           v-if="!paralelo.sesiones.length"
                           icon="i-lucide-calendar-off"
                           message="Sin horario definido."
                        />
                        <ul v-else class="space-y-1">
                           <li
                              v-for="(sesion, i) in paralelo.sesiones"
                              :key="i"
                              class="rounded-md border border-default p-1.5 text-usm-text dark:text-slate-200"
                           >
                              {{ nombreCortoDia(sesion.diaSemana) }}
                              <template v-if="sesion.bloqueNumeroInicio !== null">
                                 · Bloque N° {{ sesion.bloqueNumeroInicio
                                 }}<template v-if="sesion.bloqueNumeroFin !== sesion.bloqueNumeroInicio"
                                    >–{{ sesion.bloqueNumeroFin }}</template
                                 >
                                 ({{ sesion.horaInicio }}–{{ sesion.horaFin }})
                              </template>
                              <template v-if="sesion.salaCodigo"> · Sala {{ sesion.salaCodigo }}</template>
                           </li>
                        </ul>
                     </div>
                  </div>
               </div>
            </div>
            <EmptyState
               v-else
               icon="i-lucide-mouse-pointer-click"
               message="Haz click en una asignatura para ver el horario de sus paralelos."
            />
         </div>
      </div>
   </div>
</template>
