<script setup lang="ts">
import type { Plan, AsignaturaConAsignacion } from '~/types/plan'

const toast = useToast()

const { data: planes, status: statusPlanes } = await useFetch<Plan[]>('/api/planes')

/* ── Plan seleccionado ───────────────────────────────────── */
const planSeleccionadoId = ref<number | undefined>(undefined)
const planSeleccionado = computed(() => (planes.value ?? []).find((p) => p.id === planSeleccionadoId.value) ?? null)
const asignaturas = ref<AsignaturaConAsignacion[]>([])
const cargandoAsignaturas = ref(false)

function labelPlan(plan: Plan) {
   return `${plan.carrera.nombre} — Plan N° ${plan.numero}${plan.vigente ? ' · Vigente' : ''}`
}

const opcionesPlan = computed(() => (planes.value ?? []).map((p) => ({ label: labelPlan(p), value: p.id })))

const busquedaAsignatura = ref('')

// La búsqueda solo filtra el panel de disponibles; la malla siempre muestra todas las
// asignaturas ya asignadas a cada semestre, sin importar el término buscado.
const disponibles = computed(() =>
   asignaturas.value.filter(
      (a) =>
         !a.asignado &&
         (normalizarTexto(a.nombre).includes(normalizarTexto(busquedaAsignatura.value)) ||
            normalizarTexto(a.codigo).includes(normalizarTexto(busquedaAsignatura.value)))
   )
)

// Columna del tablero donde vive una asignatura: un número de semestre, o el cuadro de
// Electivos (independiente del semestre — ver AsignaturaPlan.esElectiva). `null` significa
// "fuera del plan" (panel de disponibles).
type ColumnaDestino = number | 'electivos'

function asignaturasDeSemestre(semestre: number) {
   return asignaturas.value.filter((a) => a.asignado && !a.esElectiva && a.semestre === semestre)
}

const electivas = computed(() => asignaturas.value.filter((a) => a.asignado && a.esElectiva))

function asignaturasDeColumna(columna: ColumnaDestino) {
   return columna === 'electivos' ? electivas.value : asignaturasDeSemestre(columna)
}

// Columnas del tablero: al menos las del plan, pero sin ocultar asignaturas que ya
// tuvieran un semestre mayor asignado (p. ej. si se redujo `cantidadSemestres` después).
const columnas = computed(() => {
   if (!planSeleccionado.value) return []
   const maxAsignado = asignaturas.value.reduce(
      (max, a) => (a.asignado && !a.esElectiva ? Math.max(max, a.semestre) : max),
      0
   )
   const total = Math.max(planSeleccionado.value.cantidadSemestres, maxAsignado)
   return Array.from({ length: total }, (_, i) => i + 1)
})

// El cuadro de Electivos, cuando el plan lo tiene habilitado, se dibuja como una columna más
// al final de la misma grilla.
const totalColumnas = computed(() => columnas.value.length + (planSeleccionado.value?.tieneElectivos ? 1 : 0))

async function cargarAsignaturas() {
   if (!planSeleccionado.value) return
   const url: string = `/api/planes/${planSeleccionado.value.id}/asignaturas`
   asignaturas.value = await $fetch<AsignaturaConAsignacion[]>(url)
}

watch(planSeleccionadoId, async () => {
   asignaturas.value = []
   busquedaAsignatura.value = ''
   if (!planSeleccionado.value) return
   cargandoAsignaturas.value = true
   try {
      await cargarAsignaturas()
   } finally {
      cargandoAsignaturas.value = false
   }
})

const asignadasCount = computed(() => asignaturas.value.filter((a) => a.asignado).length)

/* ── Drag and drop ───────────────────────────────────────────────────────
   Arrastra una asignatura desde el panel derecho (disponibles) hasta una columna del
   tablero para asignarla a ese semestre; arrástrala entre columnas para cambiarla de
   semestre; suéltala sobre otra asignatura de una columna para ordenarla antes de esa
   asignatura (soltar en el espacio vacío de la columna la manda al final); o de vuelta
   al panel derecho para quitarla del plan. */
const arrastrando = ref<number | null>(null)
const procesando = ref<number | null>(null)
const sobreId = ref<number | null>(null)

function iniciarArrastre(e: DragEvent, asignaturaId: number) {
   arrastrando.value = asignaturaId
   e.dataTransfer?.setData('text/plain', String(asignaturaId))
   if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function terminarArrastre() {
   arrastrando.value = null
   sobreId.value = null
}

function permiteDrop() {
   return arrastrando.value !== null && procesando.value === null
}

function onDragOver(e: DragEvent) {
   if (!permiteDrop()) return
   e.preventDefault()
   // Si el puntero está sobre el fondo de la columna (no sobre un ítem, que corta la
   // propagación), la asignatura se insertaría al final: no resaltar ningún ítem.
   sobreId.value = null
}

function onDragOverItem(e: DragEvent, asignaturaId: number) {
   if (!permiteDrop()) return
   e.preventDefault()
   e.stopPropagation()
   if (asignaturaId !== arrastrando.value) sobreId.value = asignaturaId
}

// Recalcula y persiste el orden de una columna completa: quita la asignatura movida de
// donde esté, la reinserta antes de `antesDeId` (o al final si no se especifica) y manda
// la lista resultante al backend, que reasigna `orden = índice` para toda la columna.
async function reordenarColumna(columna: ColumnaDestino, asignaturaIdMovido: number, antesDeId?: number) {
   if (!planSeleccionado.value) return
   const lista = asignaturasDeColumna(columna)
   const actual = lista.findIndex((a) => a.id === asignaturaIdMovido)
   if (actual === -1) return
   const [item] = lista.splice(actual, 1)
   if (!item) return
   const destino = antesDeId !== undefined ? lista.findIndex((a) => a.id === antesDeId) : -1
   if (destino === -1) lista.push(item)
   else lista.splice(destino, 0, item)

   const ordenIds = lista.map((a) => a.asignaturaPlanId).filter((id) => id !== null)
   if (ordenIds.length < 2) return

   await $fetch('/api/planes/asignacion/reordenar', {
      method: 'POST',
      body: {
         planId: planSeleccionado.value.id,
         // `semestre` no se usa para agrupar cuando esElectiva es true (ver reordenar.post.ts);
         // igual debe ir con un valor válido (>=1) por la constraint de BD.
         semestre: columna === 'electivos' ? 1 : columna,
         esElectiva: columna === 'electivos',
         ordenIds,
      },
   })
}

async function moverAsignatura(asignaturaId: number, columnaDestino: ColumnaDestino | null, antesDeId?: number) {
   if (!planSeleccionado.value) return
   const asignatura = asignaturas.value.find((a) => a.id === asignaturaId)
   if (!asignatura) return
   if (columnaDestino === null && !asignatura.asignado) return

   const mismaColumna =
      columnaDestino !== null &&
      asignatura.asignado &&
      (columnaDestino === 'electivos'
         ? asignatura.esElectiva
         : !asignatura.esElectiva && asignatura.semestre === columnaDestino)
   if (mismaColumna && antesDeId === undefined) return

   const esElectiva = columnaDestino === 'electivos'
   // El semestre real solo importa para columnas numeradas; en Electivos se conserva el que
   // la asignatura ya tuviera (o el que trae por defecto si es nueva) solo para satisfacer la
   // constraint de BD, sin efecto funcional.
   const semestre = columnaDestino === 'electivos' || columnaDestino === null ? asignatura.semestre : columnaDestino

   procesando.value = asignaturaId
   try {
      if (columnaDestino === null) {
         // Quitar del plan.
         await $fetch('/api/planes/asignacion/toggle', {
            method: 'POST',
            body: { planId: planSeleccionado.value.id, asignaturaId, semestre, esElectiva: asignatura.esElectiva },
         })
      } else if (mismaColumna) {
         // Reordenar dentro de la misma columna: no cambia asignación ni columna.
         await reordenarColumna(columnaDestino, asignaturaId, antesDeId)
      } else if (!asignatura.asignado) {
         // Asignar directo a la columna destino.
         await $fetch('/api/planes/asignacion/toggle', {
            method: 'POST',
            body: { planId: planSeleccionado.value.id, asignaturaId, semestre, esElectiva },
         })
         await cargarAsignaturas() // trae el asignaturaPlanId recién creado
         await reordenarColumna(columnaDestino, asignaturaId, antesDeId)
      } else if (asignatura.asignaturaPlanId) {
         // Cambiar de columna (semestre y/o Electivos).
         await $fetch(`/api/asignaturas-plan/${asignatura.asignaturaPlanId}`, {
            method: 'PATCH',
            body: { semestre, esElectiva },
         })
         await cargarAsignaturas() // trae la asignatura ya en su nueva columna
         await reordenarColumna(columnaDestino, asignaturaId, antesDeId)
      }
      await cargarAsignaturas() // sincroniza el `orden` recién persistido
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al actualizar la asignación'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      procesando.value = null
   }
}

function onDropColumna(e: DragEvent, columna: ColumnaDestino) {
   if (!permiteDrop()) return
   e.preventDefault()
   const id = arrastrando.value
   arrastrando.value = null
   sobreId.value = null
   if (id !== null) moverAsignatura(id, columna)
}

function onDropItem(e: DragEvent, columna: ColumnaDestino, targetId: number) {
   if (!permiteDrop()) return
   e.preventDefault()
   e.stopPropagation()
   const id = arrastrando.value
   arrastrando.value = null
   sobreId.value = null
   if (id !== null && id !== targetId) moverAsignatura(id, columna, targetId)
}

function onDropDisponibles(e: DragEvent) {
   if (!permiteDrop()) return
   e.preventDefault()
   const id = arrastrando.value
   arrastrando.value = null
   sobreId.value = null
   if (id !== null) moverAsignatura(id, null)
}
</script>

<template>
   <div class="space-y-6">
      <div>
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Selecciona un plan de carrera y arrastra sus asignaturas al semestre en que se dictan
         </p>
      </div>

      <USelectMenu
         v-model="planSeleccionadoId"
         :items="opcionesPlan"
         value-key="value"
         :loading="statusPlanes === 'pending'"
         placeholder="Selecciona un plan…"
         :search-input="{ placeholder: 'Buscar carrera o número…' }"
         class="w-full sm:w-96"
      />

      <div class="lg:grid lg:grid-cols-[1fr_280px] lg:items-start lg:gap-6">
         <!-- Panel central: tablero de semestres -->
         <div class="min-w-0">
            <EmptyState
               v-if="!planSeleccionado"
               icon="i-lucide-mouse-pointer-click"
               message="Selecciona un plan para ver y organizar sus semestres"
            />

            <div v-else class="space-y-4">
               <div>
                  <h3 class="font-semibold text-usm-text dark:text-white">
                     {{ planSeleccionado.carrera.nombre }} — Plan N° {{ planSeleccionado.numero }}
                  </h3>
                  <p class="text-sm text-usm-text-muted dark:text-slate-400">
                     <span class="font-medium text-usm-blue dark:text-usm-cyan">
                        {{ asignadasCount }} asignatura{{ asignadasCount !== 1 ? 's' : '' }} asociada{{
                           asignadasCount !== 1 ? 's' : ''
                        }}
                     </span>
                     · Arrastra una asignatura desde la derecha hacia su semestre, u ordénalas arrastrándolas dentro de
                     la misma columna
                  </p>
               </div>

               <TableSkeleton v-if="cargandoAsignaturas" :rows="5" />

               <div
                  v-else
                  class="grid gap-3 overflow-x-auto pb-2"
                  :style="{ gridTemplateColumns: `repeat(${totalColumnas}, minmax(11.875rem, 1fr))` }"
               >
                  <div
                     v-for="semestre in columnas"
                     :key="semestre"
                     class="flex flex-col rounded-2xl border border-default bg-muted/40 p-2 transition-colors duration-150"
                     :class="permiteDrop() ? 'outline-2 -outline-offset-2 outline-usm-blue/40' : ''"
                     @dragover="onDragOver"
                     @drop="onDropColumna($event, semestre)"
                  >
                     <p class="mb-2 px-1 text-xs font-semibold text-usm-text-muted dark:text-slate-400">
                        Semestre {{ semestre }}
                     </p>
                     <div class="min-h-20 flex-1 space-y-2">
                        <p
                           v-if="!asignaturasDeSemestre(semestre).length"
                           class="py-6 text-center text-[11px] text-usm-text-muted/60 dark:text-slate-500"
                        >
                           Sin asignaturas
                        </p>
                        <div
                           v-for="asignatura in asignaturasDeSemestre(semestre)"
                           :key="asignatura.id"
                           draggable="true"
                           class="cursor-grab rounded-lg border border-default bg-default p-2 text-xs shadow-sm transition-[opacity,box-shadow] active:cursor-grabbing"
                           :class="[
                              procesando === asignatura.id ? 'pointer-events-none opacity-50' : '',
                              sobreId === asignatura.id
                                 ? '-translate-y-0.5 shadow-[0_-2px_0_0_var(--color-usm-blue)]'
                                 : '',
                           ]"
                           @dragstart="iniciarArrastre($event, asignatura.id)"
                           @dragend="terminarArrastre"
                           @dragover="onDragOverItem($event, asignatura.id)"
                           @drop="onDropItem($event, semestre, asignatura.id)"
                        >
                           <UTooltip
                              :text="asignatura.nombre"
                              :ui="{ content: 'h-auto max-w-64 items-start py-1.5', text: 'text-wrap' }"
                           >
                              <p class="truncate font-medium text-usm-text dark:text-white">{{ asignatura.nombre }}</p>
                           </UTooltip>
                           <p class="truncate text-usm-text-muted dark:text-slate-400">{{ asignatura.codigo }}</p>
                        </div>
                     </div>
                  </div>

                  <!-- Cuadro de Electivos: solo si el plan lo tiene habilitado. Una asignatura
                     aquí se puede asignar a un curso de cualquier semestre en /paralelos/asignacion. -->
                  <div
                     v-if="planSeleccionado.tieneElectivos"
                     class="flex flex-col rounded-2xl border border-usm-purple-200 bg-usm-purple-50/40 p-2 transition-colors duration-150 dark:border-usm-purple-900 dark:bg-usm-purple-950/20"
                     :class="permiteDrop() ? 'outline-2 -outline-offset-2 outline-usm-blue/40' : ''"
                     @dragover="onDragOver"
                     @drop="onDropColumna($event, 'electivos')"
                  >
                     <p class="mb-2 px-1 text-xs font-semibold text-usm-purple-700 dark:text-usm-purple-300">
                        Electivos
                     </p>
                     <div class="min-h-20 flex-1 space-y-2">
                        <p
                           v-if="!electivas.length"
                           class="py-6 text-center text-[11px] text-usm-text-muted/60 dark:text-slate-500"
                        >
                           Sin electivos
                        </p>
                        <div
                           v-for="asignatura in electivas"
                           :key="asignatura.id"
                           draggable="true"
                           class="cursor-grab rounded-lg border border-default bg-default p-2 text-xs shadow-sm transition-[opacity,box-shadow] active:cursor-grabbing"
                           :class="[
                              procesando === asignatura.id ? 'pointer-events-none opacity-50' : '',
                              sobreId === asignatura.id
                                 ? '-translate-y-0.5 shadow-[0_-2px_0_0_var(--color-usm-blue)]'
                                 : '',
                           ]"
                           @dragstart="iniciarArrastre($event, asignatura.id)"
                           @dragend="terminarArrastre"
                           @dragover="onDragOverItem($event, asignatura.id)"
                           @drop="onDropItem($event, 'electivos', asignatura.id)"
                        >
                           <UTooltip
                              :text="asignatura.nombre"
                              :ui="{ content: 'h-auto max-w-64 items-start py-1.5', text: 'text-wrap' }"
                           >
                              <p class="truncate font-medium text-usm-text dark:text-white">{{ asignatura.nombre }}</p>
                           </UTooltip>
                           <p class="truncate text-usm-text-muted dark:text-slate-400">{{ asignatura.codigo }}</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <!-- Panel derecho: asignaturas disponibles -->
         <div class="mt-6 space-y-3 lg:mt-0">
            <UInput
               v-model="busquedaAsignatura"
               icon="i-lucide-search"
               placeholder="Buscar asignatura…"
               class="w-full"
            />

            <div
               class="rounded-2xl border border-default bg-muted/40 p-2 transition-colors duration-150"
               :class="permiteDrop() ? 'outline-2 -outline-offset-2 outline-usm-blue/40' : ''"
               @dragover="onDragOver"
               @drop="onDropDisponibles"
            >
               <p class="mb-2 px-1 text-xs font-semibold text-usm-text-muted dark:text-slate-400">Disponibles</p>
               <div class="min-h-20 space-y-2">
                  <p
                     v-if="!planSeleccionado"
                     class="py-6 text-center text-[11px] text-usm-text-muted/60 dark:text-slate-500"
                  >
                     Selecciona un plan
                  </p>
                  <p
                     v-else-if="!disponibles.length"
                     class="py-6 text-center text-[11px] text-usm-text-muted/60 dark:text-slate-500"
                  >
                     Todas las asignaturas están asignadas
                  </p>
                  <div
                     v-for="asignatura in disponibles"
                     :key="asignatura.id"
                     draggable="true"
                     class="cursor-grab rounded-lg border border-default bg-default p-2 text-xs shadow-sm transition-opacity active:cursor-grabbing"
                     :class="procesando === asignatura.id ? 'pointer-events-none opacity-50' : ''"
                     @dragstart="iniciarArrastre($event, asignatura.id)"
                     @dragend="terminarArrastre"
                  >
                     <UTooltip
                        :text="asignatura.nombre"
                        :ui="{ content: 'h-auto max-w-64 items-start py-1.5', text: 'text-wrap' }"
                     >
                        <p class="truncate font-medium text-usm-text dark:text-white">{{ asignatura.nombre }}</p>
                     </UTooltip>
                     <p class="truncate text-usm-text-muted dark:text-slate-400">{{ asignatura.codigo }}</p>
                  </div>
               </div>
            </div>
         </div>
      </div>
   </div>
</template>
