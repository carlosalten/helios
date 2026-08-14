<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TtRol } from '~/types/titulaciones'

const toast = useToast()

const { data: roles, status, refresh } = await useFetch<TtRol[]>('/api/titulaciones/roles')

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/titulaciones/roles')

const { paginaActual, itemsPagina: rolesPagina, porPagina } = usePaginacion(computed(() => roles.value ?? []))

const columnas: TableColumn<TtRol>[] = [
   { accessorKey: 'nombre', header: 'Nombre' },
   { accessorKey: 'descripcion', header: 'Descripción' },
   { id: 'activo', header: 'Activo', size: 100 },
   { id: 'acciones', header: '', size: 80 },
]

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({ nombre: '', descripcion: '', activo: true })
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)
// El servidor indica en `data.campo` cuál de los dos falló (ver crearTtRolSchema en el server) —
// nunca se adivina a partir del texto del mensaje, porque mensajes como "Máximo 100 caracteres"
// no mencionan el nombre del campo y aplican por igual a nombre y a descripción.
const errorGuardarCampo = ref<string | undefined>(undefined)
const errorGuardarNombre = computed(() =>
   errorGuardarCampo.value === 'nombre' ? (errorGuardar.value ?? undefined) : undefined
)
const errorGuardarDescripcion = computed(() =>
   errorGuardarCampo.value === 'descripcion' ? (errorGuardar.value ?? undefined) : undefined
)

function abrirCrear() {
   formCrear.nombre = ''
   formCrear.descripcion = ''
   formCrear.activo = true
   errorGuardar.value = null
   errorGuardarCampo.value = undefined
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   errorGuardarCampo.value = undefined
   try {
      await $fetch('/api/titulaciones/roles', {
         method: 'POST',
         body: { nombre: formCrear.nombre, descripcion: formCrear.descripcion, activo: formCrear.activo },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Rol agregado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const error = e as { data?: { message?: string; data?: { campo?: string } } }
      errorGuardar.value = error.data?.message ?? 'Error al guardar'
      errorGuardarCampo.value = error.data?.data?.campo
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const rolEditar = ref<TtRol | null>(null)
const formEditar = reactive({ nombre: '', descripcion: '', activo: true })
const errorEditar = ref<string | null>(null)
// Ver comentario de errorGuardarCampo: mismo criterio, campo indicado por el servidor.
const errorEditarCampo = ref<string | undefined>(undefined)
const errorEditarNombre = computed(() =>
   errorEditarCampo.value === 'nombre' ? (errorEditar.value ?? undefined) : undefined
)
const errorEditarDescripcion = computed(() =>
   errorEditarCampo.value === 'descripcion' ? (errorEditar.value ?? undefined) : undefined
)

function abrirEditar(rol: TtRol) {
   rolEditar.value = rol
   formEditar.nombre = rol.nombre
   formEditar.descripcion = rol.descripcion ?? ''
   formEditar.activo = rol.activo
   errorEditar.value = null
   errorEditarCampo.value = undefined
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!rolEditar.value) return
   guardando.value = true
   errorEditar.value = null
   errorEditarCampo.value = undefined
   try {
      const url: string = `/api/titulaciones/roles/${rolEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: { nombre: formEditar.nombre, descripcion: formEditar.descripcion, activo: formEditar.activo },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Rol actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const error = e as { data?: { message?: string; data?: { campo?: string } } }
      errorEditar.value = error.data?.message ?? 'Error al guardar'
      errorEditarCampo.value = error.data?.data?.campo
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const rolAEliminar = ref<TtRol | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(rol: TtRol) {
   rolAEliminar.value = rol
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!rolAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/titulaciones/roles/${rolAEliminar.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Rol eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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
               Catálogo de roles dentro de una propuesta de titulación.
            </p>
         </div>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nuevo rol
         </UButton>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!roles?.length"
            icon="i-lucide-tag"
            message="No hay roles registrados"
            :action="puedeCrear ? 'Nuevo rol' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="rolesPagina" :columns="columnas">
            <template #descripcion-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ row.original.descripcion ?? '—' }}</span>
            </template>
            <template #activo-cell="{ row }">
               <UBadge v-if="row.original.activo" color="success" variant="subtle" size="sm">Sí</UBadge>
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

      <div v-if="(roles?.length ?? 0) > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="roles?.length ?? 0" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo rol" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-rol-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Nombre" name="nombre" :error="errorGuardarNombre">
                  <UInput v-model="formCrear.nombre" placeholder="Presentante, Integrante…" class="w-full" />
               </UFormField>
               <UFormField label="Descripción (opcional)" name="descripcion" :error="errorGuardarDescripcion">
                  <UTextarea v-model="formCrear.descripcion" class="w-full" :rows="3" />
               </UFormField>
               <USwitch v-model="formCrear.activo" label="Activo" />
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
            <UButton type="submit" form="form-rol-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal v-model:open="modalEditarMostrar" title="Editar rol" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-rol-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Nombre" name="nombre" :error="errorEditarNombre">
                  <UInput v-model="formEditar.nombre" class="w-full" />
               </UFormField>
               <UFormField label="Descripción (opcional)" name="descripcion" :error="errorEditarDescripcion">
                  <UTextarea v-model="formEditar.descripcion" class="w-full" :rows="3" />
               </UFormField>
               <USwitch v-model="formEditar.activo" label="Activo" />
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
            <UButton type="submit" form="form-rol-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar rol"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar el rol
            <span class="font-semibold">{{ rolAEliminar?.nombre }}</span
            >? Solo es posible si no está asociado a ninguna propuesta.
         </p>
      </ConfirmModal>
   </div>
</template>
