<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Bloque, Jornada } from '~/types/bloque'
import { JORNADAS } from '~/types/bloque'
import type { Semestre } from '~/types/semestre'
import { DIAS_SEMANA, nombreCortoDia } from '~/types/dia'

const toast = useToast()

const [{ data: bloques, status, refresh }, { data: semestres }] = await Promise.all([
   useFetch<Bloque[]>('/api/bloques'),
   useFetch<Semestre[]>('/api/semestres'),
])

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/bloques')

const semestreVigenteId = computed(() => semestres.value?.find((s) => s.vigente)?.id)

const filtroSemestre = ref<number | '__todos__'>(semestreVigenteId.value ?? '__todos__')

const bloquesFiltrados = computed(() => {
   if (filtroSemestre.value === '__todos__') return bloques.value ?? []
   return (bloques.value ?? []).filter((b) => b.semestreId === filtroSemestre.value)
})

const opcionesSemestre = computed(() => [
   { label: 'Todos los semestres', value: '__todos__' as const },
   ...(semestres.value ?? []).map((s) => ({ label: s.nombre, value: s.id })),
])

const { paginaActual, itemsPagina: bloquesPagina, porPagina } = usePaginacion(bloquesFiltrados)

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

function toggleDia(dias: number[], dia: number) {
   const i = dias.indexOf(dia)
   if (i === -1) dias.push(dia)
   else dias.splice(i, 1)
}

const columnas: TableColumn<Bloque>[] = [
   { accessorKey: 'numero', header: 'Número', size: 90 },
   { id: 'semestre', header: 'Semestre' },
   { id: 'inicio', header: 'Inicio', size: 90 },
   { id: 'fin', header: 'Fin', size: 90 },
   { id: 'jornada', header: 'Jornada', size: 120 },
   { id: 'ultimoManana', header: 'Últ. mañana', size: 110 },
   { id: 'protegido', header: 'Protegido', size: 180 },
   { id: 'acciones', header: '', size: 100 },
]

function labelJornada(jornada: Jornada) {
   return JORNADAS.find((j) => j.valor === jornada)?.label ?? jornada
}

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({
   semestreId: 0,
   numero: 1,
   inicio: '',
   fin: '',
   jornada: 'DIURNA' as Jornada,
   esUltimoManana: false,
   diasProtegidos: [] as number[],
})
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

function abrirCrear() {
   formCrear.semestreId = semestreVigenteId.value ?? semestres.value?.[0]?.id ?? 0
   formCrear.numero = 1
   formCrear.inicio = ''
   formCrear.fin = ''
   formCrear.jornada = 'DIURNA'
   formCrear.esUltimoManana = false
   formCrear.diasProtegidos = []
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/bloques', {
         method: 'POST',
         body: { ...formCrear, semestreId: Number(formCrear.semestreId), numero: Number(formCrear.numero) },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Bloque creado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const bloqueEditar = ref<Bloque | null>(null)
const formEditar = reactive({
   semestreId: 0,
   numero: 1,
   inicio: '',
   fin: '',
   jornada: 'DIURNA' as Jornada,
   esUltimoManana: false,
   diasProtegidos: [] as number[],
})
const errorEditar = ref<string | null>(null)

function abrirEditar(bloque: Bloque) {
   bloqueEditar.value = bloque
   formEditar.semestreId = bloque.semestreId
   formEditar.numero = bloque.numero
   formEditar.inicio = formatHora(bloque.inicio)
   formEditar.fin = formatHora(bloque.fin)
   formEditar.jornada = bloque.jornada
   formEditar.esUltimoManana = bloque.esUltimoManana
   formEditar.diasProtegidos = [...bloque.diasProtegidos]
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!bloqueEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/bloques/${bloqueEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: { ...formEditar, semestreId: Number(formEditar.semestreId), numero: Number(formEditar.numero) },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Bloque actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const bloqueAEliminar = ref<Bloque | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(bloque: Bloque) {
   bloqueAEliminar.value = bloque
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!bloqueAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/bloques/${bloqueAEliminar.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Bloque eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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
            <p class="text-sm text-usm-text-muted dark:text-slate-400">Bloques de horario de cada semestre.</p>
         </div>
         <UButton
            icon="i-lucide-plus"
            class="sm:shrink-0"
            :disabled="!semestres?.length || !puedeCrear"
            @click="abrirCrear"
         >
            Nuevo bloque
         </UButton>
      </div>

      <!-- Filtro por semestre -->
      <div class="flex items-center gap-3">
         <USelect v-model="filtroSemestre" :items="opcionesSemestre" value-key="value" class="w-64" />
         <span class="text-sm text-usm-text-muted dark:text-slate-400">
            {{ bloquesFiltrados.length }} bloque{{ bloquesFiltrados.length !== 1 ? 's' : '' }}
         </span>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="6" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!bloquesFiltrados.length"
            icon="i-lucide-clock"
            message="No hay bloques registrados"
            :action="semestres?.length && filtroSemestre === '__todos__' && puedeCrear ? 'Nuevo bloque' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="bloquesPagina" :columns="columnas">
            <template #semestre-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ row.original.semestre.nombre }}</span>
            </template>
            <template #inicio-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ formatHora(row.original.inicio) }}</span>
            </template>
            <template #fin-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ formatHora(row.original.fin) }}</span>
            </template>
            <template #jornada-cell="{ row }">
               <UBadge :color="row.original.jornada === 'VESPERTINA' ? 'secondary' : 'info'" variant="subtle">
                  {{ labelJornada(row.original.jornada) }}
               </UBadge>
            </template>
            <template #ultimoManana-cell="{ row }">
               <UBadge v-if="row.original.esUltimoManana" color="warning" variant="subtle"> Último de mañana </UBadge>
               <span v-else class="text-sm text-usm-text-muted dark:text-slate-400">—</span>
            </template>
            <template #protegido-cell="{ row }">
               <div v-if="row.original.diasProtegidos.length" class="flex flex-wrap gap-1">
                  <UBadge v-for="dia in row.original.diasProtegidos" :key="dia" color="warning" variant="subtle">
                     {{ nombreCortoDia(dia) }}
                  </UBadge>
               </div>
               <span v-else class="text-sm text-usm-text-muted dark:text-slate-400">—</span>
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

      <div v-if="bloquesFiltrados.length > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="bloquesFiltrados.length" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo bloque" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-bloque-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Semestre" name="semestreId" :error="errorGuardar ?? undefined">
                  <USelect
                     v-model="formCrear.semestreId"
                     :items="(semestres ?? []).map((s) => ({ label: s.nombre, value: s.id }))"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Número" name="numero">
                  <UInput
                     :model-value="String(formCrear.numero)"
                     type="number"
                     min="1"
                     class="w-full"
                     @update:model-value="formCrear.numero = Number($event)"
                  />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Hora de inicio" name="inicio">
                     <UInput
                        :model-value="formCrear.inicio"
                        placeholder="14:30"
                        maxlength="5"
                        icon="i-lucide-clock"
                        class="w-full"
                        @update:model-value="formCrear.inicio = enmascararHora(String($event))"
                     />
                  </UFormField>
                  <UFormField label="Hora de fin" name="fin">
                     <UInput
                        :model-value="formCrear.fin"
                        placeholder="16:00"
                        maxlength="5"
                        icon="i-lucide-clock"
                        class="w-full"
                        @update:model-value="formCrear.fin = enmascararHora(String($event))"
                     />
                  </UFormField>
               </div>
               <UFormField label="Jornada" name="jornada">
                  <USelect
                     v-model="formCrear.jornada"
                     :items="JORNADAS.map((j) => ({ label: j.label, value: j.valor }))"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UCheckbox
                  v-model="formCrear.esUltimoManana"
                  label="Es el último bloque de la mañana"
                  description="Separa la mañana de la tarde en la matriz de horario. Solo un bloque por semestre puede tener esta marca."
               />
               <UFormField
                  label="Días protegidos"
                  name="diasProtegidos"
                  help="Días en que este bloque queda protegido (sin clases de paralelos)."
               >
                  <div class="flex flex-wrap gap-3">
                     <UCheckbox
                        v-for="dia in DIAS_SEMANA"
                        :key="dia.valor"
                        :label="dia.corto"
                        :model-value="formCrear.diasProtegidos.includes(dia.valor)"
                        @update:model-value="toggleDia(formCrear.diasProtegidos, dia.valor)"
                     />
                  </div>
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
            <UButton type="submit" form="form-bloque-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal
         v-model:open="modalEditarMostrar"
         :title="`Editar bloque N° ${bloqueEditar?.numero}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm id="form-bloque-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Semestre" name="semestreId" :error="errorEditar ?? undefined">
                  <USelect
                     v-model="formEditar.semestreId"
                     :items="(semestres ?? []).map((s) => ({ label: s.nombre, value: s.id }))"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Número" name="numero">
                  <UInput
                     :model-value="String(formEditar.numero)"
                     type="number"
                     min="1"
                     class="w-full"
                     @update:model-value="formEditar.numero = Number($event)"
                  />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Hora de inicio" name="inicio">
                     <UInput
                        :model-value="formEditar.inicio"
                        placeholder="14:30"
                        maxlength="5"
                        icon="i-lucide-clock"
                        class="w-full"
                        @update:model-value="formEditar.inicio = enmascararHora(String($event))"
                     />
                  </UFormField>
                  <UFormField label="Hora de fin" name="fin">
                     <UInput
                        :model-value="formEditar.fin"
                        placeholder="16:00"
                        maxlength="5"
                        icon="i-lucide-clock"
                        class="w-full"
                        @update:model-value="formEditar.fin = enmascararHora(String($event))"
                     />
                  </UFormField>
               </div>
               <UFormField label="Jornada" name="jornada">
                  <USelect
                     v-model="formEditar.jornada"
                     :items="JORNADAS.map((j) => ({ label: j.label, value: j.valor }))"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UCheckbox
                  v-model="formEditar.esUltimoManana"
                  label="Es el último bloque de la mañana"
                  description="Separa la mañana de la tarde en la matriz de horario. Solo un bloque por semestre puede tener esta marca."
               />
               <UFormField
                  label="Días protegidos"
                  name="diasProtegidos"
                  help="Días en que este bloque queda protegido (sin clases de paralelos)."
               >
                  <div class="flex flex-wrap gap-3">
                     <UCheckbox
                        v-for="dia in DIAS_SEMANA"
                        :key="dia.valor"
                        :label="dia.corto"
                        :model-value="formEditar.diasProtegidos.includes(dia.valor)"
                        @update:model-value="toggleDia(formEditar.diasProtegidos, dia.valor)"
                     />
                  </div>
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
            <UButton type="submit" form="form-bloque-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar bloque"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar el bloque
            <span class="font-semibold">N° {{ bloqueAEliminar?.numero }}</span>
            de <span class="font-semibold">{{ bloqueAEliminar?.semestre.nombre }}</span
            >? Solo es posible si no tiene sesiones asociadas.
         </p>
      </ConfirmModal>
   </div>
</template>
