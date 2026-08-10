<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Sala, TipoSala } from '~/types/sala'

const toast = useToast()

const [{ data: salas, status, refresh }, { data: tipos }] = await Promise.all([
   useFetch<Sala[]>('/api/salas'),
   useFetch<TipoSala[]>('/api/salas/tipos'),
])

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/salas/gestion')

const filtroTipo = ref<number | '__todos__'>('__todos__')
const busqueda = ref('')

const salasFiltradas = computed(() => {
   let lista = salas.value ?? []
   if (filtroTipo.value !== '__todos__') {
      lista = lista.filter((s) => s.tipoSalaId === filtroTipo.value)
   }
   if (busqueda.value.trim()) {
      const q = normalizarTexto(busqueda.value)
      lista = lista.filter((s) => normalizarTexto(s.codigo).includes(q))
   }
   return lista
})

const opcionesTipo = computed(() => [
   { label: 'Todos los tipos', value: '__todos__' as const },
   ...(tipos.value ?? []).map((t) => ({ label: t.nombre, value: t.id })),
])

const { paginaActual, itemsPagina: salasPagina, porPagina } = usePaginacion(salasFiltradas)

const columnas: TableColumn<Sala>[] = [
   { accessorKey: 'codigo', header: 'Código' },
   { id: 'tipo', header: 'Tipo' },
   { accessorKey: 'capacidad', header: 'Capacidad', size: 120 },
   { id: 'acciones', header: '', size: 80 },
]

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({ codigo: '', capacidad: 1, tipoSalaId: 0 })
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

function abrirCrear() {
   formCrear.codigo = ''
   formCrear.capacidad = 1
   formCrear.tipoSalaId = tipos.value?.[0]?.id ?? 0
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/salas', {
         method: 'POST',
         body: {
            codigo: formCrear.codigo,
            capacidad: Number(formCrear.capacidad),
            tipoSalaId: Number(formCrear.tipoSalaId),
         },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Sala creada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const salaEditar = ref<Sala | null>(null)
const formEditar = reactive({ capacidad: 1, tipoSalaId: 0 })
const errorEditar = ref<string | null>(null)

function abrirEditar(sala: Sala) {
   salaEditar.value = sala
   formEditar.capacidad = sala.capacidad
   formEditar.tipoSalaId = sala.tipoSalaId
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!salaEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/salas/${salaEditar.value.codigo}`
      await $fetch(url, {
         method: 'PATCH',
         body: {
            capacidad: Number(formEditar.capacidad),
            tipoSalaId: Number(formEditar.tipoSalaId),
         },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Sala actualizada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const salaAEliminar = ref<Sala | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(sala: Sala) {
   salaAEliminar.value = sala
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!salaAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/salas/${salaAEliminar.value.codigo}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Sala eliminada', color: 'success', icon: 'i-lucide-check-circle' })
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
            <p class="text-sm text-usm-text-muted dark:text-slate-400">Salas disponibles en el departamento</p>
         </div>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nueva sala
         </UButton>
      </div>

      <!-- Filtros -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
         <UInput v-model="busqueda" icon="i-lucide-search" placeholder="Buscar por código…" class="sm:w-72" />
         <USelect v-model="filtroTipo" :items="opcionesTipo" value-key="value" class="sm:w-56" />
         <span class="text-sm text-usm-text-muted dark:text-slate-400">
            {{ salasFiltradas.length }} sala{{ salasFiltradas.length !== 1 ? 's' : '' }}
         </span>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="6" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!salasFiltradas.length"
            icon="i-lucide-door-open"
            message="No hay salas registradas"
            :action="filtroTipo === '__todos__' && !busqueda && puedeCrear ? 'Nueva sala' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="salasPagina" :columns="columnas">
            <template #tipo-cell="{ row }">
               <UBadge variant="subtle" color="neutral">{{ row.original.tipoSala.nombre }}</UBadge>
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

      <div v-if="salasFiltradas.length > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="salasFiltradas.length" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nueva sala" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-sala-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Código" name="codigo" :error="errorGuardar ?? undefined">
                  <UInput v-model="formCrear.codigo" placeholder="LAB-A1, SALA-201…" class="w-full" />
               </UFormField>
               <UFormField label="Tipo de sala" name="tipoSalaId">
                  <USelect
                     v-model="formCrear.tipoSalaId"
                     :items="(tipos ?? []).map((t) => ({ label: t.nombre, value: t.id }))"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Capacidad" name="capacidad">
                  <UInput
                     :model-value="String(formCrear.capacidad)"
                     type="number"
                     min="1"
                     class="w-full"
                     @update:model-value="formCrear.capacidad = Number($event)"
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
            <UButton type="submit" form="form-sala-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal
         v-model:open="modalEditarMostrar"
         :title="`Editar sala ${salaEditar?.codigo}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm id="form-sala-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Tipo de sala" name="tipoSalaId" :error="errorEditar ?? undefined">
                  <USelect
                     v-model="formEditar.tipoSalaId"
                     :items="(tipos ?? []).map((t) => ({ label: t.nombre, value: t.id }))"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Capacidad" name="capacidad">
                  <UInput
                     :model-value="String(formEditar.capacidad)"
                     type="number"
                     min="1"
                     class="w-full"
                     @update:model-value="formEditar.capacidad = Number($event)"
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
                     modalEditarMostrar = false
                  }
               "
               >Cancelar</UButton
            >
            <UButton type="submit" form="form-sala-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar sala"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar la sala
            <span class="font-semibold">{{ salaAEliminar?.codigo }}</span
            >? Se quitarán también todas las asignaciones de usuarios a esta sala.
         </p>
      </ConfirmModal>
   </div>
</template>
