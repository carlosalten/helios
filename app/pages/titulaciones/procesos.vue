<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TtProceso } from '~/types/titulaciones'

const toast = useToast()

const { data: procesos, status, refresh } = await useFetch<TtProceso[]>('/api/titulaciones/procesos')

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/titulaciones/procesos')

const { paginaActual, itemsPagina: procesosPagina, porPagina } = usePaginacion(computed(() => procesos.value ?? []))

const columnas: TableColumn<TtProceso>[] = [
   { accessorKey: 'anio', header: 'Año' },
   { id: 'mostrarGuiaEstudiantes', header: 'Guía visible para estudiantes', size: 100 },
   { id: 'acciones', header: '', size: 80 },
]

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({ anio: new Date().getFullYear(), mostrarGuiaEstudiantes: false })
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

function abrirCrear() {
   formCrear.anio = new Date().getFullYear()
   formCrear.mostrarGuiaEstudiantes = false
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/titulaciones/procesos', {
         method: 'POST',
         body: { anio: Number(formCrear.anio), mostrarGuiaEstudiantes: formCrear.mostrarGuiaEstudiantes },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Proceso agregado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const procesoEditar = ref<TtProceso | null>(null)
const formEditar = reactive({ anio: new Date().getFullYear(), mostrarGuiaEstudiantes: false })
const errorEditar = ref<string | null>(null)

function abrirEditar(proceso: TtProceso) {
   procesoEditar.value = proceso
   formEditar.anio = proceso.anio
   formEditar.mostrarGuiaEstudiantes = proceso.mostrarGuiaEstudiantes
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!procesoEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/titulaciones/procesos/${procesoEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: { anio: Number(formEditar.anio), mostrarGuiaEstudiantes: formEditar.mostrarGuiaEstudiantes },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Proceso actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const procesoAEliminar = ref<TtProceso | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(proceso: TtProceso) {
   procesoAEliminar.value = proceso
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!procesoAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/titulaciones/procesos/${procesoAEliminar.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Proceso eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <div>
            <p class="text-sm text-usm-text-muted dark:text-slate-400">
               Procesos de titulación (uno por ciclo/año académico).
            </p>
         </div>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nuevo proceso
         </UButton>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!procesos?.length"
            icon="i-lucide-calendar-range"
            message="No hay procesos registrados"
            :action="puedeCrear ? 'Nuevo proceso' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="procesosPagina" :columns="columnas">
            <template #mostrarGuiaEstudiantes-cell="{ row }">
               <UBadge v-if="row.original.mostrarGuiaEstudiantes" color="success" variant="subtle" size="sm">Sí</UBadge>
               <UBadge v-else color="neutral" variant="subtle" size="sm">No</UBadge>
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

      <div v-if="(procesos?.length ?? 0) > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="procesos?.length ?? 0" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo proceso" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-proceso-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Año" name="anio" :error="errorGuardar ?? undefined">
                  <UInput
                     :model-value="String(formCrear.anio)"
                     type="number"
                     min="2000"
                     max="2100"
                     class="w-full"
                     @update:model-value="formCrear.anio = Number($event)"
                  />
               </UFormField>
               <USwitch v-model="formCrear.mostrarGuiaEstudiantes" label="Mostrar guía a los estudiantes" />
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
            <UButton type="submit" form="form-proceso-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal v-model:open="modalEditarMostrar" title="Editar proceso" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-proceso-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Año" name="anio" :error="errorEditar ?? undefined">
                  <UInput
                     :model-value="String(formEditar.anio)"
                     type="number"
                     min="2000"
                     max="2100"
                     class="w-full"
                     @update:model-value="formEditar.anio = Number($event)"
                  />
               </UFormField>
               <USwitch v-model="formEditar.mostrarGuiaEstudiantes" label="Mostrar guía a los estudiantes" />
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
            <UButton type="submit" form="form-proceso-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar proceso"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar el proceso <span class="font-semibold">{{ procesoAEliminar?.anio }}</span
            >? Solo es posible si no tiene estudiantes ni grupos asociados.
         </p>
      </ConfirmModal>
   </div>
</template>
