<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AyudantiaResumen } from '~/types/ayudantia'
import { DIAS_SEMANA } from '~/types/dia'
import type { Semestre } from '~/types/semestre'

const { data: ayudantias, status } = await useFetch<AyudantiaResumen[]>('/api/ayudantias/resumen')

function nombreDia(diaSemana: number) {
   return DIAS_SEMANA.find((d) => d.valor === diaSemana)?.nombre ?? String(diaSemana)
}

/* ── Filtros: plan, asignatura y sala — solo se ofrecen los valores que efectivamente
   aparecen entre las ayudantías, no el catálogo completo de la app. ── */
const planFiltro = ref<number | '__todos__'>('__todos__')
const asignaturaFiltro = ref<string | '__todos__'>('__todos__')
const salaFiltro = ref<string | '__todos__'>('__todos__')

const itemsPlan = computed(() => {
   const vistos = new Map<number, string>()
   for (const a of ayudantias.value ?? []) {
      if (!vistos.has(a.planId)) vistos.set(a.planId, `${a.carreraNombre} · Plan N°${a.planNumero}`)
   }
   return [
      { label: 'Todos los planes', value: '__todos__' as const },
      ...Array.from(vistos, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
   ]
})
const itemsAsignatura = computed(() => {
   const vistos = new Map<string, string>()
   for (const a of ayudantias.value ?? []) {
      if (!vistos.has(a.asignaturaCodigo))
         vistos.set(a.asignaturaCodigo, `${a.asignaturaCodigo} · ${a.asignaturaNombre}`)
   }
   return [
      { label: 'Todas las asignaturas', value: '__todos__' as const },
      ...Array.from(vistos, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
   ]
})
const itemsSala = computed(() => {
   const vistos = new Set((ayudantias.value ?? []).map((a) => a.salaCodigo))
   return [
      { label: 'Todas las salas', value: '__todos__' as const },
      ...Array.from(vistos)
         .sort()
         .map((codigo) => ({ label: codigo, value: codigo })),
   ]
})

const ayudantiasFiltradas = computed(() => {
   let lista = ayudantias.value ?? []
   if (planFiltro.value !== '__todos__') lista = lista.filter((a) => a.planId === planFiltro.value)
   if (asignaturaFiltro.value !== '__todos__')
      lista = lista.filter((a) => a.asignaturaCodigo === asignaturaFiltro.value)
   if (salaFiltro.value !== '__todos__') lista = lista.filter((a) => a.salaCodigo === salaFiltro.value)
   return lista
})

function limpiarFiltros() {
   planFiltro.value = '__todos__'
   asignaturaFiltro.value = '__todos__'
   salaFiltro.value = '__todos__'
}

const { paginaActual, itemsPagina: ayudantiasPagina, porPagina } = usePaginacion(ayudantiasFiltradas)

const columnas: TableColumn<AyudantiaResumen>[] = [
   { id: 'carrera', header: 'Carrera / Plan' },
   { id: 'asignatura', header: 'Asignatura' },
   { accessorKey: 'paraleloCodigo', header: 'Paralelo' },
   { id: 'ayudante', header: 'Ayudante' },
   { accessorKey: 'salaCodigo', header: 'Sala' },
   { id: 'horario', header: 'Horario' },
]

/* ── Exportar CSV ───────────────────────────────────────────
   Independiente de los filtros de la tabla: el modal pide semestre (por defecto el vigente) y
   plan, y exporta las ayudantías de los paralelos de ese semestre. Solo se ofrecen los planes
   que tienen ayudantías en el semestre elegido. */
const { data: semestres } = await useFetch<Semestre[]>('/api/semestres')
const { esSemestreSeleccionable } = useVisibilidadSemestre()

const modalExportarAbierto = ref(false)
const semestreExportar = ref<number | undefined>(undefined)
const planExportar = ref<number | '__todos__'>('__todos__')

const semestresExportables = computed(() => (semestres.value ?? []).filter(esSemestreSeleccionable))
const itemsSemestreExportar = computed(() =>
   semestresExportables.value.map((s) => ({ label: s.vigente ? `${s.nombre} (vigente)` : s.nombre, value: s.id }))
)

const ayudantiasSemestreExportar = computed(() =>
   (ayudantias.value ?? []).filter((a) => a.semestreId === semestreExportar.value)
)
const itemsPlanExportar = computed(() => {
   const vistos = new Map<number, string>()
   for (const a of ayudantiasSemestreExportar.value) {
      if (!vistos.has(a.planId)) vistos.set(a.planId, `${a.carreraNombre} · Plan N°${a.planNumero}`)
   }
   return [
      { label: 'Todos los planes', value: '__todos__' as const },
      ...Array.from(vistos, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
   ]
})
const ayudantiasExportar = computed(() =>
   planExportar.value === '__todos__'
      ? ayudantiasSemestreExportar.value
      : ayudantiasSemestreExportar.value.filter((a) => a.planId === planExportar.value)
)

// Al cambiar de semestre el plan elegido puede no tener ayudantías en el nuevo: vuelve a "Todos".
watch(semestreExportar, () => {
   planExportar.value = '__todos__'
})

function abrirExportar() {
   semestreExportar.value = semestresExportables.value.find((s) => s.vigente)?.id ?? semestresExportables.value[0]?.id
   planExportar.value = '__todos__'
   modalExportarAbierto.value = true
}

function exportarCsv() {
   const semestre = semestresExportables.value.find((s) => s.id === semestreExportar.value)
   const encabezados = [
      'Carrera',
      'Plan',
      'Código asignatura',
      'Asignatura',
      'Paralelo',
      'Ayudante',
      'Sala',
      'Día',
      'Inicio',
      'Fin',
   ]
   const filas = ayudantiasExportar.value.map((a) => [
      a.carreraNombre,
      `Plan N°${a.planNumero}`,
      a.asignaturaCodigo,
      a.asignaturaNombre,
      a.paraleloCodigo,
      a.ayudanteNombre ?? 'Sin asignar',
      a.salaCodigo,
      nombreDia(a.diaSemana),
      a.inicio,
      a.fin,
   ])
   const plan = ayudantiasExportar.value.find((a) => a.planId === planExportar.value)
   const sufijoPlan = plan ? `-${plan.carreraCodigo}-plan-${plan.planNumero}` : ''
   descargarCsv(`ayudantias-${semestre?.nombre ?? 'semestre'}${sufijoPlan}.csv`, encabezados, filas)
   modalExportarAbierto.value = false
}
</script>

<template>
   <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Resumen de todas las ayudantías agendadas desde <strong>Ayudantías → Horario de ayudantías</strong>:
            carrera, asignatura, paralelo, ayudante y horario asignado.
         </p>
         <UButton icon="i-lucide-download" variant="outline" color="success" class="shrink-0" @click="abrirExportar">
            Exportar CSV
         </UButton>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="6" />

      <template v-else>
         <div
            class="flex flex-col gap-3 rounded-2xl border border-default bg-default p-4 sm:flex-row sm:flex-wrap sm:items-end"
         >
            <UFormField label="Plan" class="flex-1 sm:min-w-56">
               <USelect v-model="planFiltro" :items="itemsPlan" value-key="value" class="w-full" />
            </UFormField>
            <UFormField label="Asignatura" class="flex-1 sm:min-w-56">
               <USelect v-model="asignaturaFiltro" :items="itemsAsignatura" value-key="value" class="w-full" />
            </UFormField>
            <UFormField label="Sala">
               <USelect v-model="salaFiltro" :items="itemsSala" value-key="value" class="w-full sm:w-40" />
            </UFormField>
            <UButton variant="ghost" color="neutral" icon="i-lucide-x" @click="limpiarFiltros">Limpiar</UButton>
         </div>

         <div class="space-y-3">
            <div class="overflow-hidden rounded-2xl border border-default bg-default">
               <EmptyState
                  v-if="!ayudantiasFiltradas.length"
                  icon="i-lucide-user-check"
                  message="No hay ayudantías que coincidan con el filtro."
               />
               <UTable v-else :data="ayudantiasPagina" :columns="columnas">
                  <template #carrera-cell="{ row }">
                     <div class="min-w-0">
                        <p class="truncate text-usm-text dark:text-white">{{ row.original.carreraNombre }}</p>
                        <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                           Plan N°{{ row.original.planNumero }}
                        </p>
                     </div>
                  </template>
                  <template #asignatura-cell="{ row }">
                     <div class="min-w-0">
                        <p class="truncate text-usm-text dark:text-white">{{ row.original.asignaturaCodigo }}</p>
                        <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                           {{ row.original.asignaturaNombre }}
                        </p>
                     </div>
                  </template>
                  <template #ayudante-cell="{ row }">
                     <span v-if="row.original.ayudanteNombre" class="text-usm-text dark:text-white">
                        {{ row.original.ayudanteNombre }}
                     </span>
                     <span v-else class="text-usm-text-muted italic dark:text-slate-400">Sin asignar</span>
                  </template>
                  <template #horario-cell="{ row }">
                     <span class="text-usm-text dark:text-white">
                        {{ nombreDia(row.original.diaSemana) }} {{ row.original.inicio }}–{{ row.original.fin }}
                     </span>
                  </template>
               </UTable>
            </div>

            <div class="flex items-center justify-between text-xs text-usm-text-muted dark:text-slate-400">
               <span>{{ ayudantiasFiltradas.length }} ayudantía{{ ayudantiasFiltradas.length !== 1 ? 's' : '' }}</span>
            </div>

            <PaginacionTabla
               v-model:page="paginaActual"
               v-model:por-pagina="porPagina"
               :total="ayudantiasFiltradas.length"
            />
         </div>
      </template>

      <UModal v-model:open="modalExportarAbierto" title="Exportar ayudantías a CSV" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-exportar-ayudantias" :state="{}" class="space-y-4" @submit="exportarCsv">
               <UFormField label="Semestre" name="semestre">
                  <USelect
                     v-model="semestreExportar"
                     :items="itemsSemestreExportar"
                     value-key="value"
                     placeholder="Selecciona un semestre"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Plan" name="plan">
                  <USelect v-model="planExportar" :items="itemsPlanExportar" value-key="value" class="w-full" />
               </UFormField>
               <p class="text-xs text-usm-text-muted dark:text-slate-400">
                  {{ ayudantiasExportar.length }} ayudantía{{ ayudantiasExportar.length !== 1 ? 's' : '' }} a exportar.
               </p>
            </UForm>
         </template>
         <template #footer>
            <UButton
               variant="ghost"
               color="neutral"
               @click="
                  () => {
                     modalExportarAbierto = false
                  }
               "
            >
               Cancelar
            </UButton>
            <UButton
               type="submit"
               form="form-exportar-ayudantias"
               icon="i-lucide-download"
               :disabled="!ayudantiasExportar.length"
            >
               Exportar
            </UButton>
         </template>
      </UModal>
   </div>
</template>
