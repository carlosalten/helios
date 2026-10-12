<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Semestre } from '~/types/semestre'
import { SEMESTRES_POR_DEFECTO, type SemestrePorDefecto } from '~/types/preferencias'

const toast = useToast()
const { user, fetch: fetchSession } = useUserSession()

const { data: semestres, status, refresh } = await useFetch<Semestre[]>('/api/semestres')

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/semestres')

/* ── Semestre por defecto en los selectores (preferencia personal) ───────── */
const opcionesSemestrePorDefecto = SEMESTRES_POR_DEFECTO.map((o) => ({ label: o.label, value: o.valor }))
const guardandoSemestrePorDefecto = ref(false)

async function cambiarSemestrePorDefecto(semestrePorDefecto: SemestrePorDefecto) {
   guardandoSemestrePorDefecto.value = true
   try {
      await $fetch('/api/preferencias', { method: 'PATCH', body: { semestrePorDefecto } })
      await fetchSession()
      toast.add({ title: 'Semestre por defecto actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'No se pudo guardar la preferencia'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      guardandoSemestrePorDefecto.value = false
   }
}

const busqueda = ref('')

const semestresFiltrados = computed(() => {
   if (!busqueda.value.trim()) return semestres.value ?? []
   const q = normalizarTexto(busqueda.value)
   return (semestres.value ?? []).filter((s) => normalizarTexto(s.nombre).includes(q))
})

const { paginaActual, itemsPagina: semestresPagina, porPagina } = usePaginacion(semestresFiltrados)

function formatFecha(fecha: string) {
   return new Date(fecha).toLocaleDateString('es-CL', { timeZone: 'UTC' })
}

const columnas: TableColumn<Semestre>[] = [
   { accessorKey: 'nombre', header: 'Nombre' },
   { id: 'inicio', header: 'Inicio', size: 120 },
   { id: 'fin', header: 'Fin', size: 120 },
   { id: 'vigente', header: 'Vigente', size: 100 },
   { id: 'borrador', header: 'Borrador', size: 130 },
   { id: 'visible', header: 'Visible', size: 100 },
   { id: 'acciones', header: '', size: 150 },
]

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({
   nombre: '',
   fechaInicio: '',
   fechaFin: '',
   vigente: false,
   borrador: false,
   visible: true,
})
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

function abrirCrear() {
   formCrear.nombre = ''
   formCrear.fechaInicio = ''
   formCrear.fechaFin = ''
   formCrear.vigente = false
   formCrear.borrador = false
   formCrear.visible = true
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/semestres', { method: 'POST', body: { ...formCrear } })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Semestre creado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const semestreEditar = ref<Semestre | null>(null)
const formEditar = reactive({
   nombre: '',
   fechaInicio: '',
   fechaFin: '',
   vigente: false,
   borrador: false,
   visible: true,
})
const errorEditar = ref<string | null>(null)

function abrirEditar(semestre: Semestre) {
   semestreEditar.value = semestre
   formEditar.nombre = semestre.nombre
   formEditar.fechaInicio = semestre.fechaInicio.slice(0, 10)
   formEditar.fechaFin = semestre.fechaFin.slice(0, 10)
   formEditar.vigente = semestre.vigente
   formEditar.borrador = semestre.borrador
   formEditar.visible = semestre.visible
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!semestreEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/semestres/${semestreEditar.value.id}`
      await $fetch(url, { method: 'PATCH', body: { ...formEditar } })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Semestre actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Marcar como vigente ─────────────────────────────────── */
const marcandoVigente = ref<number | null>(null)

async function marcarVigente(semestre: Semestre) {
   marcandoVigente.value = semestre.id
   try {
      await $fetch(`/api/semestres/${semestre.id}/vigente`, { method: 'PATCH' })
      await refresh()
      toast.add({ title: `${semestre.nombre} marcado como vigente`, color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'No se pudo marcar como vigente'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      marcandoVigente.value = null
   }
}

/* ── Marcar como borrador ─────────────────────────────────── */
const marcandoBorrador = ref<number | null>(null)

async function marcarBorrador(semestre: Semestre) {
   marcandoBorrador.value = semestre.id
   try {
      await $fetch(`/api/semestres/${semestre.id}/borrador`, { method: 'PATCH' })
      await refresh()
      toast.add({
         title: `${semestre.nombre} marcado como borrador`,
         color: 'success',
         icon: 'i-lucide-check-circle',
      })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'No se pudo marcar como borrador'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      marcandoBorrador.value = null
   }
}

/* ── Alternar visible ────────────────────────────────────── */
const alternandoVisible = ref<number | null>(null)

async function alternarVisible(semestre: Semestre) {
   alternandoVisible.value = semestre.id
   try {
      await $fetch(`/api/semestres/${semestre.id}/visible`, { method: 'PATCH' })
      await refresh()
      toast.add({
         title: semestre.visible ? `${semestre.nombre} ocultado` : `${semestre.nombre} marcado como visible`,
         color: 'success',
         icon: 'i-lucide-check-circle',
      })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'No se pudo cambiar la visibilidad'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      alternandoVisible.value = null
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const semestreAEliminar = ref<Semestre | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(semestre: Semestre) {
   semestreAEliminar.value = semestre
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!semestreAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/semestres/${semestreAEliminar.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Semestre eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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
            <p class="text-sm text-usm-text-muted dark:text-slate-400">Semestres académicos del departamento</p>
         </div>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nuevo semestre
         </UButton>
      </div>

      <div
         class="flex flex-col gap-3 rounded-2xl border border-default bg-default p-4 sm:flex-row sm:items-center sm:justify-between"
      >
         <div class="min-w-0">
            <p class="text-sm font-medium text-usm-text dark:text-white">Semestre por defecto en los selectores</p>
            <p class="mt-0.5 text-xs text-usm-text-muted dark:text-slate-400">
               Preferencia personal: el semestre que se preselecciona en cursos, bloques horarios, feriados, horario y
               paralelos. Si el borrador no está disponible para ti, se usa el vigente.
            </p>
         </div>
         <div class="w-full sm:w-56 sm:shrink-0">
            <USelect
               :model-value="user?.semestrePorDefecto ?? 'VIGENTE'"
               :items="opcionesSemestrePorDefecto"
               value-key="value"
               icon="i-lucide-calendar-check"
               :loading="guardandoSemestrePorDefecto"
               :disabled="guardandoSemestrePorDefecto"
               class="w-full"
               @update:model-value="cambiarSemestrePorDefecto"
            />
         </div>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
         <UInput v-model="busqueda" icon="i-lucide-search" placeholder="Buscar por nombre…" class="sm:w-72" />
         <span class="text-sm text-usm-text-muted dark:text-slate-400">
            {{ semestresFiltrados.length }} semestre{{ semestresFiltrados.length !== 1 ? 's' : '' }}
         </span>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!semestresFiltrados.length"
            icon="i-lucide-calendar-range"
            message="No hay semestres registrados"
            :action="!busqueda && puedeCrear ? 'Nuevo semestre' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="semestresPagina" :columns="columnas">
            <template #inicio-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ formatFecha(row.original.fechaInicio) }}</span>
            </template>
            <template #fin-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ formatFecha(row.original.fechaFin) }}</span>
            </template>
            <template #vigente-cell="{ row }">
               <UBadge :color="row.original.vigente ? 'success' : 'neutral'" variant="subtle">
                  {{ row.original.vigente ? 'Vigente' : 'No vigente' }}
               </UBadge>
            </template>
            <template #borrador-cell="{ row }">
               <UBadge :color="row.original.borrador ? 'info' : 'neutral'" variant="subtle">
                  {{ row.original.borrador ? 'Borrador' : 'No' }}
               </UBadge>
            </template>
            <template #visible-cell="{ row }">
               <UBadge :color="row.original.visible ? 'success' : 'neutral'" variant="subtle">
                  {{ row.original.visible ? 'Visible' : 'Oculto' }}
               </UBadge>
            </template>
            <template #acciones-cell="{ row }">
               <div class="flex justify-end gap-1">
                  <UTooltip v-if="!row.original.vigente" text="Marcar como vigente">
                     <UButton
                        icon="i-lucide-badge-check"
                        color="success"
                        variant="ghost"
                        size="xs"
                        :loading="marcandoVigente === row.original.id"
                        :disabled="marcandoVigente !== null || !puedeEditar"
                        aria-label="Marcar como vigente"
                        @click="marcarVigente(row.original)"
                     />
                  </UTooltip>
                  <UTooltip v-if="!row.original.borrador" text="Marcar como borrador">
                     <UButton
                        icon="i-lucide-wrench"
                        color="info"
                        variant="ghost"
                        size="xs"
                        :loading="marcandoBorrador === row.original.id"
                        :disabled="marcandoBorrador !== null || !puedeEditar"
                        aria-label="Marcar como borrador"
                        @click="marcarBorrador(row.original)"
                     />
                  </UTooltip>
                  <UTooltip :text="row.original.visible ? 'Ocultar' : 'Mostrar'">
                     <UButton
                        :icon="row.original.visible ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                        :color="row.original.visible ? 'success' : 'neutral'"
                        variant="ghost"
                        size="xs"
                        :loading="alternandoVisible === row.original.id"
                        :disabled="alternandoVisible !== null || !puedeEditar"
                        :aria-label="row.original.visible ? 'Ocultar' : 'Mostrar'"
                        @click="alternarVisible(row.original)"
                     />
                  </UTooltip>
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

      <PaginacionTabla v-model:page="paginaActual" v-model:por-pagina="porPagina" :total="semestresFiltrados.length" />

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo semestre" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-semestre-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Nombre" name="nombre" :error="errorGuardar ?? undefined">
                  <UInput v-model="formCrear.nombre" placeholder="2026-1…" class="w-full" />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Fecha de inicio" name="fechaInicio">
                     <UInput v-model="formCrear.fechaInicio" type="date" class="w-full" />
                  </UFormField>
                  <UFormField label="Fecha de fin" name="fechaFin">
                     <UInput v-model="formCrear.fechaFin" type="date" class="w-full" />
                  </UFormField>
               </div>
               <USwitch v-model="formCrear.vigente" label="Vigente" />
               <USwitch v-model="formCrear.borrador" label="Borrador" />
               <USwitch v-model="formCrear.visible" label="Visible" />
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
            <UButton type="submit" form="form-semestre-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal v-model:open="modalEditarMostrar" title="Editar semestre" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-semestre-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Nombre" name="nombre" :error="errorEditar ?? undefined">
                  <UInput v-model="formEditar.nombre" class="w-full" />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Fecha de inicio" name="fechaInicio">
                     <UInput v-model="formEditar.fechaInicio" type="date" class="w-full" />
                  </UFormField>
                  <UFormField label="Fecha de fin" name="fechaFin">
                     <UInput v-model="formEditar.fechaFin" type="date" class="w-full" />
                  </UFormField>
               </div>
               <USwitch v-model="formEditar.vigente" label="Vigente" />
               <USwitch v-model="formEditar.borrador" label="Borrador" />
               <USwitch v-model="formEditar.visible" label="Visible" />
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
            <UButton type="submit" form="form-semestre-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar semestre"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar el semestre
            <span class="font-semibold">{{ semestreAEliminar?.nombre }}</span
            >? Solo es posible si no tiene paralelos ni bloques asociados.
         </p>
      </ConfirmModal>
   </div>
</template>
