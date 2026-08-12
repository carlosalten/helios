<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Asignatura } from '~/types/asignatura'

const toast = useToast()

const { data: asignaturas, status, refresh } = await useFetch<Asignatura[]>('/api/asignaturas')

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/asignaturas')

const busqueda = ref('')

const asignaturasFiltradas = computed(() => {
   if (!busqueda.value.trim()) return asignaturas.value ?? []
   const q = normalizarTexto(busqueda.value)
   return (asignaturas.value ?? []).filter(
      (a) => normalizarTexto(a.nombre).includes(q) || normalizarTexto(a.codigo).includes(q)
   )
})

const { paginaActual, itemsPagina: asignaturasPagina, porPagina } = usePaginacion(asignaturasFiltradas)

const columnas: TableColumn<Asignatura>[] = [
   { accessorKey: 'codigo', header: 'Código', size: 120 },
   { accessorKey: 'nombre', header: 'Nombre' },
   { accessorKey: 'nombreCorto', header: 'Nombre corto', size: 140 },
   { id: 'bloques', header: 'Bloques (T/P)', size: 130 },
   { id: 'planes', header: 'Planes', size: 100 },
   { id: 'acciones', header: '', size: 80 },
]

/* ── Detalle de planes ──────────────────────────────────────── */
const modalPlanesMostrar = ref(false)
const asignaturaPlanes = ref<Asignatura | null>(null)

function abrirPlanes(asignatura: Asignatura) {
   asignaturaPlanes.value = asignatura
   modalPlanesMostrar.value = true
}

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({ codigo: '', nombre: '', nombreCorto: '', bloquesTeoria: 0, bloquesPractica: 0 })
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)
const errorGuardarCodigo = computed(() => (errorGuardar.value?.includes('código') ? errorGuardar.value : undefined))
const errorGuardarNombre = computed(() => (errorGuardar.value?.includes('nombre') ? errorGuardar.value : undefined))
const errorGuardarBloques = computed(() =>
   errorGuardar.value && !errorGuardarCodigo.value && !errorGuardarNombre.value ? errorGuardar.value : undefined
)

function abrirCrear() {
   formCrear.codigo = ''
   formCrear.nombre = ''
   formCrear.nombreCorto = ''
   formCrear.bloquesTeoria = 0
   formCrear.bloquesPractica = 0
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/asignaturas', {
         method: 'POST',
         body: {
            codigo: formCrear.codigo,
            nombre: formCrear.nombre,
            nombreCorto: formCrear.nombreCorto,
            bloquesTeoria: Number(formCrear.bloquesTeoria),
            bloquesPractica: Number(formCrear.bloquesPractica),
         },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Asignatura agregada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const asignaturaEditar = ref<Asignatura | null>(null)
const formEditar = reactive({ codigo: '', nombre: '', nombreCorto: '', bloquesTeoria: 0, bloquesPractica: 0 })
const errorEditar = ref<string | null>(null)
const errorEditarCodigo = computed(() => (errorEditar.value?.includes('código') ? errorEditar.value : undefined))
const errorEditarNombre = computed(() => (errorEditar.value?.includes('nombre') ? errorEditar.value : undefined))
const errorEditarBloques = computed(() =>
   errorEditar.value && !errorEditarCodigo.value && !errorEditarNombre.value ? errorEditar.value : undefined
)

function abrirEditar(asignatura: Asignatura) {
   asignaturaEditar.value = asignatura
   formEditar.codigo = asignatura.codigo
   formEditar.nombre = asignatura.nombre
   formEditar.nombreCorto = asignatura.nombreCorto ?? ''
   formEditar.bloquesTeoria = asignatura.bloquesTeoria
   formEditar.bloquesPractica = asignatura.bloquesPractica
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!asignaturaEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/asignaturas/${asignaturaEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: {
            codigo: formEditar.codigo,
            nombre: formEditar.nombre,
            nombreCorto: formEditar.nombreCorto,
            bloquesTeoria: Number(formEditar.bloquesTeoria),
            bloquesPractica: Number(formEditar.bloquesPractica),
         },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Asignatura actualizada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const asignaturaAEliminar = ref<Asignatura | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(asignatura: Asignatura) {
   asignaturaAEliminar.value = asignatura
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!asignaturaAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/asignaturas/${asignaturaAEliminar.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Asignatura eliminada', color: 'success', icon: 'i-lucide-check-circle' })
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
               Asignaturas que forman parte de uno más planes de estudio.
            </p>
         </div>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nueva asignatura
         </UButton>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
         <UInput v-model="busqueda" icon="i-lucide-search" placeholder="Buscar por nombre o código…" class="sm:w-72" />
         <span class="text-sm text-usm-text-muted dark:text-slate-400">
            {{ asignaturasFiltradas.length }} asignatura{{ asignaturasFiltradas.length !== 1 ? 's' : '' }}
         </span>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!asignaturasFiltradas.length"
            icon="i-lucide-book-open"
            message="No hay asignaturas registradas"
            :action="!busqueda && puedeCrear ? 'Nueva asignatura' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="asignaturasPagina" :columns="columnas">
            <template #nombreCorto-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ row.original.nombreCorto ?? '—' }}</span>
            </template>
            <template #bloques-cell="{ row }">
               <span class="text-usm-text dark:text-white">
                  {{ row.original.bloquesTeoria }} / {{ row.original.bloquesPractica }}
               </span>
            </template>
            <template #planes-cell="{ row }">
               <UButton
                  variant="subtle"
                  color="neutral"
                  size="xs"
                  icon="i-lucide-list"
                  @click="abrirPlanes(row.original)"
               >
                  {{ row.original.asignaturasPlan.length }}
                  plan{{ row.original.asignaturasPlan.length !== 1 ? 'es' : '' }}
               </UButton>
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

      <div v-if="asignaturasFiltradas.length > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="asignaturasFiltradas.length" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nueva asignatura" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-asignatura-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Código" name="codigo" :error="errorGuardarCodigo">
                  <UInput v-model="formCrear.codigo" placeholder="MAT101…" class="w-full" />
               </UFormField>
               <UFormField label="Nombre" name="nombre" :error="errorGuardarNombre">
                  <UInput v-model="formCrear.nombre" placeholder="Cálculo I, Programación Avanzada…" class="w-full" />
               </UFormField>
               <UFormField label="Nombre corto" name="nombreCorto" description="Opcional, para espacios reducidos.">
                  <UInput v-model="formCrear.nombreCorto" placeholder="Cálculo I…" class="w-full" />
               </UFormField>
               <UFormField name="bloques" :error="errorGuardarBloques">
                  <div class="grid grid-cols-2 gap-4">
                     <UFormField label="Bloques de teoría" name="bloquesTeoria">
                        <UInput
                           :model-value="String(formCrear.bloquesTeoria)"
                           type="number"
                           min="0"
                           class="w-full"
                           @update:model-value="formCrear.bloquesTeoria = Number($event)"
                        />
                     </UFormField>
                     <UFormField label="Bloques de práctica" name="bloquesPractica">
                        <UInput
                           :model-value="String(formCrear.bloquesPractica)"
                           type="number"
                           min="0"
                           class="w-full"
                           @update:model-value="formCrear.bloquesPractica = Number($event)"
                        />
                     </UFormField>
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
            <UButton type="submit" form="form-asignatura-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal v-model:open="modalEditarMostrar" title="Editar asignatura" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-asignatura-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Código" name="codigo" :error="errorEditarCodigo">
                  <UInput v-model="formEditar.codigo" class="w-full" />
               </UFormField>
               <UFormField label="Nombre" name="nombre" :error="errorEditarNombre">
                  <UInput v-model="formEditar.nombre" class="w-full" />
               </UFormField>
               <UFormField label="Nombre corto" name="nombreCorto" description="Opcional, para espacios reducidos.">
                  <UInput v-model="formEditar.nombreCorto" class="w-full" />
               </UFormField>
               <UFormField name="bloques" :error="errorEditarBloques">
                  <div class="grid grid-cols-2 gap-4">
                     <UFormField label="Bloques de teoría" name="bloquesTeoria">
                        <UInput
                           :model-value="String(formEditar.bloquesTeoria)"
                           type="number"
                           min="0"
                           class="w-full"
                           @update:model-value="formEditar.bloquesTeoria = Number($event)"
                        />
                     </UFormField>
                     <UFormField label="Bloques de práctica" name="bloquesPractica">
                        <UInput
                           :model-value="String(formEditar.bloquesPractica)"
                           type="number"
                           min="0"
                           class="w-full"
                           @update:model-value="formEditar.bloquesPractica = Number($event)"
                        />
                     </UFormField>
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
            <UButton type="submit" form="form-asignatura-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Modal planes -->
      <UModal
         v-model:open="modalPlanesMostrar"
         :title="`Planes de ${asignaturaPlanes?.nombre}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <EmptyState
               v-if="!asignaturaPlanes?.asignaturasPlan.length"
               icon="i-lucide-list"
               message="No está asignada a ningún plan"
            />
            <ul v-else class="space-y-2">
               <li
                  v-for="ap in asignaturaPlanes.asignaturasPlan"
                  :key="ap.id"
                  class="flex items-center justify-between rounded-lg border border-default px-3 py-2"
               >
                  <div>
                     <p class="text-sm font-medium text-usm-text dark:text-white">{{ ap.plan.carrera.nombre }}</p>
                     <p class="text-xs text-usm-text-muted dark:text-slate-400">Plan N° {{ ap.plan.numero }}</p>
                  </div>
                  <span class="text-sm text-usm-text dark:text-white">Semestre {{ ap.semestre }}</span>
               </li>
            </ul>
         </template>
         <template #footer>
            <UButton
               variant="ghost"
               color="neutral"
               @click="
                  () => {
                     modalPlanesMostrar = false
                  }
               "
               >Cerrar</UButton
            >
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar asignatura"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar la asignatura
            <span class="font-semibold">{{ asignaturaAEliminar?.nombre }}</span
            >? Solo es posible si no está asociada a ningún plan.
         </p>
      </ConfirmModal>
   </div>
</template>
