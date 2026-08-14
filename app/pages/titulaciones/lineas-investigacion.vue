<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TtLineaInvestigacion } from '~/types/titulaciones'

const toast = useToast()

const {
   data: lineas,
   status,
   refresh,
} = await useFetch<TtLineaInvestigacion[]>('/api/titulaciones/lineas-investigacion')

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/titulaciones/lineas-investigacion')

const { paginaActual, itemsPagina: lineasPagina, porPagina } = usePaginacion(computed(() => lineas.value ?? []))

const columnas: TableColumn<TtLineaInvestigacion>[] = [
   { accessorKey: 'nombre', header: 'Nombre' },
   { id: 'acciones', header: '', size: 80 },
]

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({ nombre: '' })
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

function abrirCrear() {
   formCrear.nombre = ''
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/titulaciones/lineas-investigacion', {
         method: 'POST',
         body: { nombre: formCrear.nombre },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Línea de investigación agregada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const lineaEditar = ref<TtLineaInvestigacion | null>(null)
const formEditar = reactive({ nombre: '' })
const errorEditar = ref<string | null>(null)

function abrirEditar(linea: TtLineaInvestigacion) {
   lineaEditar.value = linea
   formEditar.nombre = linea.nombre
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!lineaEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/titulaciones/lineas-investigacion/${lineaEditar.value.id}`
      await $fetch(url, { method: 'PATCH', body: { nombre: formEditar.nombre } })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Línea de investigación actualizada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const lineaAEliminar = ref<TtLineaInvestigacion | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(linea: TtLineaInvestigacion) {
   lineaAEliminar.value = linea
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!lineaAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/titulaciones/lineas-investigacion/${lineaAEliminar.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Línea de investigación eliminada', color: 'success', icon: 'i-lucide-check-circle' })
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
               Líneas de investigación disponibles para las propuestas de titulación.
            </p>
         </div>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nueva línea
         </UButton>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!lineas?.length"
            icon="i-lucide-flask-conical"
            message="No hay líneas de investigación registradas"
            :action="puedeCrear ? 'Nueva línea' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="lineasPagina" :columns="columnas">
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

      <div v-if="(lineas?.length ?? 0) > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="lineas?.length ?? 0" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nueva línea de investigación" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-linea-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Nombre" name="nombre" :error="errorGuardar ?? undefined">
                  <UInput
                     v-model="formCrear.nombre"
                     placeholder="Inteligencia Artificial, Redes y Comunicaciones…"
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
            <UButton type="submit" form="form-linea-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal v-model:open="modalEditarMostrar" title="Editar línea de investigación" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-linea-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Nombre" name="nombre" :error="errorEditar ?? undefined">
                  <UInput v-model="formEditar.nombre" class="w-full" />
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
            <UButton type="submit" form="form-linea-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar línea de investigación"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar la línea
            <span class="font-semibold">{{ lineaAEliminar?.nombre }}</span
            >? Solo es posible si no está asociada a propuestas ni profesores.
         </p>
      </ConfirmModal>
   </div>
</template>
