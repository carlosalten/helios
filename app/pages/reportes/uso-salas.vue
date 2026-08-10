<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ReporteUsoSalas, UsoSala } from '~/types/usoSalas'
import { DIAS_SEMANA } from '~/types/dia'

definePageMeta({ layout: 'default' })

const { data: reporte, status } = await useFetch<ReporteUsoSalas>('/api/reportes/uso-salas')

const busqueda = ref('')
const salasFiltradas = computed(() => {
   const q = normalizarTexto(busqueda.value.trim())
   const lista = reporte.value?.salas ?? []
   return q
      ? lista.filter((s) => normalizarTexto(s.codigo).includes(q) || normalizarTexto(s.tipoSala).includes(q))
      : lista
})

const { paginaActual, itemsPagina: salasPagina, porPagina } = usePaginacion(salasFiltradas)

const columnas: TableColumn<UsoSala>[] = [
   { accessorKey: 'codigo', header: 'Sala' },
   { id: 'tipo', header: 'Tipo' },
   { accessorKey: 'capacidad', header: 'Capacidad', size: 100 },
   { id: 'uso', header: '% de uso', size: 220 },
   { id: 'libres', header: 'Bloques libres', size: 130 },
   { id: 'detalle', header: '', size: 90 },
]

// Color de la barra: rojo cuando casi no queda espacio libre, ámbar en un uso medio-alto,
// verde el resto — mismo criterio de lectura rápida que el resto del dashboard.
function colorUso(porcentaje: number) {
   if (porcentaje >= 85) return 'bg-usm-red'
   if (porcentaje >= 60) return 'bg-usm-yellow-500'
   return 'bg-usm-green'
}

/* ── Detalle de una sala (modal) ─────────────────────────────────────────── */
const salaSeleccionada = ref<UsoSala | null>(null)
const modalDetalleMostrar = ref(false)

function abrirDetalle(sala: UsoSala) {
   salaSeleccionada.value = sala
   modalDetalleMostrar.value = true
}

// Bloques libres agrupados por día, en el orden de DIAS_SEMANA (no el de llegada del API).
const bloquesLibresPorDia = computed(() => {
   const sala = salaSeleccionada.value
   if (!sala) return []
   return DIAS_SEMANA.map((dia) => ({
      dia,
      bloques: sala.bloquesLibresDetalle
         .filter((b) => b.diaSemana === dia.valor)
         .sort((a, b) => a.bloqueNumero - b.bloqueNumero),
   })).filter((grupo) => grupo.bloques.length > 0)
})
</script>

<template>
   <div class="space-y-6">
      <p class="text-sm text-usm-text-muted dark:text-slate-400">
         Uso del horario semanal de cada sala en el semestre vigente: qué porcentaje está comprometido, qué bloques
         quedan libres, y en qué se usa (tipo de reserva y carrera).
      </p>

      <TableSkeleton v-if="status === 'pending'" :rows="6" />

      <EmptyState
         v-else-if="!reporte?.semestre"
         icon="i-lucide-calendar-x"
         message="No hay un semestre marcado como vigente. Marca uno en la sección Semestres para calcular el uso de salas."
      />

      <template v-else-if="reporte.resumen">
         <!-- Resumen -->
         <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div class="rounded-2xl border border-default bg-default p-5">
               <p class="text-2xl font-bold text-usm-text dark:text-white">{{ reporte.resumen.totalSalas }}</p>
               <p class="text-xs text-usm-text-muted dark:text-slate-400">Salas en total</p>
            </div>
            <div class="rounded-2xl border border-default bg-default p-5">
               <p class="text-2xl font-bold text-usm-text dark:text-white">{{ reporte.resumen.usoPromedio }}%</p>
               <p class="text-xs text-usm-text-muted dark:text-slate-400">Uso promedio del horario semanal</p>
            </div>
            <div class="rounded-2xl border border-default bg-default p-5">
               <p class="truncate text-2xl font-bold text-usm-text dark:text-white">
                  {{ reporte.resumen.salaMasUsada?.codigo ?? '—' }}
               </p>
               <p class="text-xs text-usm-text-muted dark:text-slate-400">
                  Sala más usada
                  <template v-if="reporte.resumen.salaMasUsada">
                     ({{ reporte.resumen.salaMasUsada.porcentaje }}%)</template
                  >
               </p>
            </div>
            <div class="rounded-2xl border border-default bg-default p-5">
               <p class="truncate text-2xl font-bold text-usm-text dark:text-white">
                  {{ reporte.resumen.salaMenosUsada?.codigo ?? '—' }}
               </p>
               <p class="text-xs text-usm-text-muted dark:text-slate-400">
                  Sala con más disponibilidad
                  <template v-if="reporte.resumen.salaMenosUsada">
                     ({{ reporte.resumen.salaMenosUsada.porcentaje }}%)
                  </template>
               </p>
            </div>
         </div>

         <!-- Uso por tipo / por carrera, a nivel departamento -->
         <div class="grid gap-6 lg:grid-cols-2">
            <div class="rounded-2xl border border-default bg-default p-5 sm:p-6">
               <div class="mb-4 flex items-center gap-2">
                  <UIcon name="i-lucide-tags" class="size-4 text-usm-blue" />
                  <h2 class="text-sm font-semibold text-usm-text dark:text-white">Uso por tipo de reserva</h2>
               </div>
               <p
                  v-if="!reporte.porTipoGeneral.length"
                  class="rounded-xl bg-muted px-4 py-6 text-center text-sm text-usm-text-muted dark:text-slate-400"
               >
                  No hay reservas registradas en este semestre.
               </p>
               <div v-else class="space-y-3">
                  <div v-for="item in reporte.porTipoGeneral" :key="item.nombre">
                     <div class="mb-1 flex items-center justify-between gap-3 text-xs">
                        <span class="flex min-w-0 items-center gap-1.5 font-medium text-usm-text dark:text-slate-200">
                           <span
                              class="size-2 shrink-0 rounded-full"
                              :style="{ backgroundColor: item.color ?? '#94a3b8' }"
                           />
                           <span class="truncate">{{ item.nombre }}</span>
                        </span>
                        <span class="shrink-0 text-usm-text-muted dark:text-slate-400">
                           {{ item.cantidad }} · {{ item.porcentaje }}%
                        </span>
                     </div>
                     <div class="h-1.5 overflow-hidden rounded-full bg-elevated">
                        <div
                           class="h-full rounded-full"
                           :style="{ width: `${item.porcentaje}%`, backgroundColor: item.color ?? '#94a3b8' }"
                        />
                     </div>
                  </div>
               </div>
            </div>

            <div class="rounded-2xl border border-default bg-default p-5 sm:p-6">
               <div class="mb-4 flex items-center gap-2">
                  <UIcon name="i-lucide-graduation-cap" class="size-4 text-usm-purple" />
                  <h2 class="text-sm font-semibold text-usm-text dark:text-white">Uso por carrera</h2>
               </div>
               <p
                  v-if="!reporte.porCarreraGeneral.length"
                  class="rounded-xl bg-muted px-4 py-6 text-center text-sm text-usm-text-muted dark:text-slate-400"
               >
                  No hay reservas registradas en este semestre.
               </p>
               <div v-else class="space-y-3">
                  <div v-for="item in reporte.porCarreraGeneral" :key="item.nombre">
                     <div class="mb-1 flex items-center justify-between gap-3 text-xs">
                        <span class="truncate font-medium text-usm-text dark:text-slate-200">{{ item.nombre }}</span>
                        <span class="shrink-0 text-usm-text-muted dark:text-slate-400">
                           {{ item.cantidad }} · {{ item.porcentaje }}%
                        </span>
                     </div>
                     <div class="h-1.5 overflow-hidden rounded-full bg-elevated">
                        <div class="h-full rounded-full bg-usm-purple" :style="{ width: `${item.porcentaje}%` }" />
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <!-- Tabla por sala -->
         <div class="rounded-2xl border border-default bg-default p-5 sm:p-6">
            <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
               <h2 class="text-sm font-semibold text-usm-text dark:text-white">Uso por sala</h2>
               <UInput
                  v-model="busqueda"
                  icon="i-lucide-search"
                  placeholder="Buscar sala…"
                  size="sm"
                  class="w-full sm:w-64"
               />
            </div>

            <EmptyState v-if="!salasFiltradas.length" icon="i-lucide-door-open" message="No se encontraron salas." />

            <template v-else>
               <UTable :data="salasPagina" :columns="columnas">
                  <template #tipo-cell="{ row }">
                     <UBadge variant="subtle" color="neutral">{{ row.original.tipoSala }}</UBadge>
                  </template>
                  <template #uso-cell="{ row }">
                     <div class="flex items-center gap-2">
                        <div class="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-elevated">
                           <div
                              class="h-full rounded-full"
                              :class="colorUso(row.original.porcentajeUso)"
                              :style="{ width: `${row.original.porcentajeUso}%` }"
                           />
                        </div>
                        <span class="shrink-0 text-xs font-medium text-usm-text dark:text-slate-200">
                           {{ row.original.porcentajeUso }}%
                        </span>
                     </div>
                  </template>
                  <template #libres-cell="{ row }">
                     <span class="text-usm-text-muted dark:text-slate-400">
                        {{ row.original.bloquesLibres }} de {{ row.original.bloquesUniverso }}
                     </span>
                  </template>
                  <template #detalle-cell="{ row }">
                     <div class="flex justify-end">
                        <UTooltip text="Ver detalle">
                           <UButton
                              icon="i-lucide-eye"
                              color="neutral"
                              variant="ghost"
                              size="xs"
                              aria-label="Ver detalle"
                              @click="abrirDetalle(row.original)"
                           />
                        </UTooltip>
                     </div>
                  </template>
               </UTable>

               <div v-if="salasFiltradas.length > porPagina" class="mt-4 flex justify-center">
                  <UPagination v-model:page="paginaActual" :total="salasFiltradas.length" :items-per-page="porPagina" />
               </div>
            </template>
         </div>
      </template>

      <!-- Detalle de sala -->
      <UModal v-model:open="modalDetalleMostrar" :title="`Sala ${salaSeleccionada?.codigo}`">
         <template #body>
            <div v-if="salaSeleccionada" class="space-y-5 text-sm">
               <div class="flex items-center justify-between gap-3">
                  <div>
                     <p class="text-xs text-usm-text-muted dark:text-slate-400">Uso del horario semanal</p>
                     <p class="text-lg font-bold text-usm-text dark:text-white">
                        {{ salaSeleccionada.porcentajeUso }}%
                     </p>
                  </div>
                  <div class="text-right">
                     <p class="text-xs text-usm-text-muted dark:text-slate-400">Bloques libres</p>
                     <p class="text-lg font-bold text-usm-text dark:text-white">
                        {{ salaSeleccionada.bloquesLibres }} / {{ salaSeleccionada.bloquesUniverso }}
                     </p>
                  </div>
               </div>

               <div v-if="salaSeleccionada.porTipo.length">
                  <p class="mb-2 text-xs font-semibold text-usm-text dark:text-white">Uso por tipo</p>
                  <div class="space-y-2">
                     <div v-for="item in salaSeleccionada.porTipo" :key="item.nombre">
                        <div class="mb-1 flex items-center justify-between gap-3 text-xs">
                           <span class="flex min-w-0 items-center gap-1.5 text-usm-text dark:text-slate-200">
                              <span
                                 class="size-2 shrink-0 rounded-full"
                                 :style="{ backgroundColor: item.color ?? '#94a3b8' }"
                              />
                              <span class="truncate">{{ item.nombre }}</span>
                           </span>
                           <span class="shrink-0 text-usm-text-muted dark:text-slate-400">{{ item.porcentaje }}%</span>
                        </div>
                        <div class="h-1.5 overflow-hidden rounded-full bg-elevated">
                           <div
                              class="h-full rounded-full"
                              :style="{ width: `${item.porcentaje}%`, backgroundColor: item.color ?? '#94a3b8' }"
                           />
                        </div>
                     </div>
                  </div>
               </div>

               <div v-if="salaSeleccionada.porCarrera.length">
                  <p class="mb-2 text-xs font-semibold text-usm-text dark:text-white">Uso por carrera</p>
                  <div class="space-y-2">
                     <div v-for="item in salaSeleccionada.porCarrera" :key="item.nombre">
                        <div class="mb-1 flex items-center justify-between gap-3 text-xs">
                           <span class="truncate text-usm-text dark:text-slate-200">{{ item.nombre }}</span>
                           <span class="shrink-0 text-usm-text-muted dark:text-slate-400">{{ item.porcentaje }}%</span>
                        </div>
                        <div class="h-1.5 overflow-hidden rounded-full bg-elevated">
                           <div class="h-full rounded-full bg-usm-purple" :style="{ width: `${item.porcentaje}%` }" />
                        </div>
                     </div>
                  </div>
               </div>

               <div>
                  <p class="mb-2 text-xs font-semibold text-usm-text dark:text-white">Bloques libres por día</p>
                  <p
                     v-if="!bloquesLibresPorDia.length"
                     class="rounded-xl bg-muted px-4 py-6 text-center text-xs text-usm-text-muted dark:text-slate-400"
                  >
                     Esta sala no tiene bloques libres: está comprometida los 7 días de la semana.
                  </p>
                  <div v-else class="max-h-56 space-y-3 overflow-y-auto pe-1">
                     <div v-for="grupo in bloquesLibresPorDia" :key="grupo.dia.valor">
                        <p class="mb-1 text-xs font-medium text-usm-text dark:text-slate-200">{{ grupo.dia.nombre }}</p>
                        <div class="flex flex-wrap gap-1.5">
                           <span
                              v-for="bloque in grupo.bloques"
                              :key="bloque.bloqueId"
                              class="rounded-lg bg-usm-green/10 px-2 py-1 text-xs text-usm-green"
                           >
                              {{ bloque.inicio }}–{{ bloque.fin }}
                           </span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </template>
      </UModal>
   </div>
</template>
