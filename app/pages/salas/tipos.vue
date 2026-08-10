<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TipoSala } from '~/types/sala'

const toast = useToast()

const { data: tipos, status, refresh } = await useFetch<TipoSala[]>('/api/salas/tipos')

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/salas/tipos')

const { paginaActual, itemsPagina: tiposPagina, porPagina } = usePaginacion(computed(() => tipos.value ?? []))

const columnas: TableColumn<TipoSala>[] = [
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
      await $fetch('/api/salas/tipos', { method: 'POST', body: { nombre: formCrear.nombre } })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Tipo de sala agregado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const tipoEditar = ref<TipoSala | null>(null)
const formEditar = reactive({ nombre: '' })
const errorEditar = ref<string | null>(null)

function abrirEditar(tipo: TipoSala) {
   tipoEditar.value = tipo
   formEditar.nombre = tipo.nombre
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!tipoEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/salas/tipos/${tipoEditar.value.id}`
      await $fetch(url, { method: 'PATCH', body: { nombre: formEditar.nombre } })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Tipo actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const tipoAEliminar = ref<TipoSala | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(tipo: TipoSala) {
   tipoAEliminar.value = tipo
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!tipoAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/salas/tipos/${tipoAEliminar.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Tipo eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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
               Categorías para clasificar las salas del departamento
            </p>
         </div>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nuevo tipo
         </UButton>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState v-if="!tipos?.length" icon="i-lucide-door-open" message="No hay tipos de sala registrados"
            :action="puedeCrear ? 'Nuevo tipo' : undefined" @action="abrirCrear" />
         <UTable v-else :data="tiposPagina" :columns="columnas">
            <template #acciones-cell="{ row }">
               <div class="flex justify-end gap-1">
                  <UTooltip text="Editar">
                     <UButton icon="i-lucide-pen" color="neutral" variant="ghost" size="xs" :disabled="!puedeEditar"
                        aria-label="Editar" @click="abrirEditar(row.original)" />
                  </UTooltip>
                  <UTooltip text="Eliminar">
                     <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" :disabled="!puedeBorrar"
                        aria-label="Eliminar" @click="abrirConfirmEliminar(row.original)" />
                  </UTooltip>
               </div>
            </template>
         </UTable>
      </div>

      <div v-if="(tipos?.length ?? 0) > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="tipos?.length ?? 0" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo tipo de sala" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-tipo-sala-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Nombre" name="nombre" :error="errorGuardar ?? undefined">
                  <UInput v-model="formCrear.nombre" placeholder="Laboratorio, Sala de reuniones…" class="w-full" />
               </UFormField>
            </UForm>
         </template>
         <template #footer>
            <UButton variant="ghost" color="neutral" @click="() => { modalCrearMostrar = false }">Cancelar</UButton>
            <UButton type="submit" form="form-tipo-sala-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal v-model:open="modalEditarMostrar" title="Editar tipo de sala" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-tipo-sala-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Nombre" name="nombre" :error="errorEditar ?? undefined">
                  <UInput v-model="formEditar.nombre" placeholder="Laboratorio, Sala de reuniones…" class="w-full" />
               </UFormField>
            </UForm>
         </template>
         <template #footer>
            <UButton variant="ghost" color="neutral" @click="() => { modalEditarMostrar = false }">Cancelar</UButton>
            <UButton type="submit" form="form-tipo-sala-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal v-model:open="confirmEliminarMostrar" title="Eliminar tipo de sala" confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2" confirm-color="error" :loading="eliminando" @confirm="confirmarEliminar">
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar el tipo
            <span class="font-semibold">{{ tipoAEliminar?.nombre }}</span>?
            Solo es posible si no hay salas con este tipo asignado.
         </p>
      </ConfirmModal>
   </div>
</template>
