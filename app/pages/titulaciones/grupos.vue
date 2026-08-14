<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TtGrupo, TtProceso } from '~/types/titulaciones'

const toast = useToast()

const [{ data: grupos, status, refresh }, { data: procesos }] = await Promise.all([
   useFetch<TtGrupo[]>('/api/titulaciones/grupos'),
   useFetch<TtProceso[]>('/api/titulaciones/procesos'),
])

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/titulaciones/grupos')

const { paginaActual, itemsPagina: gruposPagina, porPagina } = usePaginacion(computed(() => grupos.value ?? []))

const columnas: TableColumn<TtGrupo>[] = [
   { accessorKey: 'nombre', header: 'Nombre' },
   { id: 'proceso', header: 'Proceso', size: 120 },
   { id: 'acciones', header: '', size: 80 },
]

const itemsProceso = computed(() => (procesos.value ?? []).map((p) => ({ label: String(p.anio), value: p.id })) ?? [])

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({ nombre: '', procesoId: 0 })
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)
const errorGuardarNombre = computed(() => (errorGuardar.value?.includes('nombre') ? errorGuardar.value : undefined))
// Cualquier error que no mencione "nombre" (p. ej. "Máximo 50 caracteres") cae acá — así ningún
// mensaje del servidor queda sin mostrarse en el modal.
const errorGuardarProceso = computed(() =>
   errorGuardar.value && !errorGuardarNombre.value ? errorGuardar.value : undefined
)

function abrirCrear() {
   formCrear.nombre = ''
   formCrear.procesoId = procesos.value?.[0]?.id ?? 0
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/titulaciones/grupos', {
         method: 'POST',
         body: { nombre: formCrear.nombre, procesoId: Number(formCrear.procesoId) },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Grupo agregado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const grupoEditar = ref<TtGrupo | null>(null)
const formEditar = reactive({ nombre: '', procesoId: 0 })
const errorEditar = ref<string | null>(null)
const errorEditarNombre = computed(() => (errorEditar.value?.includes('nombre') ? errorEditar.value : undefined))
// Ver comentario de errorGuardarProceso: cualquier error no atribuible al nombre cae acá.
const errorEditarProceso = computed(() =>
   errorEditar.value && !errorEditarNombre.value ? errorEditar.value : undefined
)

function abrirEditar(grupo: TtGrupo) {
   grupoEditar.value = grupo
   formEditar.nombre = grupo.nombre
   formEditar.procesoId = grupo.procesoId
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!grupoEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/titulaciones/grupos/${grupoEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: { nombre: formEditar.nombre, procesoId: Number(formEditar.procesoId) },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Grupo actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const grupoAEliminar = ref<TtGrupo | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(grupo: TtGrupo) {
   grupoAEliminar.value = grupo
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!grupoAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/titulaciones/grupos/${grupoAEliminar.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Grupo eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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
               Grupos de trabajo de un proceso de titulación.
            </p>
         </div>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nuevo grupo
         </UButton>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!grupos?.length"
            icon="i-lucide-users"
            message="No hay grupos registrados"
            :action="puedeCrear ? 'Nuevo grupo' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="gruposPagina" :columns="columnas">
            <template #proceso-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ row.original.proceso.anio }}</span>
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

      <div v-if="(grupos?.length ?? 0) > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="grupos?.length ?? 0" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo grupo" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-grupo-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Nombre" name="nombre" :error="errorGuardarNombre">
                  <UInput v-model="formCrear.nombre" placeholder="Grupo 1…" class="w-full" />
               </UFormField>
               <UFormField label="Proceso" name="procesoId" :error="errorGuardarProceso">
                  <USelectMenu v-model="formCrear.procesoId" :items="itemsProceso" value-key="value" class="w-full" />
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
            <UButton type="submit" form="form-grupo-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal v-model:open="modalEditarMostrar" title="Editar grupo" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-grupo-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Nombre" name="nombre" :error="errorEditarNombre">
                  <UInput v-model="formEditar.nombre" class="w-full" />
               </UFormField>
               <UFormField label="Proceso" name="procesoId" :error="errorEditarProceso">
                  <USelectMenu v-model="formEditar.procesoId" :items="itemsProceso" value-key="value" class="w-full" />
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
            <UButton type="submit" form="form-grupo-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar grupo"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar el grupo
            <span class="font-semibold">{{ grupoAEliminar?.nombre }}</span
            >? Solo es posible si no tiene estudiantes asociados.
         </p>
      </ConfirmModal>
   </div>
</template>
