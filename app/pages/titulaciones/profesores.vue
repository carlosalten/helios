<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TtProfesor } from '~/types/titulaciones'

const toast = useToast()

const { data: profesores, status, refresh } = await useFetch<TtProfesor[]>('/api/titulaciones/profesores')

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/titulaciones/profesores')

const busqueda = ref('')
const profesoresFiltrados = computed(() => {
   if (!busqueda.value.trim()) return profesores.value ?? []
   const q = normalizarTexto(busqueda.value)
   return (profesores.value ?? []).filter(
      (p) =>
         normalizarTexto(p.nombre).includes(q) ||
         normalizarTexto(p.apellido).includes(q) ||
         normalizarTexto(p.email).includes(q) ||
         normalizarTexto(p.run).includes(q)
   )
})

const { paginaActual, itemsPagina: profesoresPagina, porPagina } = usePaginacion(profesoresFiltrados)

const columnas: TableColumn<TtProfesor>[] = [
   { accessorKey: 'nombre', header: 'Nombre' },
   { accessorKey: 'apellido', header: 'Apellido' },
   { accessorKey: 'email', header: 'Email' },
   { accessorKey: 'run', header: 'RUN', size: 110 },
   { id: 'tipo', header: 'Tipo', size: 160 },
   { accessorKey: 'cupoMaximo', header: 'Cupo', size: 90 },
   { id: 'acciones', header: '', size: 80 },
]

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({
   email: '',
   run: '',
   nombre: '',
   apellido: '',
   esGuia: false,
   esInvestigador: false,
   cupoMaximo: 6,
})
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)
const errorGuardarEmail = computed(() => (errorGuardar.value?.includes('email') ? errorGuardar.value : undefined))
const errorGuardarRun = computed(() => (errorGuardar.value?.includes('RUN') ? errorGuardar.value : undefined))
const errorGuardarNombre = computed(() =>
   errorGuardar.value && !errorGuardarEmail.value && !errorGuardarRun.value ? errorGuardar.value : undefined
)

function abrirCrear() {
   formCrear.email = ''
   formCrear.run = ''
   formCrear.nombre = ''
   formCrear.apellido = ''
   formCrear.esGuia = false
   formCrear.esInvestigador = false
   formCrear.cupoMaximo = 6
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/titulaciones/profesores', { method: 'POST', body: { ...formCrear } })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Profesor agregado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const profesorEditar = ref<TtProfesor | null>(null)
const formEditar = reactive({
   run: '',
   nombre: '',
   apellido: '',
   esGuia: false,
   esInvestigador: false,
   cupoMaximo: 6,
})
const errorEditar = ref<string | null>(null)
const errorEditarRun = computed(() => (errorEditar.value?.includes('RUN') ? errorEditar.value : undefined))
const errorEditarNombre = computed(() => (errorEditar.value && !errorEditarRun.value ? errorEditar.value : undefined))

function abrirEditar(profesor: TtProfesor) {
   profesorEditar.value = profesor
   formEditar.run = profesor.run
   formEditar.nombre = profesor.nombre
   formEditar.apellido = profesor.apellido
   formEditar.esGuia = profesor.esGuia
   formEditar.esInvestigador = profesor.esInvestigador
   formEditar.cupoMaximo = profesor.cupoMaximo
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!profesorEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/titulaciones/profesores/${encodeURIComponent(profesorEditar.value.email)}`
      await $fetch(url, { method: 'PATCH', body: { ...formEditar } })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Profesor actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const profesorAEliminar = ref<TtProfesor | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(profesor: TtProfesor) {
   profesorAEliminar.value = profesor
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!profesorAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/titulaciones/profesores/${encodeURIComponent(profesorAEliminar.value.email)}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Profesor eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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
               Profesores guía y/o investigadores del módulo de titulaciones.
            </p>
         </div>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nuevo profesor
         </UButton>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
         <UInput
            v-model="busqueda"
            icon="i-lucide-search"
            placeholder="Buscar por nombre, email o RUN…"
            class="sm:w-72"
         />
         <span class="text-sm text-usm-text-muted dark:text-slate-400">
            {{ profesoresFiltrados.length }} profesor{{ profesoresFiltrados.length !== 1 ? 'es' : '' }}
         </span>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!profesoresFiltrados.length"
            icon="i-lucide-user-round"
            message="No hay profesores registrados"
            :action="!busqueda && puedeCrear ? 'Nuevo profesor' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="profesoresPagina" :columns="columnas">
            <template #tipo-cell="{ row }">
               <div class="flex flex-wrap gap-1">
                  <UBadge v-if="row.original.esGuia" color="info" variant="subtle" size="sm">Guía</UBadge>
                  <UBadge v-if="row.original.esInvestigador" color="primary" variant="subtle" size="sm">
                     Investigador
                  </UBadge>
               </div>
            </template>
            <template #cupoMaximo-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{
                  row.original.esGuia ? row.original.cupoMaximo : '—'
               }}</span>
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

      <div v-if="profesoresFiltrados.length > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="profesoresFiltrados.length" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo profesor" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-profesor-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Email" name="email" :error="errorGuardarEmail">
                  <UInput v-model="formCrear.email" type="email" placeholder="nombre@usm.cl" class="w-full" />
               </UFormField>
               <UFormField label="RUN" name="run" :error="errorGuardarRun" description="Formato: 12345678-9">
                  <UInput v-model="formCrear.run" placeholder="12345678-9" class="w-full" />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Nombre" name="nombre" :error="errorGuardarNombre">
                     <UInput v-model="formCrear.nombre" class="w-full" />
                  </UFormField>
                  <UFormField label="Apellido" name="apellido">
                     <UInput v-model="formCrear.apellido" class="w-full" />
                  </UFormField>
               </div>
               <USwitch v-model="formCrear.esGuia" label="Es guía" />
               <USwitch v-model="formCrear.esInvestigador" label="Es investigador" />
               <UFormField
                  v-if="formCrear.esGuia"
                  label="Cupo máximo"
                  name="cupoMaximo"
                  description="Propuestas que puede guiar a la vez"
               >
                  <UInput v-model.number="formCrear.cupoMaximo" type="number" :min="1" :step="1" class="w-full" />
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
            <UButton type="submit" form="form-profesor-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal v-model:open="modalEditarMostrar" title="Editar profesor" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-profesor-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Email">
                  <UInput :model-value="profesorEditar?.email" disabled class="w-full" />
               </UFormField>
               <UFormField label="RUN" name="run" :error="errorEditarRun" description="Formato: 12345678-9">
                  <UInput v-model="formEditar.run" class="w-full" />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Nombre" name="nombre" :error="errorEditarNombre">
                     <UInput v-model="formEditar.nombre" class="w-full" />
                  </UFormField>
                  <UFormField label="Apellido" name="apellido">
                     <UInput v-model="formEditar.apellido" class="w-full" />
                  </UFormField>
               </div>
               <USwitch v-model="formEditar.esGuia" label="Es guía" />
               <USwitch v-model="formEditar.esInvestigador" label="Es investigador" />
               <UFormField
                  v-if="formEditar.esGuia"
                  label="Cupo máximo"
                  name="cupoMaximo"
                  description="Propuestas que puede guiar a la vez"
               >
                  <UInput v-model.number="formEditar.cupoMaximo" type="number" :min="1" :step="1" class="w-full" />
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
            <UButton type="submit" form="form-profesor-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar profesor"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar al profesor
            <span class="font-semibold">{{ profesorAEliminar?.nombre }} {{ profesorAEliminar?.apellido }}</span
            >? Solo es posible si no está asociado a una comisión ni a una línea de investigación.
         </p>
      </ConfirmModal>
   </div>
</template>
