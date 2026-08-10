<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Plan } from '~/types/plan'
import type { Semestre } from '~/types/semestre'
import type { ProfesorBloques } from '~/types/profesorBloques'
import type { JornadaLaboral } from '~/types/persona'
import { JORNADAS_LABORALES } from '~/types/persona'
import { nombreCortoDia } from '~/types/dia'

const [{ data: planes, status: statusPlanes }, { data: semestres }] = await Promise.all([
   useFetch<Plan[]>('/api/planes'),
   useFetch<Semestre[]>('/api/semestres'),
])

function labelPlan(plan: Plan) {
   return `${plan.carrera.nombre} — Plan N° ${plan.numero}${plan.vigente ? ' · Vigente' : ''}`
}
const opcionesPlan = computed(() => (planes.value ?? []).map((p) => ({ label: labelPlan(p), value: p.id })))
const opcionesSemestre = computed(() => (semestres.value ?? []).map((s) => ({ label: s.nombre, value: s.id })))

const planesSeleccionados = ref<number[]>([])
const semestreSeleccionadoId = ref<number>()
watchEffect(() => {
   if (semestreSeleccionadoId.value == null && semestres.value?.length) {
      semestreSeleccionadoId.value = semestres.value.find((s) => s.vigente)?.id ?? semestres.value[0]!.id
   }
})

const filtrosCompletos = computed(() => !!semestreSeleccionadoId.value && planesSeleccionados.value.length > 0)

const {
   data: profesores,
   status,
   refresh: refrescarProfesores,
} = await useFetch<ProfesorBloques[]>(() => {
   const params = new URLSearchParams()
   params.set('semestreId', String(semestreSeleccionadoId.value ?? 0))
   for (const id of planesSeleccionados.value) params.append('planIds', String(id))
   return `/api/horario/profesores?${params.toString()}`
})

/* ── Aviso de cambios de otros usuarios ──────────────────────
   No se recarga solo: el usuario suele estar comparando la carga de varios profesores, y
   refrescar bajo el cursor le movería la tabla o le vaciaría el panel de detalle abierto.
   Se le avisa y él decide cuándo actualizar.

   Solo interesan los cambios que mueven el conteo de bloques: sesiones y paralelos del
   semestre en pantalla, y altas/bajas/ediciones de personas (que son globales, sin
   semestre). Un cambio de salas no altera este informe. */
const { user } = useUserSession()
const hayCambios = ref(false)
const autoresCambios = ref<string[]>([])
const actualizando = ref(false)

useHorarioTiempoReal((eventos) => {
   const relevantes = eventos.filter(
      (e) =>
         e.autorEmail !== user.value?.email &&
         (e.tipo === 'profesor' ||
            ((e.tipo === 'sesion' || e.tipo === 'paralelo') && e.semestreId === semestreSeleccionadoId.value))
   )
   if (!relevantes.length) return

   hayCambios.value = true
   autoresCambios.value = [...new Set([...autoresCambios.value, ...relevantes.map((e) => e.autorNombre)])]
})

async function actualizar() {
   actualizando.value = true
   try {
      await refrescarProfesores()
      hayCambios.value = false
      autoresCambios.value = []
   } finally {
      actualizando.value = false
   }
}

// Cambiar de filtros trae datos frescos del servidor: el aviso pendiente ya no aplica.
watch([semestreSeleccionadoId, planesSeleccionados], () => {
   hayCambios.value = false
   autoresCambios.value = []
})

const profesoresCompleta = computed(() => (profesores.value ?? []).filter((p) => p.jornadaLaboral === 'COMPLETA'))
const profesoresParcial = computed(() => (profesores.value ?? []).filter((p) => p.jornadaLaboral === 'PARCIAL'))

const {
   paginaActual: paginaCompleta,
   itemsPagina: completaPagina,
   porPagina: porPaginaCompleta,
} = usePaginacion(profesoresCompleta)
const {
   paginaActual: paginaParcial,
   itemsPagina: parcialPagina,
   porPagina: porPaginaParcial,
} = usePaginacion(profesoresParcial)

function labelPlanColumna(planId: number) {
   const plan = planes.value?.find((p) => p.id === planId)
   return plan ? `${plan.carrera.nombreCorto} · Plan N° ${plan.numero}` : `Plan ${planId}`
}

function formatHora(hora: string) {
   return hora.slice(11, 16)
}

function bloquesDelPlan(profesor: ProfesorBloques, planId: number) {
   return profesor.bloquesPorPlan.find((b) => b.planId === planId)?.cantidadBloques ?? 0
}

const columnas = computed<TableColumn<ProfesorBloques>[]>(() => [
   { id: 'profesor', header: 'Profesor' },
   ...planesSeleccionados.value.map((planId) => ({
      id: `plan-${planId}`,
      header: labelPlanColumna(planId),
      size: 140,
   })),
   { accessorKey: 'cantidadBloques', header: 'Total de Hrs.', size: 160 },
])

// Umbrales de alerta sobre la cantidad de bloques asignados: un profesor de jornada
// parcial con carga de jornada completa, o una jefatura (Jefe de Carrera / Director
// Departamento) con una carga docente alta para además llevar la gestión del cargo.
const UMBRAL_BLOQUES_PARCIAL = 22
const UMBRAL_BLOQUES_JEFATURA = 12
const ROLES_JEFATURA = ['Jefe de Carrera', 'Director Departamento']

function colorBloques(profesor: ProfesorBloques) {
   if (profesor.jornadaLaboral === 'PARCIAL' && profesor.cantidadBloques > UMBRAL_BLOQUES_PARCIAL) return 'error'
   if (profesor.rol && ROLES_JEFATURA.includes(profesor.rol) && profesor.cantidadBloques > UMBRAL_BLOQUES_JEFATURA) {
      return 'warning'
   }
   return 'info'
}

function labelJornadaLaboral(jornada: JornadaLaboral) {
   return JORNADAS_LABORALES.find((j) => j.valor === jornada)?.label ?? jornada
}

function colorJornada(jornada: JornadaLaboral) {
   return jornada === 'COMPLETA' ? 'primary' : 'secondary'
}

function tieneTopes(profesor: ProfesorBloques) {
   return profesor.topes.length > 0
}

function filaClase(row: { original: ProfesorBloques }) {
   return tieneTopes(row.original) ? 'bg-error/10 dark:bg-error/15' : ''
}

/* ── Panel de detalle: asignaturas por plan del profesor seleccionado ────── */
const profesorSeleccionado = ref<ProfesorBloques | null>(null)

function seleccionarProfesor(row: { original: ProfesorBloques }) {
   profesorSeleccionado.value = row.original
}
</script>

<template>
   <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Cantidad de bloques horarios con clases asignadas por profesor, para uno o más planes en un semestre.
         </p>
         <AvisoCambios
            :hay-cambios="hayCambios"
            :cargando="actualizando"
            :autores="autoresCambios"
            class="sm:shrink-0"
            @actualizar="actualizar"
         />
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
         <USelectMenu
            v-model="planesSeleccionados"
            multiple
            :items="opcionesPlan"
            value-key="value"
            :loading="statusPlanes === 'pending'"
            placeholder="Selecciona uno o más planes…"
            :search-input="{ placeholder: 'Buscar carrera o número…' }"
            class="w-full sm:w-96"
         />
         <USelect
            v-model="semestreSeleccionadoId"
            :items="opcionesSemestre"
            value-key="value"
            placeholder="Selecciona un semestre…"
            class="w-full sm:w-56"
         />
      </div>

      <EmptyState
         v-if="!filtrosCompletos"
         icon="i-lucide-filter"
         message="Selecciona un semestre y al menos un plan para ver la carga de profesores."
      />

      <TableSkeleton v-else-if="status === 'pending'" :rows="6" />

      <template v-else>
         <EmptyState
            v-if="!profesores?.length"
            icon="i-lucide-user-round"
            message="No hay profesores con clases asignadas para ese semestre y esos planes."
         />

         <template v-else>
            <div class="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6">
               <div class="space-y-6">
                  <!-- Jornada completa -->
                  <div class="space-y-3">
                     <h3 class="font-semibold text-usm-text dark:text-white">Jornada completa</h3>
                     <EmptyState
                        v-if="!profesoresCompleta.length"
                        icon="i-lucide-user-round"
                        message="No hay profesores de jornada completa para ese semestre y esos planes."
                     />
                     <template v-else>
                        <div class="overflow-hidden rounded-2xl border border-default bg-default">
                           <UTable
                              :data="completaPagina"
                              :columns="columnas"
                              :meta="{ class: { tr: (row: { original: ProfesorBloques }) => filaClase(row) } }"
                              @select="(_e, row) => seleccionarProfesor(row)"
                           >
                              <template #profesor-cell="{ row }">
                                 <span class="flex items-center gap-2">
                                    <span class="text-usm-text dark:text-white">
                                       {{ row.original.nombre }} {{ row.original.apellido }}
                                    </span>
                                    <UBadge v-if="tieneTopes(row.original)" variant="subtle" color="error" size="sm">
                                       {{ row.original.topes.length }}
                                       tope{{ row.original.topes.length !== 1 ? 's' : '' }}
                                    </UBadge>
                                 </span>
                              </template>
                              <template
                                 v-for="planId in planesSeleccionados"
                                 :key="planId"
                                 #[`plan-${planId}-cell`]="{ row }"
                              >
                                 <span class="text-usm-text dark:text-white">
                                    {{ bloquesDelPlan(row.original, planId) }}
                                 </span>
                              </template>
                              <template #cantidadBloques-cell="{ row }">
                                 <UBadge variant="subtle" :color="colorBloques(row.original)">
                                    {{ row.original.cantidadBloques }}
                                    <!-- bloque{{ row.original.cantidadBloques !== 1 ? 's' : '' }} -->
                                 </UBadge>
                              </template>
                           </UTable>
                        </div>
                        <div v-if="profesoresCompleta.length > porPaginaCompleta" class="flex justify-center">
                           <UPagination
                              v-model:page="paginaCompleta"
                              :total="profesoresCompleta.length"
                              :items-per-page="porPaginaCompleta"
                           />
                        </div>
                     </template>
                  </div>

                  <!-- Jornada parcial -->
                  <div class="space-y-3">
                     <h3 class="font-semibold text-usm-text dark:text-white">Jornada parcial</h3>
                     <EmptyState
                        v-if="!profesoresParcial.length"
                        icon="i-lucide-user-round"
                        message="No hay profesores de jornada parcial para ese semestre y esos planes."
                     />
                     <template v-else>
                        <div class="overflow-hidden rounded-2xl border border-default bg-default">
                           <UTable
                              :data="parcialPagina"
                              :columns="columnas"
                              :meta="{ class: { tr: (row: { original: ProfesorBloques }) => filaClase(row) } }"
                              @select="(_e, row) => seleccionarProfesor(row)"
                           >
                              <template #profesor-cell="{ row }">
                                 <span class="flex items-center gap-2">
                                    <span class="text-usm-text dark:text-white">
                                       {{ row.original.nombre }} {{ row.original.apellido }}
                                    </span>
                                    <UBadge v-if="tieneTopes(row.original)" variant="subtle" color="error" size="sm">
                                       {{ row.original.topes.length }}
                                       tope{{ row.original.topes.length !== 1 ? 's' : '' }}
                                    </UBadge>
                                 </span>
                              </template>
                              <template
                                 v-for="planId in planesSeleccionados"
                                 :key="planId"
                                 #[`plan-${planId}-cell`]="{ row }"
                              >
                                 <span class="text-usm-text dark:text-white">
                                    {{ bloquesDelPlan(row.original, planId) }}
                                 </span>
                              </template>
                              <template #cantidadBloques-cell="{ row }">
                                 <UBadge variant="subtle" :color="colorBloques(row.original)">
                                    {{ row.original.cantidadBloques }}
                                    <!-- bloque{{ row.original.cantidadBloques !== 1 ? 's' : '' }} -->
                                 </UBadge>
                              </template>
                           </UTable>
                        </div>
                        <div v-if="profesoresParcial.length > porPaginaParcial" class="flex justify-center">
                           <UPagination
                              v-model:page="paginaParcial"
                              :total="profesoresParcial.length"
                              :items-per-page="porPaginaParcial"
                           />
                        </div>
                     </template>
                  </div>
               </div>

               <!-- Panel de detalle del profesor seleccionado -->
               <div class="mt-6 space-y-3 lg:sticky lg:top-6 lg:mt-0">
                  <h3 class="font-semibold text-usm-text dark:text-white">Detalle del profesor</h3>
                  <div v-if="profesorSeleccionado" class="rounded-2xl border border-default bg-default p-4">
                     <div class="mb-3 flex items-start justify-between gap-2">
                        <div class="min-w-0">
                           <p class="truncate text-sm font-semibold text-usm-text dark:text-white">
                              {{ profesorSeleccionado.nombre }} {{ profesorSeleccionado.apellido }}
                           </p>
                           <div class="mt-1 flex flex-wrap items-center gap-1.5">
                              <UBadge
                                 v-if="profesorSeleccionado.jornadaLaboral"
                                 variant="subtle"
                                 :color="colorJornada(profesorSeleccionado.jornadaLaboral)"
                              >
                                 {{ labelJornadaLaboral(profesorSeleccionado.jornadaLaboral) }}
                              </UBadge>
                              <UBadge v-if="profesorSeleccionado.rol" variant="subtle" color="neutral">
                                 {{ profesorSeleccionado.rol }}
                              </UBadge>
                           </div>
                        </div>
                        <UButton
                           icon="i-lucide-x"
                           color="neutral"
                           variant="ghost"
                           size="xs"
                           aria-label="Cerrar"
                           @click="
                              () => {
                                 profesorSeleccionado = null
                              }
                           "
                        />
                     </div>

                     <div class="mb-4 flex items-center justify-between gap-2 rounded-lg border border-default p-2">
                        <p class="text-xs font-semibold text-usm-text-muted dark:text-slate-400">Total de horas</p>
                        <UBadge variant="subtle" :color="colorBloques(profesorSeleccionado)">
                           {{ profesorSeleccionado.cantidadBloques }}
                           <!-- bloque{{ profesorSeleccionado.cantidadBloques !== 1 ? 's' : '' }} -->
                        </UBadge>
                     </div>

                     <div class="space-y-4">
                        <div v-for="plan in profesorSeleccionado.bloquesPorPlan" :key="plan.planId" class="space-y-1.5">
                           <div class="flex items-center justify-between gap-2">
                              <p class="text-xs font-semibold text-usm-text-muted dark:text-slate-400">
                                 {{ labelPlanColumna(plan.planId) }}
                              </p>
                              <UBadge variant="subtle" color="neutral">{{ plan.cantidadBloques }}</UBadge>
                           </div>
                           <div
                              v-for="asignatura in plan.asignaturas"
                              :key="asignatura.asignaturaId"
                              class="rounded-lg border border-default p-2 text-xs"
                           >
                              <p class="truncate font-medium text-usm-text dark:text-white">
                                 {{ asignatura.nombre }}
                              </p>
                              <p class="mb-1.5 text-usm-text-muted dark:text-slate-400">{{ asignatura.codigo }}</p>
                              <div class="flex flex-wrap gap-1.5">
                                 <UBadge
                                    v-for="paralelo in asignatura.paralelos"
                                    :key="paralelo.codigo"
                                    variant="subtle"
                                    color="neutral"
                                 >
                                    {{ paralelo.codigo }} · {{ paralelo.cantidadBloques }} bloque{{
                                       paralelo.cantidadBloques !== 1 ? 's' : ''
                                    }}
                                 </UBadge>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
                  <div v-if="profesorSeleccionado" class="space-y-3 rounded-2xl border border-default bg-default p-4">
                     <div class="flex items-center justify-between gap-2">
                        <p class="text-xs font-semibold text-usm-text-muted dark:text-slate-400">Topes de horario</p>
                        <UBadge variant="subtle" :color="profesorSeleccionado.topes.length > 0 ? 'error' : 'success'">
                           {{
                              profesorSeleccionado.topes.length > 0
                                 ? `${profesorSeleccionado.topes.length} tope${profesorSeleccionado.topes.length !== 1 ? 's' : ''}`
                                 : 'Sin topes'
                           }}
                        </UBadge>
                     </div>

                     <div v-if="profesorSeleccionado.topes.length" class="space-y-2">
                        <div
                           v-for="tope in profesorSeleccionado.topes"
                           :key="`${tope.diaSemana}-${tope.bloqueId}`"
                           class="rounded-lg border border-error/40 bg-error/5 p-2 text-xs"
                        >
                           <p class="mb-1.5 font-medium text-usm-text dark:text-white">
                              {{ nombreCortoDia(tope.diaSemana) }} · Bloque N° {{ tope.bloqueNumero }} ({{
                                 formatHora(tope.bloqueInicio)
                              }}–{{ formatHora(tope.bloqueFin) }})
                           </p>
                           <ul class="space-y-1">
                              <li
                                 v-for="clase in tope.clases"
                                 :key="`${clase.asignaturaId}-${clase.codigoParalelo}`"
                                 class="text-usm-text-muted dark:text-slate-400"
                              >
                                 {{ clase.asignaturaNombre }} ({{ clase.asignaturaCodigo }}) · Paralelo
                                 {{ clase.codigoParalelo }} · {{ labelPlanColumna(clase.planId) }}
                              </li>
                           </ul>
                        </div>
                     </div>
                  </div>
                  <EmptyState
                     v-else
                     icon="i-lucide-mouse-pointer-click"
                     message="Haz click en un profesor para ver el detalle de sus asignaturas por plan."
                  />
               </div>
            </div>
         </template>
      </template>
   </div>
</template>
