<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AlcanceFeriado, Feriado } from '~/types/feriado'
import { ALCANCES_FERIADO } from '~/types/feriado'
import type { Semestre } from '~/types/semestre'

const toast = useToast()

const [{ data: feriados, status, refresh }, { data: semestres }] = await Promise.all([
   useFetch<Feriado[]>('/api/feriados'),
   useFetch<Semestre[]>('/api/semestres'),
])

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/feriados')

const semestreVigenteId = computed(() => semestres.value?.find((s) => s.vigente)?.id)

const filtroSemestre = ref<number | '__todos__'>(semestreVigenteId.value ?? '__todos__')

const feriadosFiltrados = computed(() => {
   const lista =
      filtroSemestre.value === '__todos__'
         ? (feriados.value ?? [])
         : (feriados.value ?? []).filter((f) => f.semestreId === filtroSemestre.value)
   return [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha))
})

const opcionesSemestre = computed(() => [
   { label: 'Todos los semestres', value: '__todos__' as const },
   ...(semestres.value ?? []).map((s) => ({ label: s.nombre, value: s.id })),
])

const { paginaActual, itemsPagina: feriadosPagina, porPagina } = usePaginacion(feriadosFiltrados)

// Para el <input type="date">, que exige el formato ISO (AAAA-MM-DD).
function formatFechaISO(fecha: string) {
   return fecha.slice(0, 10)
}

// Para mostrar en tabla, título del modal y confirmación de borrado.
function formatFecha(fecha: string) {
   const [anio, mes, dia] = formatFechaISO(fecha).split('-')
   return `${dia}-${mes}-${anio}`
}

const MESES = [
   'Enero',
   'Febrero',
   'Marzo',
   'Abril',
   'Mayo',
   'Junio',
   'Julio',
   'Agosto',
   'Septiembre',
   'Octubre',
   'Noviembre',
   'Diciembre',
]

function nombreMes(fecha: string) {
   const mes = Number(formatFechaISO(fecha).split('-')[1])
   return MESES[mes - 1] ?? ''
}

function formatHora(hora: string) {
   return hora.slice(11, 16)
}

// input type="time" nativo usa el formato 12h/24h del navegador, sin forma confiable de forzar
// 24h entre navegadores (probado: no funciona en Brave) — se enmascara un input de texto en su lugar.
function enmascararHora(valor: string) {
   const digitos = valor.replace(/\D/g, '').slice(0, 4)
   if (digitos.length <= 2) return digitos
   return `${digitos.slice(0, 2)}:${digitos.slice(2)}`
}

const columnas: TableColumn<Feriado>[] = [
   { id: 'mes', header: 'Mes', size: 110 },
   { id: 'fecha', header: 'Fecha', size: 110 },
   { id: 'horario', header: 'Horario' },
   { id: 'alcance', header: 'Alcance', size: 150 },
   { id: 'acciones', header: '', size: 100 },
]

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({
   semestreId: 0,
   fecha: '',
   esDiaCompleto: true,
   horaInicio: '',
   horaTermino: '',
   alcance: 'TOTAL' as AlcanceFeriado,
})
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

function abrirCrear() {
   formCrear.semestreId = semestreVigenteId.value ?? semestres.value?.[0]?.id ?? 0
   formCrear.fecha = ''
   formCrear.esDiaCompleto = true
   formCrear.horaInicio = ''
   formCrear.horaTermino = ''
   formCrear.alcance = 'TOTAL'
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/feriados', {
         method: 'POST',
         body: {
            semestreId: Number(formCrear.semestreId),
            fecha: formCrear.fecha,
            esDiaCompleto: formCrear.esDiaCompleto,
            horaInicio: formCrear.esDiaCompleto ? null : formCrear.horaInicio,
            horaTermino: formCrear.esDiaCompleto ? null : formCrear.horaTermino,
            alcance: formCrear.alcance,
         },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Feriado creado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const feriadoEditar = ref<Feriado | null>(null)
const formEditar = reactive({
   semestreId: 0,
   fecha: '',
   esDiaCompleto: true,
   horaInicio: '',
   horaTermino: '',
   alcance: 'TOTAL' as AlcanceFeriado,
})
const errorEditar = ref<string | null>(null)

function abrirEditar(feriado: Feriado) {
   feriadoEditar.value = feriado
   formEditar.semestreId = feriado.semestreId
   formEditar.fecha = formatFechaISO(feriado.fecha)
   formEditar.esDiaCompleto = !feriado.horaInicio && !feriado.horaTermino
   formEditar.horaInicio = feriado.horaInicio ? formatHora(feriado.horaInicio) : ''
   formEditar.horaTermino = feriado.horaTermino ? formatHora(feriado.horaTermino) : ''
   formEditar.alcance = feriado.alcance
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!feriadoEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/feriados/${feriadoEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: {
            semestreId: Number(formEditar.semestreId),
            fecha: formEditar.fecha,
            esDiaCompleto: formEditar.esDiaCompleto,
            horaInicio: formEditar.esDiaCompleto ? null : formEditar.horaInicio,
            horaTermino: formEditar.esDiaCompleto ? null : formEditar.horaTermino,
            alcance: formEditar.alcance,
         },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Feriado actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const feriadoAEliminar = ref<Feriado | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(feriado: Feriado) {
   feriadoAEliminar.value = feriado
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!feriadoAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/feriados/${feriadoAEliminar.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Feriado eliminado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al eliminar'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      eliminando.value = false
   }
}
</script>

<template>
   <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <div>
            <p class="text-sm text-usm-text-muted dark:text-slate-400">Feriados de cada semestre.</p>
         </div>
         <UButton
            icon="i-lucide-plus"
            class="sm:shrink-0"
            :disabled="!semestres?.length || !puedeCrear"
            @click="abrirCrear"
         >
            Nuevo feriado
         </UButton>
      </div>

      <!-- Filtro por semestre -->
      <div class="flex items-center gap-3">
         <USelect v-model="filtroSemestre" :items="opcionesSemestre" value-key="value" class="w-64" />
         <span class="text-sm text-usm-text-muted dark:text-slate-400">
            {{ feriadosFiltrados.length }} feriado{{ feriadosFiltrados.length !== 1 ? 's' : '' }}
         </span>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="6" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!feriadosFiltrados.length"
            icon="i-lucide-calendar-off"
            message="No hay feriados registrados"
            :action="semestres?.length && filtroSemestre === '__todos__' && puedeCrear ? 'Nuevo feriado' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="feriadosPagina" :columns="columnas">
            <template #mes-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ nombreMes(row.original.fecha) }}</span>
            </template>
            <template #fecha-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ formatFecha(row.original.fecha) }}</span>
            </template>
            <template #semestre-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ row.original.semestre.nombre }}</span>
            </template>
            <template #horario-cell="{ row }">
               <UBadge v-if="!row.original.horaInicio" color="neutral" variant="subtle">Día completo</UBadge>
               <span v-else class="text-usm-text dark:text-white">
                  {{ formatHora(row.original.horaInicio) }}–{{ formatHora(row.original.horaTermino!) }}
               </span>
            </template>
            <template #alcance-cell="{ row }">
               <UBadge :color="row.original.alcance === 'TOTAL' ? 'error' : 'warning'" variant="subtle">
                  {{ row.original.alcance === 'TOTAL' ? 'Todo' : 'Solo clases' }}
               </UBadge>
            </template>
            <template #acciones-cell="{ row }">
               <div class="flex justify-end gap-1">
                  <UTooltip text="Editar">
                     <UButton
                        icon="i-lucide-pen"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        aria-label="Editar"
                        :disabled="!puedeEditar"
                        @click="abrirEditar(row.original)"
                     />
                  </UTooltip>
                  <UTooltip text="Eliminar">
                     <UButton
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        size="xs"
                        aria-label="Eliminar"
                        :disabled="!puedeBorrar"
                        @click="abrirConfirmEliminar(row.original)"
                     />
                  </UTooltip>
               </div>
            </template>
         </UTable>
      </div>

      <div v-if="feriadosFiltrados.length > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="feriadosFiltrados.length" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo feriado" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-feriado-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Semestre" name="semestreId">
                  <USelect
                     v-model="formCrear.semestreId"
                     :items="(semestres ?? []).map((s) => ({ label: s.nombre, value: s.id }))"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Fecha" name="fecha" :error="errorGuardar ?? undefined">
                  <UInput v-model="formCrear.fecha" type="date" class="w-full" />
               </UFormField>
               <UCheckbox
                  v-model="formCrear.esDiaCompleto"
                  label="Día completo"
                  description="Si no marcas esta opción, podrás indicar el rango horario del feriado."
               />
               <div v-if="!formCrear.esDiaCompleto" class="grid grid-cols-2 gap-4">
                  <UFormField label="Hora de inicio" name="horaInicio">
                     <UInput
                        :model-value="formCrear.horaInicio"
                        placeholder="14:30"
                        maxlength="5"
                        icon="i-lucide-clock"
                        class="w-full"
                        @update:model-value="formCrear.horaInicio = enmascararHora(String($event))"
                     />
                  </UFormField>
                  <UFormField label="Hora de término" name="horaTermino">
                     <UInput
                        :model-value="formCrear.horaTermino"
                        placeholder="16:00"
                        maxlength="5"
                        icon="i-lucide-clock"
                        class="w-full"
                        @update:model-value="formCrear.horaTermino = enmascararHora(String($event))"
                     />
                  </UFormField>
               </div>
               <UFormField label="Alcance" name="alcance">
                  <USelect
                     v-model="formCrear.alcance"
                     :items="ALCANCES_FERIADO.map((a) => ({ label: a.label, value: a.valor }))"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
            </UForm>
         </template>
         <template #footer>
            <UButton
               variant="ghost"
               color="neutral"
               @click="
                  () => {
                     modalCrearMostrar = false
                  }
               "
               >Cancelar</UButton
            >
            <UButton type="submit" form="form-feriado-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal
         v-model:open="modalEditarMostrar"
         :title="`Editar feriado ${feriadoEditar ? formatFecha(feriadoEditar.fecha) : ''}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm id="form-feriado-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Semestre" name="semestreId">
                  <USelect
                     v-model="formEditar.semestreId"
                     :items="(semestres ?? []).map((s) => ({ label: s.nombre, value: s.id }))"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Fecha" name="fecha" :error="errorEditar ?? undefined">
                  <UInput v-model="formEditar.fecha" type="date" class="w-full" />
               </UFormField>
               <UCheckbox
                  v-model="formEditar.esDiaCompleto"
                  label="Día completo"
                  description="Si no marcas esta opción, podrás indicar el rango horario del feriado."
               />
               <div v-if="!formEditar.esDiaCompleto" class="grid grid-cols-2 gap-4">
                  <UFormField label="Hora de inicio" name="horaInicio">
                     <UInput
                        :model-value="formEditar.horaInicio"
                        placeholder="14:30"
                        maxlength="5"
                        icon="i-lucide-clock"
                        class="w-full"
                        @update:model-value="formEditar.horaInicio = enmascararHora(String($event))"
                     />
                  </UFormField>
                  <UFormField label="Hora de término" name="horaTermino">
                     <UInput
                        :model-value="formEditar.horaTermino"
                        placeholder="16:00"
                        maxlength="5"
                        icon="i-lucide-clock"
                        class="w-full"
                        @update:model-value="formEditar.horaTermino = enmascararHora(String($event))"
                     />
                  </UFormField>
               </div>
               <UFormField label="Alcance" name="alcance">
                  <USelect
                     v-model="formEditar.alcance"
                     :items="ALCANCES_FERIADO.map((a) => ({ label: a.label, value: a.valor }))"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
            </UForm>
         </template>
         <template #footer>
            <UButton
               variant="ghost"
               color="neutral"
               @click="
                  () => {
                     modalEditarMostrar = false
                  }
               "
               >Cancelar</UButton
            >
            <UButton type="submit" form="form-feriado-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar feriado"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar el feriado del
            <span class="font-semibold">{{ feriadoAEliminar ? formatFecha(feriadoAEliminar.fecha) : '' }}</span
            >?
         </p>
      </ConfirmModal>
   </div>
</template>
