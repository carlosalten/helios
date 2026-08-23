<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TtEstudianteDisponible, TtGrupo, TtGrupoConIntegrantes, TtProceso } from '~/types/titulaciones'

const toast = useToast()

const [
   { data: grupos, status, refresh },
   { data: procesos },
   { data: estudiantesDisponibles, refresh: refreshEstudiantesDisponibles },
] = await Promise.all([
   useFetch<TtGrupoConIntegrantes[]>('/api/titulaciones/grupos'),
   useFetch<TtProceso[]>('/api/titulaciones/procesos'),
   useFetch<TtEstudianteDisponible[]>('/api/titulaciones/grupos/estudiantes-disponibles'),
])

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/titulaciones/grupos')

/* ── Filtro por proceso ──────────────────────────────────── */
const procesosOrdenadosDesc = computed(() => [...(procesos.value ?? [])].sort((a, b) => b.anio - a.anio))
const itemsProcesoFiltro = computed(() =>
   procesosOrdenadosDesc.value.map((p) => ({ label: String(p.anio), value: p.id }))
)
// Por defecto, el proceso del año más grande (el primero tras ordenar descendente).
const procesoFiltroId = ref<number | undefined>(procesosOrdenadosDesc.value[0]?.id)

const gruposFiltrados = computed(() =>
   (grupos.value ?? []).filter((g) => procesoFiltroId.value == null || g.procesoId === procesoFiltroId.value)
)

const { paginaActual, itemsPagina: gruposPagina, porPagina } = usePaginacion(gruposFiltrados)

const columnas: TableColumn<TtGrupoConIntegrantes>[] = [
   { accessorKey: 'nombre', header: 'Nombre' },
   { accessorKey: 'numero', header: 'Número', size: 90 },
   { id: 'proceso', header: 'Proceso', size: 120 },
   { id: 'integrantes', header: 'Integrantes', size: 100 },
   { id: 'estadoPropuestas', header: 'Estado Propuestas', size: 160 },
   { id: 'guiaAsignado', header: 'Guía asignado', size: 130 },
   { id: 'acciones', header: '', size: 80 },
]

function nombreCompletoIntegrante(integrante: { nombres: string; apellidoPaterno: string; apellidoMaterno: string }) {
   return `${integrante.nombres} ${integrante.apellidoPaterno} ${integrante.apellidoMaterno}`
}

// "Asignado" solo si TODOS los integrantes comparten el mismo guía — mismo criterio que
// guiaEquipo() en /titulaciones/asignacion-guia, donde se hace la asignación real.
function guiaDeGrupo(grupo: TtGrupoConIntegrantes) {
   const primero = grupo.estudiantes[0]?.guia
   if (!primero) return null
   const mismoGuia = grupo.estudiantes.every((e) => e.guia?.email === primero.email)
   return mismoGuia ? primero : null
}

function colorEstado(estado: string | null) {
   if (estado === 'Pendiente') return 'info'
   if (estado === 'Rechazada') return 'error'
   if (estado === 'Aceptada') return 'success'
   if (estado === 'Antecedentes solicitados') return 'warning'
   return 'neutral'
}

const ESTADO_PROPUESTAS_SIN = 'Sin Propuestas'
const ESTADO_PROPUESTAS_ACEPTADAS = 'Propuestas Aceptadas'
const ESTADO_PROPUESTAS_RECHAZADAS = 'Propuestas Rechazadas'
const ESTADO_PROPUESTAS_PENDIENTES = 'Propuestas Pendientes'

// Siempre en base al estado de la última propuesta ingresada por cada alumno (`estadoPropuesta`,
// ver GET /api/titulaciones/grupos) — el mismo valor que ya se muestra por integrante en el
// slideover, solo agregado a nivel de grupo.
function estadoPropuestasGrupo(grupo: TtGrupoConIntegrantes) {
   const estados = grupo.estudiantes.map((e) => e.estadoPropuesta)
   if (!estados.length || estados.every((e) => e === null)) return ESTADO_PROPUESTAS_SIN
   if (estados.every((e) => e === 'Aceptada')) return ESTADO_PROPUESTAS_ACEPTADAS
   if (estados.every((e) => e === 'Rechazada')) return ESTADO_PROPUESTAS_RECHAZADAS
   return ESTADO_PROPUESTAS_PENDIENTES
}

function colorEstadoPropuestas(estado: string) {
   if (estado === ESTADO_PROPUESTAS_ACEPTADAS) return 'success'
   if (estado === ESTADO_PROPUESTAS_RECHAZADAS) return 'error'
   if (estado === ESTADO_PROPUESTAS_PENDIENTES) return 'warning'
   return 'neutral'
}

const itemsProceso = computed(() => (procesos.value ?? []).map((p) => ({ label: String(p.anio), value: p.id })) ?? [])

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({ nombre: '', subtitulo: '', numero: 1, procesoId: 0 })
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)
// El servidor indica en `data.campo` cuál de los tres falló (ver crearTtGrupoSchema y los
// endpoints en server/api/titulaciones/grupos) — nunca se adivina a partir del texto del
// mensaje, porque mensajes como "Máximo 50 caracteres" no mencionan el campo.
const errorGuardarCampo = ref<string | undefined>(undefined)
const errorGuardarNombre = computed(() =>
   errorGuardarCampo.value === 'nombre' ? (errorGuardar.value ?? undefined) : undefined
)
const errorGuardarNumero = computed(() =>
   errorGuardarCampo.value === 'numero' ? (errorGuardar.value ?? undefined) : undefined
)
const errorGuardarProceso = computed(() =>
   errorGuardarCampo.value === 'procesoId' ? (errorGuardar.value ?? undefined) : undefined
)

function abrirCrear() {
   formCrear.nombre = ''
   formCrear.subtitulo = ''
   formCrear.numero = 1
   formCrear.procesoId = procesos.value?.[0]?.id ?? 0
   errorGuardar.value = null
   errorGuardarCampo.value = undefined
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   errorGuardarCampo.value = undefined
   try {
      await $fetch('/api/titulaciones/grupos', {
         method: 'POST',
         body: {
            nombre: formCrear.nombre,
            subtitulo: formCrear.subtitulo,
            numero: Number(formCrear.numero),
            procesoId: Number(formCrear.procesoId),
         },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Grupo agregado', color: 'success', icon: 'i-lucide-check-circle' })
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
const grupoEditar = ref<TtGrupo | null>(null)
const formEditar = reactive({ nombre: '', subtitulo: '', numero: 1, procesoId: 0 })
const errorEditar = ref<string | null>(null)
// Ver comentario de errorGuardarCampo: mismo criterio, campo indicado por el servidor.
const errorEditarCampo = ref<string | undefined>(undefined)
const errorEditarNombre = computed(() =>
   errorEditarCampo.value === 'nombre' ? (errorEditar.value ?? undefined) : undefined
)
const errorEditarNumero = computed(() =>
   errorEditarCampo.value === 'numero' ? (errorEditar.value ?? undefined) : undefined
)
const errorEditarProceso = computed(() =>
   errorEditarCampo.value === 'procesoId' ? (errorEditar.value ?? undefined) : undefined
)

function abrirEditar(grupo: TtGrupo) {
   grupoEditar.value = grupo
   formEditar.nombre = grupo.nombre
   formEditar.subtitulo = grupo.subtitulo ?? ''
   formEditar.numero = grupo.numero
   formEditar.procesoId = grupo.procesoId
   errorEditar.value = null
   errorEditarCampo.value = undefined
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!grupoEditar.value) return
   guardando.value = true
   errorEditar.value = null
   errorEditarCampo.value = undefined
   try {
      const url: string = `/api/titulaciones/grupos/${grupoEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: {
            nombre: formEditar.nombre,
            subtitulo: formEditar.subtitulo,
            numero: Number(formEditar.numero),
            procesoId: Number(formEditar.procesoId),
         },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Grupo actualizado', color: 'success', icon: 'i-lucide-check-circle' })
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

/* ── Detalle (slideover) ─────────────────────────────────── */
const grupoSeleccionado = ref<TtGrupoConIntegrantes | null>(null)
const slideoverAbierto = ref(false)
function seleccionarGrupo(row: { original: TtGrupoConIntegrantes }) {
   grupoSeleccionado.value = row.original
   slideoverAbierto.value = true
}
const filaSeleccionada = computed({
   get: () => (grupoSeleccionado.value ? { [String(grupoSeleccionado.value.id)]: true } : {}),
   set: (val: Record<string, boolean>) => {
      const id = Object.keys(val)[0]
      grupoSeleccionado.value = id ? (grupos.value?.find((g) => String(g.id) === id) ?? null) : null
   },
})

// Vuelve a apuntar grupoSeleccionado al objeto fresco de `grupos` tras un refresh (useFetch
// reemplaza el array completo, así que la referencia guardada en grupoSeleccionado queda obsoleta).
async function recargarTrasCambioIntegrantes() {
   await Promise.all([refresh(), refreshEstudiantesDisponibles()])
   const id = grupoSeleccionado.value?.id
   grupoSeleccionado.value = id != null ? (grupos.value?.find((g) => g.id === id) ?? null) : null
}

// Solo estudiantes del proceso seleccionado en el filtro de arriba y sin grupo asignado — uno ya
// inscrito en otro grupo no aparece acá (hay que quitarlo de ese grupo primero).
const itemsEstudiantesDisponibles = computed(() => {
   if (!grupoSeleccionado.value) return []
   return (estudiantesDisponibles.value ?? [])
      .filter((e) => e.procesoId === procesoFiltroId.value && e.grupoId == null)
      .map((e) => ({ label: `${nombreCompletoIntegrante(e)} · ${e.run}`, value: e.email }))
})

// Ref real (no un `undefined` literal en el template) para que el USelectMenu efectivamente
// vuelva a mostrar el placeholder tras agregar: si el `model-value` pasado nunca cambia de
// referencia, Vue no vuelve a empujarlo al componente y el texto de la última selección queda
// pegado en el trigger aunque la selección ya se haya procesado.
const estudianteSeleccionMenu = ref<string | undefined>(undefined)
const agregandoIntegrante = ref(false)
async function agregarIntegrante(email: string | undefined) {
   estudianteSeleccionMenu.value = email
   if (!email || !grupoSeleccionado.value) return
   agregandoIntegrante.value = true
   try {
      await $fetch(`/api/titulaciones/grupos/${grupoSeleccionado.value.id}/integrantes`, {
         method: 'POST',
         body: { email },
      })
      await recargarTrasCambioIntegrantes()
      toast.add({ title: 'Integrante agregado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al agregar'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      agregandoIntegrante.value = false
      estudianteSeleccionMenu.value = undefined
   }
}

const quitandoEmail = ref<string | null>(null)
async function quitarIntegrante(integrante: { email: string }) {
   if (!grupoSeleccionado.value) return
   quitandoEmail.value = integrante.email
   try {
      await $fetch(
         `/api/titulaciones/grupos/${grupoSeleccionado.value.id}/integrantes/${encodeURIComponent(integrante.email)}`,
         { method: 'DELETE' }
      )
      await recargarTrasCambioIntegrantes()
      toast.add({ title: 'Integrante quitado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al quitar'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      quitandoEmail.value = null
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

      <UFormField label="Proceso" class="max-w-xs">
         <USelectMenu v-model="procesoFiltroId" :items="itemsProcesoFiltro" value-key="value" class="w-full" />
      </UFormField>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!gruposFiltrados.length"
            icon="i-lucide-users"
            :message="grupos?.length ? 'No hay grupos para el proceso seleccionado.' : 'No hay grupos registrados'"
            :action="puedeCrear ? 'Nuevo grupo' : undefined"
            @action="abrirCrear"
         />
         <UTable
            v-else
            v-model:row-selection="filaSeleccionada"
            :data="gruposPagina"
            :columns="columnas"
            :get-row-id="(row) => String(row.id)"
            class="cursor-pointer"
            @select="(_e, row) => seleccionarGrupo(row)"
         >
            <template #nombre-cell="{ row }">
               <div class="min-w-0">
                  <p class="text-usm-text dark:text-white">{{ row.original.nombre }}</p>
                  <p v-if="row.original.subtitulo" class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                     {{ row.original.subtitulo }}
                  </p>
               </div>
            </template>
            <template #proceso-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ row.original.proceso.anio }}</span>
            </template>
            <template #integrantes-cell="{ row }">
               <UBadge variant="subtle" color="neutral">{{ row.original.estudiantes.length }}</UBadge>
            </template>
            <template #estadoPropuestas-cell="{ row }">
               <UBadge :color="colorEstadoPropuestas(estadoPropuestasGrupo(row.original))" variant="subtle">
                  {{ estadoPropuestasGrupo(row.original) }}
               </UBadge>
            </template>
            <template #guiaAsignado-cell="{ row }">
               <UBadge :color="guiaDeGrupo(row.original) ? 'success' : 'neutral'" variant="subtle">
                  {{ guiaDeGrupo(row.original) ? 'Sí' : 'No' }}
               </UBadge>
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
                        @click.stop="abrirEditar(row.original)"
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
                        @click.stop="abrirConfirmEliminar(row.original)"
                     />
                  </UTooltip>
               </div>
            </template>
         </UTable>
      </div>

      <div v-if="gruposFiltrados.length > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="gruposFiltrados.length" :items-per-page="porPagina" />
      </div>

      <!-- Detalle (integrantes) -->
      <USlideover
         v-model:open="slideoverAbierto"
         :title="grupoSeleccionado?.nombre"
         :description="grupoSeleccionado ? `Proceso ${grupoSeleccionado.proceso.anio}` : undefined"
         :ui="{
            description: 'text-usm-blue dark:text-usm-cyan',
            content: 'w-[90vw] max-w-[90vw] lg:w-[40vw] lg:max-w-[40vw]',
         }"
      >
         <template #body>
            <div v-if="grupoSeleccionado" class="space-y-4">
               <USelectMenu
                  v-if="puedeEditar"
                  :model-value="estudianteSeleccionMenu"
                  :items="itemsEstudiantesDisponibles"
                  value-key="value"
                  :loading="agregandoIntegrante"
                  icon="i-lucide-user-plus"
                  placeholder="Buscar estudiante para agregar…"
                  :search-input="{ placeholder: 'Buscar por nombre o RUN…' }"
                  class="w-full"
                  @update:model-value="agregarIntegrante"
               />

               <div class="flex items-center gap-2 text-sm">
                  <span class="font-medium text-usm-text dark:text-white">Guía:</span>
                  <span class="text-usm-text-muted dark:text-slate-400">
                     {{
                        guiaDeGrupo(grupoSeleccionado)
                           ? `${guiaDeGrupo(grupoSeleccionado)!.nombre} ${guiaDeGrupo(grupoSeleccionado)!.apellido}`
                           : 'Sin asignar'
                     }}
                  </span>
               </div>

               <div class="space-y-3">
                  <EmptyState
                     v-if="!grupoSeleccionado.estudiantes.length"
                     icon="i-lucide-user-x"
                     message="Este grupo no tiene integrantes."
                  />
                  <div
                     v-for="integrante in grupoSeleccionado.estudiantes"
                     :key="integrante.email"
                     class="flex items-center justify-between gap-3 rounded-lg border border-default p-3"
                  >
                     <div class="min-w-0">
                        <p class="truncate text-sm font-medium text-usm-text dark:text-white">
                           {{ nombreCompletoIntegrante(integrante) }}
                        </p>
                        <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">{{ integrante.run }}</p>
                     </div>
                     <div class="flex shrink-0 items-center gap-2">
                        <UBadge :color="colorEstado(integrante.estadoPropuesta)" variant="subtle">
                           {{ integrante.estadoPropuesta ?? 'Sin propuesta' }}
                        </UBadge>
                        <UTooltip v-if="puedeEditar" text="Quitar del grupo">
                           <UButton
                              icon="i-lucide-user-minus"
                              color="error"
                              variant="ghost"
                              size="xs"
                              aria-label="Quitar del grupo"
                              :loading="quitandoEmail === integrante.email"
                              @click="quitarIntegrante(integrante)"
                           />
                        </UTooltip>
                     </div>
                  </div>
               </div>
            </div>
         </template>
      </USlideover>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo grupo" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-grupo-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Nombre" name="nombre" :error="errorGuardarNombre">
                  <UInput v-model="formCrear.nombre" placeholder="Grupo 1…" class="w-full" />
               </UFormField>
               <UFormField label="Subtítulo (opcional)" name="subtitulo">
                  <UInput v-model="formCrear.subtitulo" maxlength="100" class="w-full" />
               </UFormField>
               <UFormField label="Número" name="numero" :error="errorGuardarNumero">
                  <UInput v-model.number="formCrear.numero" type="number" :min="1" :step="1" class="w-full" />
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
               <UFormField label="Subtítulo (opcional)" name="subtitulo">
                  <UInput v-model="formEditar.subtitulo" maxlength="100" class="w-full" />
               </UFormField>
               <UFormField label="Número" name="numero" :error="errorEditarNumero">
                  <UInput v-model.number="formEditar.numero" type="number" :min="1" :step="1" class="w-full" />
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
