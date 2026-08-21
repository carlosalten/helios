<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { PantallaPublica } from '~/types/pantallaPublica'
import type { Sala } from '~/types/sala'

const toast = useToast()

const [{ data: pantallas, status, refresh }, { data: salas }] = await Promise.all([
   useFetch<PantallaPublica[]>('/api/pantallas'),
   useFetch<Sala[]>('/api/salas'),
])

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/salas/pantallas')

// URL pública completa: se arma en el cliente (no hay `origin` fiable en el servidor detrás
// de un proxy) para poder copiarla/abrirla tal cual la vería la pantalla física.
const origen = computed(() => (import.meta.client ? window.location.origin : ''))
function urlPublica(codigo: string) {
   return `${origen.value}/pantallas/${codigo}`
}

async function copiarUrl(codigo: string) {
   await navigator.clipboard.writeText(urlPublica(codigo))
   toast.add({ title: 'URL copiada', color: 'success', icon: 'i-lucide-check-circle' })
}

const busqueda = ref('')
const pantallasFiltradas = computed(() => {
   if (!busqueda.value.trim()) return pantallas.value ?? []
   const q = normalizarTexto(busqueda.value)
   return (pantallas.value ?? []).filter(
      (p) => normalizarTexto(p.nombre).includes(q) || normalizarTexto(p.codigo).includes(q)
   )
})

const { paginaActual, itemsPagina: pantallasPagina, porPagina } = usePaginacion(pantallasFiltradas)

const columnas: TableColumn<PantallaPublica>[] = [
   { accessorKey: 'nombre', header: 'Nombre' },
   { accessorKey: 'codigo', header: 'Código', size: 100 },
   { id: 'salas', header: 'Salas', size: 90 },
   { accessorKey: 'segundosPorSlide', header: 'Segundos por slide', size: 140 },
   { id: 'proximasPorSala', header: 'Próximas por sala', size: 140 },
   { id: 'horario', header: 'Horario de exhibición', size: 150 },
   { id: 'url', header: 'URL pública' },
   { id: 'acciones', header: '', size: 110 },
]

// "Todas" (sin límite) se guarda como `null` — mismo criterio en el backend
// (server/api/pantallas/publico/[codigo].get.ts).
function labelProximasPorSala(valor: number | null) {
   return valor == null ? 'Todas' : String(valor)
}

// GET /api/pantallas devuelve horaInicio/horaFin como DateTime ISO completo (igual que
// Bloque.inicio/Reserva.inicio en el resto de la app) — se recorta acá, no en el backend.
function horaDeISO(horaISO: string) {
   return horaISO.slice(11, 16)
}

function labelHorario(pantalla: PantallaPublica) {
   return pantalla.horaInicio && pantalla.horaFin
      ? `${horaDeISO(pantalla.horaInicio)}–${horaDeISO(pantalla.horaFin)}`
      : '24 horas'
}

/* ── Panel de detalle: salas de la pantalla seleccionada ──────────────────── */
const pantallaSeleccionada = ref<PantallaPublica | null>(null)

function seleccionarPantalla(row: { original: PantallaPublica }) {
   pantallaSeleccionada.value = row.original
}

const filaSeleccionada = computed<Record<string, boolean>>({
   get: () => (pantallaSeleccionada.value ? { [String(pantallaSeleccionada.value.id)]: true } : {}),
   set: (valor) => {
      const id = Object.keys(valor).find((clave) => valor[clave])
      pantallaSeleccionada.value = id ? (pantallas.value?.find((p) => String(p.id) === id) ?? null) : null
   },
})

// Mantiene el panel sincronizado tras un refresh (guardar, editar, borrar, toggle de sala).
watch(pantallas, () => {
   if (pantallaSeleccionada.value) {
      pantallaSeleccionada.value = pantallas.value?.find((p) => p.id === pantallaSeleccionada.value!.id) ?? null
   }
})

const busquedaSala = ref('')
const salasFiltradas = computed(() => {
   const q = normalizarTexto(busquedaSala.value.trim())
   return (salas.value ?? []).filter(
      (s) => !q || normalizarTexto(s.codigo).includes(q) || normalizarTexto(s.tipoSala.nombre).includes(q)
   )
})

function salaAsignada(codigo: string) {
   return pantallaSeleccionada.value?.salas.some((s) => s.codigo === codigo) ?? false
}

const toggling = ref<string | null>(null)

async function toggleSala(salaCodigo: string) {
   if (!pantallaSeleccionada.value || toggling.value) return
   toggling.value = salaCodigo
   try {
      await $fetch('/api/pantallas/asignacion/toggle', {
         method: 'POST',
         body: { pantallaId: pantallaSeleccionada.value.id, salaCodigo },
      })
      await refresh()
   } catch {
      toast.add({ title: 'Error al actualizar la asignación', color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      toggling.value = null
   }
}

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
// `proximasPorSala: null` por defecto ("Todas") — mismo default que la columna en BD, para que
// una pantalla nueva se comporte igual que las existentes hasta que alguien la acote a mano.
const formCrear = reactive({
   nombre: '',
   codigo: '',
   segundosPorSlide: 15,
   proximasPorSala: null as number | null,
   horaInicio: null as string | null,
   horaFin: null as string | null,
})
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

function abrirCrear() {
   formCrear.nombre = ''
   formCrear.codigo = ''
   formCrear.segundosPorSlide = 15
   formCrear.proximasPorSala = null
   formCrear.horaInicio = null
   formCrear.horaFin = null
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/pantallas', {
         method: 'POST',
         body: {
            nombre: formCrear.nombre,
            codigo: formCrear.codigo,
            segundosPorSlide: Number(formCrear.segundosPorSlide),
            proximasPorSala: formCrear.proximasPorSala,
            horaInicio: formCrear.horaInicio,
            horaFin: formCrear.horaFin,
         },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Pantalla creada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const pantallaEditar = ref<PantallaPublica | null>(null)
const formEditar = reactive({
   nombre: '',
   codigo: '',
   segundosPorSlide: 15,
   proximasPorSala: null as number | null,
   horaInicio: null as string | null,
   horaFin: null as string | null,
})
const errorEditar = ref<string | null>(null)

function abrirEditar(pantalla: PantallaPublica) {
   pantallaEditar.value = pantalla
   formEditar.nombre = pantalla.nombre
   formEditar.codigo = pantalla.codigo
   formEditar.segundosPorSlide = pantalla.segundosPorSlide
   formEditar.proximasPorSala = pantalla.proximasPorSala
   formEditar.horaInicio = pantalla.horaInicio ? horaDeISO(pantalla.horaInicio) : null
   formEditar.horaFin = pantalla.horaFin ? horaDeISO(pantalla.horaFin) : null
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!pantallaEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      await $fetch(`/api/pantallas/${pantallaEditar.value.id}`, {
         method: 'PATCH',
         body: {
            nombre: formEditar.nombre,
            codigo: formEditar.codigo,
            segundosPorSlide: Number(formEditar.segundosPorSlide),
            proximasPorSala: formEditar.proximasPorSala,
            horaInicio: formEditar.horaInicio,
            horaFin: formEditar.horaFin,
         },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Pantalla actualizada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

// Alterna entre "Todas" (null) y un número — usado por el checkbox "Todas" de ambos
// formularios. Al desmarcarlo, arranca en 1 (no en el último valor, que ya se perdió al
// guardar null). `UCheckbox` puede emitir 'indeterminate' además de boolean; acá no se usa ese
// estado, así que solo `true` cuenta como "marcado".
function alternarTodasCrear(todas: boolean | 'indeterminate') {
   formCrear.proximasPorSala = todas === true ? null : 1
}
function alternarTodasEditar(todas: boolean | 'indeterminate') {
   formEditar.proximasPorSala = todas === true ? null : 1
}

// Igual criterio que alternarTodasCrear/Editar: "sin restricción" (24 horas) se guarda como
// horaInicio/horaFin nulos; al desmarcarlo, arranca en un rango sensato (jornada de oficina)
// en vez de dejarlo vacío.
function alternarSinRestriccionCrear(sinRestriccion: boolean | 'indeterminate') {
   formCrear.horaInicio = sinRestriccion === true ? null : '07:00'
   formCrear.horaFin = sinRestriccion === true ? null : '22:00'
}
function alternarSinRestriccionEditar(sinRestriccion: boolean | 'indeterminate') {
   formEditar.horaInicio = sinRestriccion === true ? null : '07:00'
   formEditar.horaFin = sinRestriccion === true ? null : '22:00'
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const pantallaAEliminar = ref<PantallaPublica | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(pantalla: PantallaPublica) {
   pantallaAEliminar.value = pantalla
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!pantallaAEliminar.value) return
   eliminando.value = true
   try {
      await $fetch(`/api/pantallas/${pantallaAEliminar.value.id}`, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      if (pantallaSeleccionada.value?.id === pantallaAEliminar.value.id) pantallaSeleccionada.value = null
      await refresh()
      toast.add({ title: 'Pantalla eliminada', color: 'success', icon: 'i-lucide-check-circle' })
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
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Pantallas físicas en lugares públicos que muestran en loop el horario de una o más salas.
         </p>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nueva pantalla
         </UButton>
      </div>

      <UInput v-model="busqueda" icon="i-lucide-search" placeholder="Buscar por nombre o código…" class="sm:w-72" />

      <TableSkeleton v-if="status === 'pending'" :rows="4" />

      <div v-else class="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6">
         <div>
            <div class="overflow-hidden rounded-2xl border border-default bg-default">
               <EmptyState
                  v-if="!pantallasFiltradas.length"
                  icon="i-lucide-monitor"
                  message="No hay pantallas registradas"
                  :action="!busqueda && puedeCrear ? 'Nueva pantalla' : undefined"
                  @action="abrirCrear"
               />
               <UTable
                  v-else
                  v-model:row-selection="filaSeleccionada"
                  :data="pantallasPagina"
                  :columns="columnas"
                  :get-row-id="(row) => String(row.id)"
                  @select="(_e, row) => seleccionarPantalla(row)"
               >
                  <template #salas-cell="{ row }">
                     <UBadge variant="subtle" color="neutral">{{ row.original.salas.length }}</UBadge>
                  </template>
                  <template #proximasPorSala-cell="{ row }">
                     <UBadge variant="subtle" color="neutral">
                        {{ labelProximasPorSala(row.original.proximasPorSala) }}
                     </UBadge>
                  </template>
                  <template #horario-cell="{ row }">
                     <UBadge variant="subtle" :color="row.original.horaInicio ? 'info' : 'neutral'">
                        {{ labelHorario(row.original) }}
                     </UBadge>
                  </template>
                  <template #url-cell="{ row }">
                     <div class="flex items-center gap-1">
                        <code class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                           /pantallas/{{ row.original.codigo }}
                        </code>
                        <UTooltip text="Copiar URL">
                           <UButton
                              icon="i-lucide-copy"
                              color="neutral"
                              variant="ghost"
                              size="xs"
                              aria-label="Copiar URL"
                              @click.stop="copiarUrl(row.original.codigo)"
                           />
                        </UTooltip>
                        <UTooltip text="Abrir pantalla">
                           <UButton
                              icon="i-lucide-external-link"
                              color="neutral"
                              variant="ghost"
                              size="xs"
                              aria-label="Abrir pantalla"
                              :to="`/pantallas/${row.original.codigo}`"
                              target="_blank"
                              @click.stop
                           />
                        </UTooltip>
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

            <div v-if="pantallasFiltradas.length > porPagina" class="mt-4 flex justify-center">
               <UPagination
                  v-model:page="paginaActual"
                  :total="pantallasFiltradas.length"
                  :items-per-page="porPagina"
               />
            </div>
         </div>

         <!-- Panel de detalle: salas de la pantalla seleccionada -->
         <div class="mt-6 space-y-3 lg:sticky lg:top-6 lg:mt-0">
            <h3 class="font-semibold text-usm-text dark:text-white">Salas de la pantalla</h3>
            <div v-if="pantallaSeleccionada" class="rounded-2xl border border-default bg-default p-4">
               <div class="mb-3 flex items-start justify-between gap-2">
                  <p class="truncate text-sm font-semibold text-usm-text dark:text-white">
                     {{ pantallaSeleccionada.nombre }}
                  </p>
                  <UButton
                     icon="i-lucide-x"
                     color="neutral"
                     variant="ghost"
                     size="xs"
                     aria-label="Cerrar"
                     @click="
                        () => {
                           pantallaSeleccionada = null
                        }
                     "
                  />
               </div>

               <UInput
                  v-model="busquedaSala"
                  icon="i-lucide-search"
                  placeholder="Buscar sala…"
                  class="mb-3 w-full"
                  size="sm"
               />

               <EmptyState
                  v-if="!salasFiltradas.length"
                  icon="i-lucide-door-open"
                  message="No hay salas registradas."
               />
               <div v-else class="max-h-96 space-y-1 overflow-y-auto">
                  <label
                     v-for="sala in salasFiltradas"
                     :key="sala.codigo"
                     class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-elevated/50"
                  >
                     <UCheckbox
                        :model-value="salaAsignada(sala.codigo)"
                        :disabled="toggling !== null || !puedeEditar"
                        :ui="{ base: toggling === sala.codigo ? 'opacity-50' : '' }"
                        @update:model-value="toggleSala(sala.codigo)"
                     />
                     <div class="min-w-0">
                        <p class="truncate font-medium text-usm-text dark:text-white">{{ sala.codigo }}</p>
                        <p class="truncate text-usm-text-muted dark:text-slate-400">{{ sala.tipoSala.nombre }}</p>
                     </div>
                  </label>
               </div>
            </div>
            <EmptyState
               v-else
               icon="i-lucide-mouse-pointer-click"
               message="Haz click en una pantalla para elegir qué salas muestra."
            />
         </div>
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nueva pantalla" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-pantalla-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Nombre" name="nombre" :error="errorGuardar ?? undefined">
                  <UInput v-model="formCrear.nombre" placeholder="Pantalla hall Edificio U" class="w-full" />
               </UFormField>
               <UFormField label="Código" name="codigo" description="Se usa en la URL pública: /pantallas/<código>">
                  <UInput v-model="formCrear.codigo" placeholder="PU1" class="w-full" />
               </UFormField>
               <UFormField label="Segundos por slide" name="segundosPorSlide">
                  <UInput
                     :model-value="String(formCrear.segundosPorSlide)"
                     type="number"
                     min="3"
                     max="300"
                     class="w-full"
                     @update:model-value="formCrear.segundosPorSlide = Number($event)"
                  />
               </UFormField>
               <UFormField
                  label="Próximas clases por sala"
                  name="proximasPorSala"
                  description="Cuántas próximas clases mostrar de cada sala. «Todas» muestra las que queden por comenzar en el resto del día."
               >
                  <div class="flex items-center gap-3">
                     <UInput
                        :model-value="formCrear.proximasPorSala === null ? '' : String(formCrear.proximasPorSala)"
                        type="number"
                        min="1"
                        max="50"
                        :disabled="formCrear.proximasPorSala === null"
                        class="w-full"
                        @update:model-value="formCrear.proximasPorSala = Number($event) || 1"
                     />
                     <UCheckbox
                        :model-value="formCrear.proximasPorSala === null"
                        label="Todas"
                        class="shrink-0"
                        @update:model-value="alternarTodasCrear"
                     />
                  </div>
               </UFormField>
               <UFormField
                  label="Horario de exhibición"
                  description="Fuera de este horario la pantalla deja de refrescarse (modo de ahorro) — útil para la madrugada, cuando nadie la ve."
               >
                  <div class="flex flex-wrap items-center gap-3">
                     <div v-if="formCrear.horaInicio != null" class="flex items-center gap-2">
                        <UInput
                           :model-value="formCrear.horaInicio ?? ''"
                           type="time"
                           class="w-32"
                           @update:model-value="formCrear.horaInicio = String($event)"
                        />
                        <span class="text-usm-text-muted dark:text-slate-400">a</span>
                        <UInput
                           :model-value="formCrear.horaFin ?? ''"
                           type="time"
                           class="w-32"
                           @update:model-value="formCrear.horaFin = String($event)"
                        />
                     </div>
                     <UCheckbox
                        :model-value="formCrear.horaInicio == null"
                        label="Sin restricción (24 horas)"
                        class="shrink-0"
                        @update:model-value="alternarSinRestriccionCrear"
                     />
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
            <UButton type="submit" form="form-pantalla-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal
         v-model:open="modalEditarMostrar"
         :title="`Editar pantalla — ${pantallaEditar?.nombre}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm id="form-pantalla-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Nombre" name="nombre" :error="errorEditar ?? undefined">
                  <UInput v-model="formEditar.nombre" class="w-full" />
               </UFormField>
               <UFormField label="Código" name="codigo" description="Se usa en la URL pública: /pantallas/<código>">
                  <UInput v-model="formEditar.codigo" class="w-full" />
               </UFormField>
               <UFormField label="Segundos por slide" name="segundosPorSlide">
                  <UInput
                     :model-value="String(formEditar.segundosPorSlide)"
                     type="number"
                     min="3"
                     max="300"
                     class="w-full"
                     @update:model-value="formEditar.segundosPorSlide = Number($event)"
                  />
               </UFormField>
               <UFormField
                  label="Próximas clases por sala"
                  name="proximasPorSala"
                  description="Cuántas próximas clases mostrar de cada sala. «Todas» muestra las que queden por comenzar en el resto del día."
               >
                  <div class="flex items-center gap-3">
                     <UInput
                        :model-value="formEditar.proximasPorSala === null ? '' : String(formEditar.proximasPorSala)"
                        type="number"
                        min="1"
                        max="50"
                        :disabled="formEditar.proximasPorSala === null"
                        class="w-full"
                        @update:model-value="formEditar.proximasPorSala = Number($event) || 1"
                     />
                     <UCheckbox
                        :model-value="formEditar.proximasPorSala === null"
                        label="Todas"
                        class="shrink-0"
                        @update:model-value="alternarTodasEditar"
                     />
                  </div>
               </UFormField>
               <UFormField
                  label="Horario de exhibición"
                  description="Fuera de este horario la pantalla deja de refrescarse (modo de ahorro) — útil para la madrugada, cuando nadie la ve."
               >
                  <div class="flex flex-wrap items-center gap-3">
                     <div v-if="formEditar.horaInicio != null" class="flex items-center gap-2">
                        <UInput
                           :model-value="formEditar.horaInicio ?? ''"
                           type="time"
                           class="w-32"
                           @update:model-value="formEditar.horaInicio = String($event)"
                        />
                        <span class="text-usm-text-muted dark:text-slate-400">a</span>
                        <UInput
                           :model-value="formEditar.horaFin ?? ''"
                           type="time"
                           class="w-32"
                           @update:model-value="formEditar.horaFin = String($event)"
                        />
                     </div>
                     <UCheckbox
                        :model-value="formEditar.horaInicio == null"
                        label="Sin restricción (24 horas)"
                        class="shrink-0"
                        @update:model-value="alternarSinRestriccionEditar"
                     />
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
            <UButton type="submit" form="form-pantalla-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar pantalla"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar la pantalla
            <span class="font-semibold">{{ pantallaAEliminar?.nombre }}</span>
            ({{ pantallaAEliminar?.codigo }})? Su URL pública dejará de mostrar horarios.
         </p>
      </ConfirmModal>
   </div>
</template>
