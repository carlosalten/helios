<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Carrera } from '~/types/carrera'
import type { Persona } from '~/types/persona'
import { JORNADAS } from '~/types/bloque'

const toast = useToast()

const [{ data: carreras, status, refresh }, { data: personas }] = await Promise.all([
   useFetch<Carrera[]>('/api/carreras'),
   useFetch<Persona[]>('/api/personas'),
])

const profesores = computed(() => (personas.value ?? []).filter((p) => p.rol?.nombre === 'Jefe de Carrera'))

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/carreras')

const busqueda = ref('')

const carrerasFiltradas = computed(() => {
   if (!busqueda.value.trim()) return carreras.value ?? []
   const q = normalizarTexto(busqueda.value)
   return (carreras.value ?? []).filter((c) => normalizarTexto(c.nombre).includes(q) || String(c.codigo).includes(q))
})

const { paginaActual, itemsPagina: carrerasPagina, porPagina } = usePaginacion(carrerasFiltradas)

const columnas: TableColumn<Carrera>[] = [
   { accessorKey: 'codigo', header: 'Código', size: 100 },
   { accessorKey: 'nombre', header: 'Nombre' },
   { accessorKey: 'nombreCorto', header: 'Nombre corto', size: 140 },
   { id: 'jornada', header: 'Jornada', size: 110 },
   { id: 'jefe', header: 'Jefe de carrera' },
   { id: 'acciones', header: '', size: 100 },
]

const opcionesJornada = JORNADAS.map((j) => ({ label: j.label, value: j.valor }))
function labelJornada(jornada: Carrera['jornada']) {
   return JORNADAS.find((j) => j.valor === jornada)?.label ?? jornada
}

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({
   codigo: 0,
   nombre: '',
   nombreCorto: '',
   jefePersonaId: 0,
   jornada: 'DIURNA' as Carrera['jornada'],
})
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)
const errorGuardarCodigo = computed(() => (errorGuardar.value?.includes('código') ? errorGuardar.value : undefined))
const errorGuardarNombre = computed(() => (errorGuardar.value?.includes('nombre') ? errorGuardar.value : undefined))

function abrirCrear() {
   formCrear.codigo = 0
   formCrear.nombre = ''
   formCrear.nombreCorto = ''
   formCrear.jefePersonaId = profesores.value[0]?.id ?? 0
   formCrear.jornada = 'DIURNA'
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/carreras', {
         method: 'POST',
         body: {
            codigo: Number(formCrear.codigo),
            nombre: formCrear.nombre,
            nombreCorto: formCrear.nombreCorto,
            jefePersonaId: Number(formCrear.jefePersonaId),
            jornada: formCrear.jornada,
         },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Carrera creada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const carreraEditar = ref<Carrera | null>(null)
const formEditar = reactive({ nombre: '', nombreCorto: '', jefePersonaId: 0, jornada: 'DIURNA' as Carrera['jornada'] })
const errorEditar = ref<string | null>(null)

function abrirEditar(carrera: Carrera) {
   carreraEditar.value = carrera
   formEditar.nombre = carrera.nombre
   formEditar.nombreCorto = carrera.nombreCorto
   formEditar.jefePersonaId = carrera.jefePersonaId
   formEditar.jornada = carrera.jornada
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!carreraEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/carreras/${carreraEditar.value.codigo}`
      await $fetch(url, {
         method: 'PATCH',
         body: {
            nombre: formEditar.nombre,
            nombreCorto: formEditar.nombreCorto,
            jefePersonaId: Number(formEditar.jefePersonaId),
            jornada: formEditar.jornada,
         },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Carrera actualizada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const carreraAEliminar = ref<Carrera | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(carrera: Carrera) {
   carreraAEliminar.value = carrera
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!carreraAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/carreras/${carreraAEliminar.value.codigo}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Carrera eliminada', color: 'success', icon: 'i-lucide-check-circle' })
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
            <p class="text-sm text-usm-text-muted dark:text-slate-400">Carreras y sus respectivos jefes de carrera.</p>
         </div>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nueva carrera
         </UButton>
      </div>

      <!-- Filtros -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
         <UInput v-model="busqueda" icon="i-lucide-search" placeholder="Buscar por nombre o código…" class="sm:w-72" />
         <span class="text-sm text-usm-text-muted dark:text-slate-400">
            {{ carrerasFiltradas.length }} carrera{{ carrerasFiltradas.length !== 1 ? 's' : '' }}
         </span>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="6" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!carrerasFiltradas.length"
            icon="i-lucide-graduation-cap"
            message="No hay carreras registradas"
            :action="!busqueda && puedeCrear ? 'Nueva carrera' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="carrerasPagina" :columns="columnas">
            <template #jornada-cell="{ row }">
               <UBadge variant="subtle" :color="row.original.jornada === 'DIURNA' ? 'primary' : 'neutral'">
                  {{ labelJornada(row.original.jornada) }}
               </UBadge>
            </template>
            <template #jefe-cell="{ row }">
               <div>
                  <p class="text-usm-text dark:text-white">
                     {{ row.original.jefe.nombre }} {{ row.original.jefe.apellido }}
                  </p>
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">{{ row.original.jefe.email }}</p>
               </div>
            </template>
            <template #acciones-cell="{ row }">
               <div class="flex justify-end gap-1">
                  <UTooltip text="Editar">
                     <UButton
                        icon="i-lucide-pen"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        aria-label="Editar"
                        :disabled="!puedeEditar"
                        @click="abrirEditar(row.original)"
                     />
                  </UTooltip>
                  <UTooltip text="Eliminar">
                     <UButton
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        size="xs"
                        aria-label="Eliminar"
                        :disabled="!puedeBorrar"
                        @click="abrirConfirmEliminar(row.original)"
                     />
                  </UTooltip>
               </div>
            </template>
         </UTable>
      </div>

      <div v-if="carrerasFiltradas.length > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="carrerasFiltradas.length" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nueva carrera" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-carrera-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Código" name="codigo" :error="errorGuardarCodigo">
                  <UInput
                     :model-value="String(formCrear.codigo)"
                     type="number"
                     min="1"
                     class="w-full"
                     @update:model-value="formCrear.codigo = Number($event)"
                  />
               </UFormField>
               <UFormField label="Nombre" name="nombre" :error="errorGuardarNombre">
                  <UInput v-model="formCrear.nombre" placeholder="Ingeniería Civil Informática…" class="w-full" />
               </UFormField>
               <UFormField label="Nombre corto" name="nombreCorto">
                  <UInput v-model="formCrear.nombreCorto" placeholder="Ing. Civil Informática…" class="w-full" />
               </UFormField>
               <UFormField label="Jornada" name="jornada">
                  <USelect v-model="formCrear.jornada" :items="opcionesJornada" value-key="value" class="w-full" />
               </UFormField>
               <UFormField label="Jefe de carrera" name="jefePersonaId">
                  <USelect
                     v-model="formCrear.jefePersonaId"
                     :items="profesores.map((p) => ({ label: `${p.nombre} ${p.apellido}`, value: p.id }))"
                     value-key="value"
                     placeholder="Selecciona un profesor"
                     class="w-full"
                  />
                  <p v-if="!profesores.length" class="mt-1 text-xs text-usm-text-muted dark:text-slate-400">
                     No hay personas con rol Profesor registradas.
                  </p>
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
            <UButton type="submit" form="form-carrera-crear" :loading="guardando" :disabled="!profesores.length"
               >Guardar</UButton
            >
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal
         v-model:open="modalEditarMostrar"
         :title="`Editar carrera ${carreraEditar?.codigo}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm id="form-carrera-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Nombre" name="nombre" :error="errorEditar ?? undefined">
                  <UInput v-model="formEditar.nombre" class="w-full" />
               </UFormField>
               <UFormField label="Nombre corto" name="nombreCorto">
                  <UInput v-model="formEditar.nombreCorto" class="w-full" />
               </UFormField>
               <UFormField label="Jornada" name="jornada">
                  <USelect v-model="formEditar.jornada" :items="opcionesJornada" value-key="value" class="w-full" />
               </UFormField>
               <UFormField label="Jefe de carrera" name="jefePersonaId">
                  <USelect
                     v-model="formEditar.jefePersonaId"
                     :items="profesores.map((p) => ({ label: `${p.nombre} ${p.apellido}`, value: p.id }))"
                     value-key="value"
                     placeholder="Selecciona un profesor"
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
                     modalEditarMostrar = false
                  }
               "
               >Cancelar</UButton
            >
            <UButton type="submit" form="form-carrera-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar carrera"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar la carrera
            <span class="font-semibold">{{ carreraAEliminar?.nombre }}</span
            >? Solo es posible si no tiene planes de estudio asociados.
         </p>
      </ConfirmModal>
   </div>
</template>
