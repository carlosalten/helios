<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Plan } from '~/types/plan'
import type { Carrera } from '~/types/carrera'

const toast = useToast()

const [{ data: planes, status, refresh }, { data: carreras }] = await Promise.all([
   useFetch<Plan[]>('/api/planes'),
   useFetch<Carrera[]>('/api/carreras'),
])

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/planes')

const filtroCarrera = ref<number | '__todos__'>('__todos__')

const planesFiltrados = computed(() => {
   if (filtroCarrera.value === '__todos__') return planes.value ?? []
   return (planes.value ?? []).filter((p) => p.carreraCodigo === filtroCarrera.value)
})

const opcionesCarrera = computed(() => [
   { label: 'Todas las carreras', value: '__todos__' as const },
   ...(carreras.value ?? []).map((c) => ({ label: c.nombre, value: c.codigo })),
])

const { paginaActual, itemsPagina: planesPagina, porPagina } = usePaginacion(planesFiltrados)

const columnas: TableColumn<Plan>[] = [
   { accessorKey: 'numero', header: 'Número de Plan', size: 100 },
   { id: 'carrera', header: 'Carrera' },
   { id: 'cantidadSemestres', header: 'N° Semestres', size: 120 },
   { id: 'vigente', header: 'Vigente', size: 100 },
   { id: 'acciones', header: '', size: 100 },
]

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({ numero: 1, vigente: false, carreraCodigo: 0, cantidadSemestres: 4, tieneElectivos: false })
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

function abrirCrear() {
   formCrear.numero = 1
   formCrear.vigente = false
   formCrear.carreraCodigo = carreras.value?.[0]?.codigo ?? 0
   formCrear.cantidadSemestres = 4
   formCrear.tieneElectivos = false
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/planes', {
         method: 'POST',
         body: {
            numero: Number(formCrear.numero),
            vigente: formCrear.vigente,
            carreraCodigo: Number(formCrear.carreraCodigo),
            cantidadSemestres: Number(formCrear.cantidadSemestres),
            tieneElectivos: formCrear.tieneElectivos,
         },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Plan creado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const planEditar = ref<Plan | null>(null)
const formEditar = reactive({
   numero: 1,
   vigente: false,
   carreraCodigo: 0,
   cantidadSemestres: 4,
   tieneElectivos: false,
})
const errorEditar = ref<string | null>(null)

function abrirEditar(plan: Plan) {
   planEditar.value = plan
   formEditar.numero = plan.numero
   formEditar.vigente = plan.vigente
   formEditar.carreraCodigo = plan.carreraCodigo
   formEditar.cantidadSemestres = plan.cantidadSemestres
   formEditar.tieneElectivos = plan.tieneElectivos
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!planEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/planes/${planEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: {
            numero: Number(formEditar.numero),
            vigente: formEditar.vigente,
            carreraCodigo: Number(formEditar.carreraCodigo),
            cantidadSemestres: Number(formEditar.cantidadSemestres),
            tieneElectivos: formEditar.tieneElectivos,
         },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Plan actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const planAEliminar = ref<Plan | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(plan: Plan) {
   planAEliminar.value = plan
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!planAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/planes/${planAEliminar.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Plan eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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
            <p class="text-sm text-usm-text-muted dark:text-slate-400">Planes de estudio de cada carrera</p>
         </div>
         <UButton
            icon="i-lucide-plus"
            class="sm:shrink-0"
            :disabled="!carreras?.length || !puedeCrear"
            @click="abrirCrear"
         >
            Nuevo plan
         </UButton>
      </div>

      <!-- Filtro por carrera -->
      <div class="flex items-center gap-3">
         <USelect v-model="filtroCarrera" :items="opcionesCarrera" value-key="value" class="w-64" />
         <span class="text-sm text-usm-text-muted dark:text-slate-400">
            {{ planesFiltrados.length }} plan{{ planesFiltrados.length !== 1 ? 'es' : '' }}
         </span>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="6" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!planesFiltrados.length"
            icon="i-lucide-book-open"
            message="No hay planes registrados"
            :action="carreras?.length && filtroCarrera === '__todos__' && puedeCrear ? 'Nuevo plan' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="planesPagina" :columns="columnas">
            <template #carrera-cell="{ row }">
               <p class="text-usm-text dark:text-white">
                  {{ row.original.carrera.nombre }}
                  <span class="text-xs text-usm-text-muted dark:text-slate-400"
                     >({{ row.original.carrera.codigo }})</span
                  >
               </p>
            </template>
            <template #cantidadSemestres-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ row.original.cantidadSemestres }}</span>
            </template>
            <template #vigente-cell="{ row }">
               <UBadge :color="row.original.vigente ? 'success' : 'neutral'" variant="subtle">
                  {{ row.original.vigente ? 'Vigente' : 'No vigente' }}
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
                        :disabled="!puedeEditar"
                        aria-label="Editar"
                        @click="abrirEditar(row.original)"
                     />
                  </UTooltip>
                  <UTooltip text="Eliminar">
                     <UButton
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        size="xs"
                        :disabled="!puedeBorrar"
                        aria-label="Eliminar"
                        @click="abrirConfirmEliminar(row.original)"
                     />
                  </UTooltip>
               </div>
            </template>
         </UTable>
      </div>

      <div v-if="planesFiltrados.length > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="planesFiltrados.length" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo plan" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-plan-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Carrera" name="carreraCodigo" :error="errorGuardar ?? undefined">
                  <USelect
                     v-model="formCrear.carreraCodigo"
                     :items="(carreras ?? []).map((c) => ({ label: c.nombre, value: c.codigo }))"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Número de Plan" name="numero">
                  <UInput
                     :model-value="String(formCrear.numero)"
                     type="number"
                     min="1"
                     class="w-full"
                     @update:model-value="formCrear.numero = Number($event)"
                  />
               </UFormField>
               <UFormField label="Cantidad de semestres" name="cantidadSemestres">
                  <UInputNumber v-model="formCrear.cantidadSemestres" :min="4" :max="12" class="w-full" />
               </UFormField>
               <USwitch v-model="formCrear.vigente" label="Vigente" />
               <USwitch v-model="formCrear.tieneElectivos" label="Tiene electivos" />
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
            <UButton type="submit" form="form-plan-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal
         v-model:open="modalEditarMostrar"
         :title="`Editar plan N° ${planEditar?.numero}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm id="form-plan-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Carrera" name="carreraCodigo" :error="errorEditar ?? undefined">
                  <USelect
                     v-model="formEditar.carreraCodigo"
                     :items="(carreras ?? []).map((c) => ({ label: c.nombre, value: c.codigo }))"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Número de Plan" name="numero">
                  <UInput
                     :model-value="String(formEditar.numero)"
                     type="number"
                     min="1"
                     class="w-full"
                     @update:model-value="formEditar.numero = Number($event)"
                  />
               </UFormField>
               <UFormField label="Cantidad de semestres" name="cantidadSemestres">
                  <UInputNumber v-model="formEditar.cantidadSemestres" :min="4" :max="12" class="w-full" />
               </UFormField>
               <USwitch v-model="formEditar.vigente" label="Vigente" />
               <USwitch v-model="formEditar.tieneElectivos" label="Tiene electivos" />
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
            <UButton type="submit" form="form-plan-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar plan"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar el plan
            <span class="font-semibold">N° {{ planAEliminar?.numero }}</span>
            de <span class="font-semibold">{{ planAEliminar?.carrera.nombre }}</span
            >? Solo es posible si no tiene asignaturas asociadas.
         </p>
      </ConfirmModal>
   </div>
</template>
