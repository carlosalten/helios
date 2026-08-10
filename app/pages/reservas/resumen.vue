<script setup lang="ts">
import type { ResumenReservas, ReservaResumenItem } from '~/types/reservaResumen'
import { TIPOS_RESERVA_HORARIO } from '~/types/reservaResumen'

// La fecha va calculada en el cliente para que "hoy" sea el día del usuario (mismo criterio
// que /api/dashboard — ver app/pages/index.vue). Se fija una sola vez al montar.
function formatFechaISO(d: Date) {
   const anio = d.getFullYear()
   const mes = String(d.getMonth() + 1).padStart(2, '0')
   const dia = String(d.getDate()).padStart(2, '0')
   return `${anio}-${mes}-${dia}`
}
const hoyISO = formatFechaISO(new Date())

const { data: resumen, status } = await useFetch<ResumenReservas>(`/api/reservas/resumen?hoy=${hoyISO}`)

// Por defecto se excluyen Clase y Ayudantía: son el uso normal del horario (agendado desde
// /paralelos/asignacion), no una reserva puntual. Esta opción los suma a las 3 vistas.
const incluirClasesAyudantias = ref(false)

const reservasFiltradas = computed(() => {
   const lista = resumen.value?.reservas ?? []
   if (incluirClasesAyudantias.value) return lista
   return lista.filter((r) => !TIPOS_RESERVA_HORARIO.includes(r.tipoReserva.nombre))
})

function enHoy(r: ReservaResumenItem) {
   return r.fecha === resumen.value?.hoy
}
function enSemana(r: ReservaResumenItem) {
   if (!resumen.value) return false
   return r.fecha >= resumen.value.semana.desde && r.fecha <= resumen.value.semana.hasta
}
function enMes(r: ReservaResumenItem) {
   if (!resumen.value) return false
   return r.fecha >= resumen.value.mes.desde && r.fecha <= resumen.value.mes.hasta
}

interface GrupoTipo {
   tipo: { id: number; nombre: string; color: string }
   hoy: ReservaResumenItem[]
   semana: ReservaResumenItem[]
   mes: ReservaResumenItem[]
}

// "Semana" y "mes" son ventanas que se solapan con "hoy" (no tramos exclusivos): una reserva
// de hoy cuenta también en la semana y en el mes, como en el resto de los indicadores "hoy"
// de la app (ver /api/dashboard).
const grupos = computed<GrupoTipo[]>(() => {
   const porTipo = new Map<number, GrupoTipo>()
   for (const r of reservasFiltradas.value) {
      const grupo = porTipo.get(r.tipoReserva.id) ?? { tipo: r.tipoReserva, hoy: [], semana: [], mes: [] }
      if (enMes(r)) grupo.mes.push(r)
      if (enSemana(r)) grupo.semana.push(r)
      if (enHoy(r)) grupo.hoy.push(r)
      porTipo.set(r.tipoReserva.id, grupo)
   }
   return [...porTipo.values()].sort((a, b) => a.tipo.nombre.localeCompare(b.tipo.nombre))
})

const MESES_ABREVIADOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function formatFechaCorta(iso: string) {
   const [, mes, dia] = iso.split('-')
   return `${Number(dia)} ${MESES_ABREVIADOS[Number(mes) - 1]}`
}
</script>

<template>
   <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Reservas agendadas para hoy, esta semana y este mes, agrupadas por tipo de reserva.
         </p>
         <USwitch v-model="incluirClasesAyudantias" label="Mostrar clases y ayudantías" />
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="6" />

      <template v-else>
         <EmptyState v-if="!grupos.length" icon="i-lucide-calendar" message="No hay reservas en este período." />

         <template v-else>
            <!-- Resumen numérico -->
            <div class="overflow-x-auto rounded-2xl border border-default bg-default">
               <table class="w-full min-w-md text-sm">
                  <thead>
                     <tr class="border-b border-default text-left text-xs text-usm-text-muted dark:text-slate-400">
                        <th class="px-4 py-3 font-medium">Tipo</th>
                        <th class="px-4 py-3 text-center font-medium">Hoy</th>
                        <th class="px-4 py-3 text-center font-medium">Esta semana</th>
                        <th class="px-4 py-3 text-center font-medium">Este mes</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr v-for="g in grupos" :key="g.tipo.id" class="border-b border-default last:border-b-0">
                        <td class="px-4 py-2.5">
                           <span class="inline-flex items-center gap-2">
                              <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: g.tipo.color }" />
                              <span class="text-usm-text dark:text-white">{{ g.tipo.nombre }}</span>
                           </span>
                        </td>
                        <td class="px-4 py-2.5 text-center">
                           <UBadge variant="subtle" color="neutral">{{ g.hoy.length }}</UBadge>
                        </td>
                        <td class="px-4 py-2.5 text-center">
                           <UBadge variant="subtle" color="neutral">{{ g.semana.length }}</UBadge>
                        </td>
                        <td class="px-4 py-2.5 text-center">
                           <UBadge variant="subtle" color="neutral">{{ g.mes.length }}</UBadge>
                        </td>
                     </tr>
                  </tbody>
               </table>
            </div>

            <!-- Detalle por tipo -->
            <div class="space-y-4">
               <div
                  v-for="g in grupos"
                  :key="g.tipo.id"
                  class="rounded-2xl border border-default bg-default p-4 sm:p-5"
               >
                  <div class="mb-3 flex items-center gap-2">
                     <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: g.tipo.color }" />
                     <h3 class="font-semibold text-usm-text dark:text-white">{{ g.tipo.nombre }}</h3>
                  </div>
                  <div class="grid gap-4 lg:grid-cols-3">
                     <div>
                        <p class="mb-2 text-xs font-semibold text-usm-text-muted dark:text-slate-400">
                           Hoy ({{ g.hoy.length }})
                        </p>
                        <p v-if="!g.hoy.length" class="text-xs text-usm-text-muted/70 dark:text-slate-500">
                           Sin reservas.
                        </p>
                        <ul v-else class="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                           <li v-for="r in g.hoy" :key="r.id" class="rounded-lg border border-default p-2 text-xs">
                              <p class="truncate font-medium text-usm-text dark:text-white">{{ r.titulo }}</p>
                              <p class="text-usm-text-muted dark:text-slate-400">
                                 {{ r.inicio }}–{{ r.fin }} · Sala {{ r.salaCodigo }}
                              </p>
                              <p v-if="r.persona" class="text-usm-text-muted dark:text-slate-400">
                                 {{ r.persona.nombre }} {{ r.persona.apellido }}
                              </p>
                           </li>
                        </ul>
                     </div>
                     <div>
                        <p class="mb-2 text-xs font-semibold text-usm-text-muted dark:text-slate-400">
                           Esta semana ({{ g.semana.length }})
                        </p>
                        <p v-if="!g.semana.length" class="text-xs text-usm-text-muted/70 dark:text-slate-500">
                           Sin reservas.
                        </p>
                        <ul v-else class="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                           <li v-for="r in g.semana" :key="r.id" class="rounded-lg border border-default p-2 text-xs">
                              <p class="truncate font-medium text-usm-text dark:text-white">{{ r.titulo }}</p>
                              <p class="text-usm-text-muted dark:text-slate-400">
                                 {{ formatFechaCorta(r.fecha) }} · {{ r.inicio }}–{{ r.fin }} · Sala {{ r.salaCodigo }}
                              </p>
                              <p v-if="r.persona" class="text-usm-text-muted dark:text-slate-400">
                                 {{ r.persona.nombre }} {{ r.persona.apellido }}
                              </p>
                           </li>
                        </ul>
                     </div>
                     <div>
                        <p class="mb-2 text-xs font-semibold text-usm-text-muted dark:text-slate-400">
                           Este mes ({{ g.mes.length }})
                        </p>
                        <p v-if="!g.mes.length" class="text-xs text-usm-text-muted/70 dark:text-slate-500">
                           Sin reservas.
                        </p>
                        <ul v-else class="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                           <li v-for="r in g.mes" :key="r.id" class="rounded-lg border border-default p-2 text-xs">
                              <p class="truncate font-medium text-usm-text dark:text-white">{{ r.titulo }}</p>
                              <p class="text-usm-text-muted dark:text-slate-400">
                                 {{ formatFechaCorta(r.fecha) }} · {{ r.inicio }}–{{ r.fin }} · Sala {{ r.salaCodigo }}
                              </p>
                              <p v-if="r.persona" class="text-usm-text-muted dark:text-slate-400">
                                 {{ r.persona.nombre }} {{ r.persona.apellido }}
                              </p>
                           </li>
                        </ul>
                     </div>
                  </div>
               </div>
            </div>
         </template>
      </template>
   </div>
</template>
