<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Rol } from '~/types/persona'

const toast = useToast()

const { data: tipos, status, refresh } = await useFetch<Rol[]>('/api/personas/roles')

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/personas/tipos')

const { paginaActual, itemsPagina: tiposPagina, porPagina } = usePaginacion(computed(() => tipos.value ?? []))

const columnas: TableColumn<Rol>[] = [
   { accessorKey: 'nombre', header: 'Nombre' },
   { accessorKey: 'jerarquia', header: 'Jerarquía' },
   { id: 'acciones', header: '', size: 80 },
]

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({ nombre: '', jerarquia: 0 })
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

function abrirCrear() {
   formCrear.nombre = ''
   formCrear.jerarquia = 0
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/personas/roles', {
         method: 'POST',
         body: { nombre: formCrear.nombre, jerarquia: Number(formCrear.jerarquia) },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Tipo de persona agregado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const tipoEditar = ref<Rol | null>(null)
const formEditar = reactive({ nombre: '', jerarquia: 0 })
const errorEditar = ref<string | null>(null)

function abrirEditar(tipo: Rol) {
   tipoEditar.value = tipo
   formEditar.nombre = tipo.nombre
   formEditar.jerarquia = tipo.jerarquia
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!tipoEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/personas/roles/${tipoEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: { nombre: formEditar.nombre, jerarquia: Number(formEditar.jerarquia) },
      })
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
const tipoAEliminar = ref<Rol | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(tipo: Rol) {
   tipoAEliminar.value = tipo
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!tipoAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/personas/roles/${tipoAEliminar.value.id}`
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
               Categorías para clasificar las personas del departamento
            </p>
         </div>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nuevo tipo
         </UButton>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!tipos?.length"
            icon="i-lucide-user-round"
            message="No hay tipos de persona registrados"
            :action="puedeCrear ? 'Nuevo tipo' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="tiposPagina" :columns="columnas">
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

      <div v-if="(tipos?.length ?? 0) > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="tipos?.length ?? 0" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo tipo de persona" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-rol-persona-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Nombre" name="nombre" :error="errorGuardar ?? undefined">
                  <UInput v-model="formCrear.nombre" placeholder="Docente, Administrativo, Técnico…" class="w-full" />
               </UFormField>
               <UFormField
                  label="Jerarquía"
                  name="jerarquia"
                  description="Mayor número = más alto en la jerarquía. Determina qué roles puede asignar una persona de este tipo al crear o editar a otra en Personas."
               >
                  <UInput v-model.number="formCrear.jerarquia" type="number" min="0" max="1000" class="w-full" />
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
            <UButton type="submit" form="form-rol-persona-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal v-model:open="modalEditarMostrar" title="Editar tipo de persona" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-rol-persona-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Nombre" name="nombre" :error="errorEditar ?? undefined">
                  <UInput v-model="formEditar.nombre" placeholder="Docente, Administrativo, Técnico…" class="w-full" />
               </UFormField>
               <UFormField
                  label="Jerarquía"
                  name="jerarquia"
                  description="Mayor número = más alto en la jerarquía. Determina qué roles puede asignar una persona de este tipo al crear o editar a otra en Personas."
               >
                  <UInput v-model.number="formEditar.jerarquia" type="number" min="0" max="1000" class="w-full" />
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
            <UButton type="submit" form="form-rol-persona-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar tipo de persona"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar el tipo
            <span class="font-semibold">{{ tipoAEliminar?.nombre }}</span
            >? Solo es posible si no hay personas con este tipo asignado.
         </p>
      </ConfirmModal>
   </div>
</template>
