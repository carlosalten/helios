<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Persona } from '~/types/persona'

const toast = useToast()

const { data: personas, status, refresh } = await useFetch<Persona[]>('/api/personas')

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/ayudantias/gestion')

// Esta página administra específicamente a las personas con rol Ayudante — no un CRUD
// genérico de personas (eso es /personas/gestion). Crear acá siempre asigna ese rol (ver
// server/api/ayudantias/ayudantes/index.post.ts), nunca a elección de quien llena el formulario.
const ayudantes = computed(() => (personas.value ?? []).filter((p) => p.rol?.nombre === 'Ayudante'))

const busqueda = ref('')
const ayudantesFiltrados = computed(() => {
   if (!busqueda.value.trim()) return ayudantes.value
   const q = normalizarTexto(busqueda.value)
   return ayudantes.value.filter(
      (p) =>
         normalizarTexto(p.nombre).includes(q) ||
         normalizarTexto(p.apellido).includes(q) ||
         normalizarTexto(p.email).includes(q)
   )
})

const { paginaActual, itemsPagina: ayudantesPagina, porPagina } = usePaginacion(ayudantesFiltrados)

const columnas: TableColumn<Persona>[] = [
   { id: 'persona', header: 'Ayudante' },
   { accessorKey: 'email', header: 'Email' },
   { id: 'acciones', header: '', size: 90 },
]

const guardando = ref(false)

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({ email: '', nombre: '', apellido: '' })
const errorGuardar = ref<string | null>(null)

function abrirCrear() {
   formCrear.email = ''
   formCrear.nombre = ''
   formCrear.apellido = ''
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/ayudantias/ayudantes', { method: 'POST', body: formCrear })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Ayudante agregado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const ayudanteEditar = ref<Persona | null>(null)
const formEditar = reactive({ nombre: '', apellido: '' })
const errorEditar = ref<string | null>(null)

function abrirEditar(ayudante: Persona) {
   ayudanteEditar.value = ayudante
   formEditar.nombre = ayudante.nombre
   formEditar.apellido = ayudante.apellido
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!ayudanteEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      await $fetch(`/api/ayudantias/ayudantes/${ayudanteEditar.value.id}`, { method: 'PATCH', body: formEditar })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Ayudante actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const ayudanteAEliminar = ref<Persona | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(ayudante: Persona) {
   ayudanteAEliminar.value = ayudante
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!ayudanteAEliminar.value) return
   eliminando.value = true
   try {
      await $fetch(`/api/ayudantias/ayudantes/${ayudanteAEliminar.value.id}`, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Ayudante eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Personas con rol Ayudante, disponibles para asignar en <strong>Ayudantías → Horario de ayudantías</strong>.
         </p>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nuevo ayudante
         </UButton>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <template v-else>
         <UInput
            v-model="busqueda"
            icon="i-lucide-search"
            placeholder="Buscar por nombre o email…"
            class="w-full sm:w-72"
         />

         <div class="overflow-hidden rounded-2xl border border-default bg-default">
            <EmptyState
               v-if="!ayudantesFiltrados.length"
               icon="i-lucide-user-check"
               :message="ayudantes.length ? 'No se encontraron ayudantes.' : 'No hay ayudantes registrados.'"
               :action="puedeCrear && !ayudantes.length ? 'Nuevo ayudante' : undefined"
               @action="abrirCrear"
            />
            <UTable v-else :data="ayudantesPagina" :columns="columnas">
               <template #persona-cell="{ row }">
                  <p class="truncate text-usm-text dark:text-white">
                     {{ row.original.nombre }} {{ row.original.apellido }}
                  </p>
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

         <div v-if="ayudantesFiltrados.length > porPagina" class="flex justify-center">
            <UPagination v-model:page="paginaActual" :total="ayudantesFiltrados.length" :items-per-page="porPagina" />
         </div>
      </template>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo ayudante" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-ayudante-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Email" name="email" :error="errorGuardar ?? undefined">
                  <UInput v-model="formCrear.email" type="email" placeholder="nombre@usm.cl" class="w-full" />
               </UFormField>
               <UFormField label="Nombre" name="nombre">
                  <UInput v-model="formCrear.nombre" class="w-full" />
               </UFormField>
               <UFormField label="Apellido" name="apellido">
                  <UInput v-model="formCrear.apellido" class="w-full" />
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
            <UButton type="submit" form="form-ayudante-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal v-model:open="modalEditarMostrar" title="Editar ayudante" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-ayudante-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Email">
                  <UInput :model-value="ayudanteEditar?.email" disabled class="w-full" />
               </UFormField>
               <UFormField label="Nombre" name="nombre" :error="errorEditar ?? undefined">
                  <UInput v-model="formEditar.nombre" class="w-full" />
               </UFormField>
               <UFormField label="Apellido" name="apellido">
                  <UInput v-model="formEditar.apellido" class="w-full" />
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
            <UButton type="submit" form="form-ayudante-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar ayudante"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar a
            <span class="font-semibold">{{ ayudanteAEliminar?.nombre }} {{ ayudanteAEliminar?.apellido }}</span
            >? También se eliminarán sus ayudantías y datos asociados (encargo de salas, carreras).
         </p>
      </ConfirmModal>
   </div>
</template>
