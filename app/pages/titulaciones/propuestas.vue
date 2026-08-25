<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CatalogosPropuesta, TtProceso, TtPropuestaRevision } from '~/types/titulaciones'
import { MODALIDADES_PROPUESTA } from '~/types/titulaciones'

const toast = useToast()

const { puedeBorrar, puedeEditar } = usePermiso('/titulaciones/propuestas')

const [{ data: propuestas, status, refresh }, { data: catalogos }, { data: procesos }] = await Promise.all([
   useFetch<TtPropuestaRevision[]>('/api/titulaciones/propuestas'),
   useFetch<CatalogosPropuesta>('/api/titulaciones/propuestas/catalogos'),
   useFetch<TtProceso[]>('/api/titulaciones/procesos'),
])

/* ── Filtro por proceso (mismo patrón que /titulaciones/grupos) ─────────── */
const procesosOrdenadosDesc = computed(() => [...(procesos.value ?? [])].sort((a, b) => b.anio - a.anio))
const itemsProcesoFiltro = computed(() =>
   procesosOrdenadosDesc.value.map((p) => ({ label: String(p.anio), value: p.id }))
)
// Por defecto, el proceso del año más grande (el primero tras ordenar descendente).
const procesoFiltroId = ref<number | undefined>(procesosOrdenadosDesc.value[0]?.id)
const propuestasDelProceso = computed(() =>
   (propuestas.value ?? []).filter(
      (p) => procesoFiltroId.value == null || p.estudiante.procesoId === procesoFiltroId.value
   )
)

function ultimoEstado(propuesta: TtPropuestaRevision) {
   return propuesta.estados[0]?.estado ?? null
}

function fechaUltimoCambio(propuesta: TtPropuestaRevision) {
   return propuesta.estados[0]?.fechaHora ?? null
}

function colorEstado(estado: string | null) {
   if (estado === 'Pendiente') return 'info'
   if (estado === 'Rechazada') return 'error'
   if (estado === 'Aceptada') return 'success'
   if (estado === 'Antecedentes solicitados') return 'warning'
   return 'neutral'
}

function dotEstado(estado: string) {
   if (estado === 'Pendiente') return 'bg-info'
   if (estado === 'Rechazada') return 'bg-error'
   if (estado === 'Antecedentes solicitados') return 'bg-warning'
   return 'bg-success'
}

function iconoEstado(estado: string) {
   if (estado === 'Pendiente') return 'i-lucide-clock'
   if (estado === 'Rechazada') return 'i-lucide-x'
   if (estado === 'Antecedentes solicitados') return 'i-lucide-message-circle-question'
   return 'i-lucide-check'
}

function fechaFormateada(fecha: string) {
   return new Date(fecha).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
}

function nombreCompleto(propuesta: TtPropuestaRevision) {
   return `${propuesta.estudiante.nombres} ${propuesta.estudiante.apellidoPaterno} ${propuesta.estudiante.apellidoMaterno}`
}

// Se fija al cargar la página y se vuelve a fijar al presionar "Actualizar" — no tiene sentido
// que cambie sola sin que el usuario lo pida, mismo criterio que la hora del dashboard
// (app/pages/index.vue).
const ultimaActualizacion = ref(fechaFormateada(new Date().toISOString()))

const { conIndicador } = useIndicadorCarga()
async function actualizarPagina() {
   await conIndicador(() => refresh())
   ultimaActualizacion.value = fechaFormateada(new Date().toISOString())
}

/* ── Métricas ─────────────────────────────────────────────── */
function contarPorEstado(items: TtPropuestaRevision[]) {
   return {
      total: items.length,
      pendientes: items.filter((p) => ultimoEstado(p) === 'Pendiente').length,
      aceptadas: items.filter((p) => ultimoEstado(p) === 'Aceptada').length,
      rechazadas: items.filter((p) => ultimoEstado(p) === 'Rechazada').length,
      antecedentes: items.filter((p) => ultimoEstado(p) === 'Antecedentes solicitados').length,
   }
}

const metricasTotal = computed(() => contarPorEstado(propuestasDelProceso.value))

const metricasPorModalidad = computed(() =>
   MODALIDADES_PROPUESTA.map((modalidad) => {
      const items = propuestasDelProceso.value.filter((p) => p.modalidad === modalidad)
      const conteo = contarPorEstado(items)
      const porcentaje = metricasTotal.value.total ? Math.round((items.length / metricasTotal.value.total) * 100) : 0
      return { modalidad, ...conteo, porcentaje }
   })
)

/* ── Filtros ──────────────────────────────────────────────── */
const busqueda = ref('')
const estadoFiltro = ref('__todos__')
const modalidadFiltro = ref('__todos__')
const grupoFiltro = ref<number | '__todos__'>('__todos__')
const rolFiltro = ref<number | '__todos__'>('__todos__')

const itemsEstado = [
   { label: 'Todos los estados', value: '__todos__' },
   { label: 'Pendiente', value: 'Pendiente' },
   { label: 'Aceptada', value: 'Aceptada' },
   { label: 'Rechazada', value: 'Rechazada' },
   { label: 'Antecedentes solicitados', value: 'Antecedentes solicitados' },
]
const itemsModalidadFiltro = [
   { label: 'Todas las modalidades', value: '__todos__' },
   ...MODALIDADES_PROPUESTA.map((m) => ({ label: m, value: m })),
]
// Opciones derivadas de las propuestas del proceso (no del catálogo de /titulaciones/grupos o
// /titulaciones/roles): así solo aparecen para filtrar los grupos/roles que efectivamente tienen
// alguna propuesta, sin depender de si el grupo o el rol siguen activos.
const itemsGrupoFiltro = computed(() => {
   const grupos = new Map<number, string>()
   for (const p of propuestasDelProceso.value) {
      if (p.estudiante.grupo) grupos.set(p.estudiante.grupo.id, p.estudiante.grupo.nombre)
   }
   return [
      { label: 'Todos los grupos', value: '__todos__' as const },
      ...[...grupos.entries()]
         .map(([value, label]) => ({ label, value }))
         .sort((a, b) => a.label.localeCompare(b.label)),
   ]
})
const itemsRolFiltro = computed(() => {
   const roles = new Map<number, string>()
   for (const p of propuestasDelProceso.value) {
      if (p.rol) roles.set(p.rol.id, p.rol.nombre)
   }
   return [
      { label: 'Todos los roles', value: '__todos__' as const },
      ...[...roles.entries()]
         .map(([value, label]) => ({ label, value }))
         .sort((a, b) => a.label.localeCompare(b.label)),
   ]
})

const propuestasFiltradas = computed(() => {
   let lista = propuestasDelProceso.value
   if (estadoFiltro.value !== '__todos__') lista = lista.filter((p) => ultimoEstado(p) === estadoFiltro.value)
   if (modalidadFiltro.value !== '__todos__') lista = lista.filter((p) => p.modalidad === modalidadFiltro.value)
   if (grupoFiltro.value !== '__todos__') lista = lista.filter((p) => p.estudiante.grupo?.id === grupoFiltro.value)
   if (rolFiltro.value !== '__todos__') lista = lista.filter((p) => p.rol?.id === rolFiltro.value)
   if (busqueda.value.trim()) {
      const q = normalizarTexto(busqueda.value)
      lista = lista.filter(
         (p) =>
            normalizarTexto(nombreCompleto(p)).includes(q) ||
            normalizarTexto(p.estudiante.run).includes(q) ||
            normalizarTexto(p.titulo).includes(q) ||
            String(p.id).includes(q)
      )
   }
   return lista
})

function limpiarFiltros() {
   busqueda.value = ''
   estadoFiltro.value = '__todos__'
   modalidadFiltro.value = '__todos__'
   grupoFiltro.value = '__todos__'
   rolFiltro.value = '__todos__'
}

const { paginaActual, itemsPagina: propuestasPagina, porPagina } = usePaginacion(propuestasFiltradas)

const columnas: TableColumn<TtPropuestaRevision>[] = [
   { id: 'aviso', header: '', size: 40 },
   { id: 'estudiante', header: 'Estudiante' },
   {
      accessorKey: 'modalidad',
      header: 'Modalidad',
      meta: { class: { th: 'hidden lg:table-cell', td: 'hidden lg:table-cell' } },
   },
   { accessorKey: 'titulo', header: 'Título propuesto' },
   { id: 'equipo', header: 'Equipo', size: 160 },
   { id: 'estado', header: 'Estado', size: 110 },
]

/* ── Detalle (slideover) ──────────────────────────────────── */
const propuestaSeleccionada = ref<TtPropuestaRevision | null>(null)
const slideoverAbierto = ref(false)
async function seleccionarPropuesta(row: { original: TtPropuestaRevision }) {
   propuestaSeleccionada.value = row.original
   slideoverAbierto.value = true
   if (!row.original.hayCambios) return
   try {
      await $fetch(`/api/titulaciones/propuestas/${row.original.id}/marcar-revisado`, { method: 'POST' })
      row.original.hayCambios = false
   } catch {
      // No crítico: si falla, el aviso de "modificada" simplemente sigue apareciendo.
   }
}
const filaSeleccionada = computed({
   get: () => (propuestaSeleccionada.value ? { [String(propuestaSeleccionada.value.id)]: true } : {}),
   set: (val: Record<string, boolean>) => {
      const id = Object.keys(val)[0]
      propuestaSeleccionada.value = id ? (propuestas.value?.find((p) => String(p.id) === id) ?? null) : null
   },
})

// Timeline muestra las mismas filas que antes iban en la lista manual, más reciente primero
// (mismo orden que ya trae `propuestaSeleccionada.estados`) — mismo patrón que
// app/pages/estudiante/propuestas/[id].vue.
const itemsHistorial = computed(() => {
   const p = propuestaSeleccionada.value
   if (!p) return []
   return p.estados.map((estado) => ({
      title: estado.estado,
      date: fechaFormateada(estado.fechaHora),
      description: estado.comentario ?? undefined,
      icon: iconoEstado(estado.estado),
      ui: { indicator: `${dotEstado(estado.estado)} text-inverted` },
   }))
})

// Un acordeón por campo de texto largo — solo entran los que la modalidad de la propuesta
// seleccionada realmente completa (ver crearTtPropuestaSchema en el server). `content` es un
// prop propio de UAccordion: sin slot con nombre, el texto se renderiza solo.
const itemsDetalle = computed(() => {
   const p = propuestaSeleccionada.value
   if (!p) return []
   const items: { label: string; content: string }[] = [{ label: 'Descripción', content: p.descripcion }]
   if (p.invMotivacion) items.push({ label: 'Motivación', content: p.invMotivacion })
   if (p.invExperiencia) items.push({ label: 'Experiencia', content: p.invExperiencia })
   if (p.claProblema) items.push({ label: 'Problema', content: p.claProblema })
   if (p.claObjetivo) items.push({ label: 'Objetivo', content: p.claObjetivo })
   return items
})

/* ── Decisión (aceptar / rechazar / pedir antecedentes) ─────
   Cada acción agrega una fila nueva a tt_estado — nunca modifica el historial existente. Aceptar
   no pide comentario; rechazar y pedir antecedentes sí (lo exige crearTtEstadoPropuestaSchema en
   el server). */
const modalAceptarMostrar = ref(false)
const modalRechazarMostrar = ref(false)
const modalAntecedentesMostrar = ref(false)
const comentarioRechazo = ref('')
const comentarioAntecedentes = ref('')
const procesandoDecision = ref(false)

async function enviarDecision(estado: string, comentario?: string) {
   if (!propuestaSeleccionada.value) return
   procesandoDecision.value = true
   try {
      await $fetch(`/api/titulaciones/propuestas/${propuestaSeleccionada.value.id}/estado`, {
         method: 'POST',
         body: { estado, comentario },
      })
      modalAceptarMostrar.value = false
      modalRechazarMostrar.value = false
      modalAntecedentesMostrar.value = false
      comentarioRechazo.value = ''
      comentarioAntecedentes.value = ''
      await refresh()
      slideoverAbierto.value = false
      propuestaSeleccionada.value = null
      toast.add({ title: 'Estado actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'No se pudo actualizar el estado'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      procesandoDecision.value = false
   }
}

/* ── Editar (jefatura) ───────────────────────────────────────
   Corrige los datos de la propuesta sin tocar su estado de revisión — a diferencia de las 3
   acciones de decisión de arriba, esta no agrega una fila a tt_estado. Reutiliza
   FormularioPropuesta en modo 'staff' (ver ese componente). */
const modalEditarMostrar = ref(false)

async function onGuardadoEdicion() {
   await refresh()
   if (propuestaSeleccionada.value) {
      propuestaSeleccionada.value = propuestas.value?.find((p) => p.id === propuestaSeleccionada.value?.id) ?? null
   }
   toast.add({ title: 'Propuesta actualizada', color: 'success', icon: 'i-lucide-check-circle' })
}

/* ── Eliminar (borrado en cascada: historial de estados y comisión) ────────
   Visible solo con permiso 'borrar' en /titulaciones/propuestas (ver requierePermiso en
   server/api/titulaciones/propuestas/[id]/index.delete.ts) — a diferencia de las 3 acciones de
   arriba, esta borra la fila completa, no agrega un nuevo estado. */
const modalEliminarMostrar = ref(false)
const eliminandoPropuesta = ref(false)

async function eliminarPropuesta() {
   if (!propuestaSeleccionada.value) return
   eliminandoPropuesta.value = true
   try {
      await $fetch(`/api/titulaciones/propuestas/${propuestaSeleccionada.value.id}`, { method: 'DELETE' })
      modalEliminarMostrar.value = false
      await refresh()
      slideoverAbierto.value = false
      propuestaSeleccionada.value = null
      toast.add({ title: 'Propuesta eliminada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'No se pudo eliminar la propuesta'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      eliminandoPropuesta.value = false
   }
}
</script>

<template>
   <div class="space-y-6">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Listado completo de temas postulados por los estudiantes, con su estado en el proceso de revisión.
         </p>
         <div class="flex shrink-0 items-center gap-2">
            <p class="text-xs text-usm-text-muted dark:text-slate-400">
               Última actualización: {{ ultimaActualizacion }}
            </p>
            <UTooltip text="Actualizar">
               <UButton
                  icon="i-lucide-refresh-cw"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  aria-label="Actualizar"
                  @click="actualizarPagina"
               />
            </UTooltip>
         </div>
      </div>

      <UFormField label="Proceso" class="max-w-xs">
         <USelectMenu v-model="procesoFiltroId" :items="itemsProcesoFiltro" value-key="value" class="w-full" />
      </UFormField>

      <TableSkeleton v-if="status === 'pending'" :rows="4" />

      <template v-else>
         <!-- Métricas -->
         <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-2xl border border-default bg-default p-5">
               <p class="text-sm font-medium text-usm-text dark:text-white">Total de postulaciones</p>
               <p class="mt-2 text-3xl font-bold text-usm-text dark:text-white">{{ metricasTotal.total }}</p>
               <div class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-usm-text-muted dark:text-slate-400">
                  <span class="flex items-center gap-1.5">
                     <span class="size-1.5 shrink-0 rounded-full bg-info" />{{ metricasTotal.pendientes }} pendientes
                  </span>
                  <span class="flex items-center gap-1.5">
                     <span class="size-1.5 shrink-0 rounded-full bg-success" />{{ metricasTotal.aceptadas }} aceptadas
                  </span>
                  <span class="flex items-center gap-1.5">
                     <span class="size-1.5 shrink-0 rounded-full bg-error" />{{ metricasTotal.rechazadas }} rechazadas
                  </span>
                  <span class="flex items-center gap-1.5">
                     <span class="size-1.5 shrink-0 rounded-full bg-warning" />{{ metricasTotal.antecedentes }} con
                     antecedentes pedidos
                  </span>
               </div>
            </div>

            <div
               v-for="m in metricasPorModalidad"
               :key="m.modalidad"
               class="rounded-2xl border border-default bg-default p-5"
            >
               <div class="flex items-center justify-between gap-2">
                  <p class="truncate text-sm font-medium text-usm-text dark:text-white">{{ m.modalidad }}</p>
                  <UBadge variant="subtle" color="neutral" class="shrink-0">{{ m.porcentaje }}%</UBadge>
               </div>
               <p class="mt-2 text-3xl font-bold text-usm-text dark:text-white">{{ m.total }}</p>
               <div class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-usm-text-muted dark:text-slate-400">
                  <span class="flex items-center gap-1.5">
                     <span class="size-1.5 shrink-0 rounded-full bg-info" />{{ m.pendientes }} pendientes
                  </span>
                  <span class="flex items-center gap-1.5">
                     <span class="size-1.5 shrink-0 rounded-full bg-success" />{{ m.aceptadas }} aceptadas
                  </span>
                  <span class="flex items-center gap-1.5">
                     <span class="size-1.5 shrink-0 rounded-full bg-error" />{{ m.rechazadas }} rechazadas
                  </span>
                  <span class="flex items-center gap-1.5">
                     <span class="size-1.5 shrink-0 rounded-full bg-warning" />{{ m.antecedentes }} con antecedentes
                     pedidos
                  </span>
               </div>
            </div>
         </div>

         <!-- Filtros -->
         <div
            class="flex flex-col gap-3 rounded-2xl border border-default bg-default p-4 sm:flex-row sm:flex-wrap sm:items-end"
         >
            <UFormField label="Buscar" class="flex-1 sm:min-w-56">
               <UInput
                  v-model="busqueda"
                  icon="i-lucide-search"
                  placeholder="Nombre, RUN, folio o título"
                  class="w-full"
               />
            </UFormField>
            <UFormField label="Estado">
               <USelect v-model="estadoFiltro" :items="itemsEstado" value-key="value" class="w-full sm:w-44" />
            </UFormField>
            <UFormField label="Modalidad">
               <USelect
                  v-model="modalidadFiltro"
                  :items="itemsModalidadFiltro"
                  value-key="value"
                  class="w-full sm:w-56"
               />
            </UFormField>
            <UFormField label="Grupo">
               <USelect v-model="grupoFiltro" :items="itemsGrupoFiltro" value-key="value" class="w-full sm:w-48" />
            </UFormField>
            <UFormField label="Rol">
               <USelect v-model="rolFiltro" :items="itemsRolFiltro" value-key="value" class="w-full sm:w-48" />
            </UFormField>
            <UButton variant="ghost" color="neutral" icon="i-lucide-x" @click="limpiarFiltros">Limpiar</UButton>
         </div>

         <!-- Tabla -->
         <div class="space-y-3">
            <div class="overflow-hidden rounded-2xl border border-default bg-default">
               <EmptyState
                  v-if="!propuestasFiltradas.length"
                  icon="i-lucide-file-search"
                  message="No hay postulaciones que coincidan con el filtro."
               />
               <UTable
                  v-else
                  v-model:row-selection="filaSeleccionada"
                  :data="propuestasPagina"
                  :columns="columnas"
                  :get-row-id="(row) => String(row.id)"
                  class="cursor-pointer"
                  @select="(_e, row) => seleccionarPropuesta(row)"
               >
                  <template #aviso-cell="{ row }">
                     <UTooltip
                        v-if="row.original.hayCambios"
                        text="La propuesta tiene cambios ingresados por el estudiante que requieren revisión."
                     >
                        <UIcon name="i-lucide-triangle-alert" class="size-4 text-warning" />
                     </UTooltip>
                  </template>
                  <template #estudiante-cell="{ row }">
                     <div class="min-w-0">
                        <p class="truncate text-usm-text dark:text-white">{{ nombreCompleto(row.original) }}</p>
                        <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                           {{ row.original.estudiante.run }}
                        </p>
                        <p class="truncate text-xs text-usm-text-muted lg:hidden dark:text-slate-400">
                           {{ row.original.modalidad }}
                        </p>
                     </div>
                  </template>
                  <template #titulo-cell="{ row }">
                     <p class="max-w-md min-w-48 whitespace-normal wrap-break-word text-usm-text dark:text-white">
                        {{ row.original.titulo }}
                     </p>
                  </template>
                  <template #equipo-cell="{ row }">
                     <div v-if="row.original.modalidad === 'Tesina Feria de Software'" class="min-w-0">
                        <p class="truncate text-usm-text dark:text-white">
                           {{ row.original.estudiante.grupo?.nombre ?? '—' }}
                        </p>
                        <p v-if="row.original.rol" class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                           {{ row.original.rol.nombre }}
                        </p>
                     </div>
                  </template>
                  <template #estado-cell="{ row }">
                     <UBadge :color="colorEstado(ultimoEstado(row.original))" variant="subtle">
                        {{ ultimoEstado(row.original) ?? 'Sin estado' }}
                     </UBadge>
                  </template>
               </UTable>
            </div>

            <div class="flex items-center justify-between text-xs text-usm-text-muted dark:text-slate-400">
               <span
                  >{{ propuestasFiltradas.length }} postulacion{{ propuestasFiltradas.length !== 1 ? 'es' : '' }}</span
               >
            </div>

            <div v-if="propuestasFiltradas.length > porPagina" class="flex justify-center">
               <UPagination
                  v-model:page="paginaActual"
                  :total="propuestasFiltradas.length"
                  :items-per-page="porPagina"
               />
            </div>
         </div>

         <!-- Detalle -->
         <USlideover
            v-model:open="slideoverAbierto"
            :title="propuestaSeleccionada?.titulo"
            :description="propuestaSeleccionada?.modalidad"
            :ui="{
               description: 'text-usm-blue dark:text-usm-cyan',
               content: 'w-[90vw] max-w-[90vw] lg:w-[40vw] lg:max-w-[40vw]',
            }"
         >
            <template #body>
               <div v-if="propuestaSeleccionada" class="space-y-4">
                  <div class="flex flex-wrap items-center gap-2">
                     <UBadge :color="colorEstado(ultimoEstado(propuestaSeleccionada))" variant="subtle">
                        {{ ultimoEstado(propuestaSeleccionada) ?? 'Sin estado' }}
                     </UBadge>
                  </div>

                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                     <div>
                        <dt class="text-xs font-medium text-usm-text-muted dark:text-slate-400">Recepción</dt>
                        <dd class="text-sm text-usm-text dark:text-slate-200">
                           {{ fechaFormateada(propuestaSeleccionada.fecha) }}
                        </dd>
                     </div>
                     <div>
                        <dt class="text-xs font-medium text-usm-text-muted dark:text-slate-400">Último cambio</dt>
                        <dd class="text-sm text-usm-text dark:text-slate-200">
                           {{
                              fechaUltimoCambio(propuestaSeleccionada)
                                 ? fechaFormateada(fechaUltimoCambio(propuestaSeleccionada)!)
                                 : '—'
                           }}
                        </dd>
                     </div>
                  </div>

                  <div>
                     <dt class="text-xs font-medium text-usm-text-muted dark:text-slate-400">Estudiante</dt>
                     <dd class="text-sm text-usm-text dark:text-slate-200">
                        <span class="font-medium text-usm-blue dark:text-usm-cyan">{{
                           nombreCompleto(propuestaSeleccionada)
                        }}</span>
                        · {{ propuestaSeleccionada.estudiante.run }}
                     </dd>
                     <dd class="text-xs text-usm-text-muted dark:text-slate-400">
                        {{ propuestaSeleccionada.estudiante.email }}
                     </dd>
                  </div>

                  <div v-if="propuestaSeleccionada.lineaInvestigacion">
                     <dt class="text-xs font-medium text-usm-text-muted dark:text-slate-400">Línea de investigación</dt>
                     <dd class="text-sm text-usm-text dark:text-slate-200">
                        {{ propuestaSeleccionada.lineaInvestigacion.nombre }}
                     </dd>
                  </div>
                  <div v-if="propuestaSeleccionada.rol">
                     <dt class="text-xs font-medium text-usm-text-muted dark:text-slate-400">Rol</dt>
                     <dd class="text-sm text-usm-text dark:text-slate-200">{{ propuestaSeleccionada.rol.nombre }}</dd>
                  </div>

                  <UAccordion
                     :items="itemsDetalle"
                     type="multiple"
                     :default-value="['0']"
                     :ui="{
                        root: 'rounded-lg border border-default divide-y divide-default',
                        trigger: 'px-3 py-2 text-sm',
                        body: 'px-3 pb-3 text-sm text-usm-text dark:text-slate-200',
                     }"
                  />

                  <div v-if="propuestaSeleccionada.estados.length > 1">
                     <dt class="mb-2 text-xs font-medium text-usm-text-muted dark:text-slate-400">
                        Historial de estados
                     </dt>
                     <UTimeline :items="itemsHistorial" orientation="vertical" />
                  </div>
               </div>
            </template>
            <template #footer>
               <div v-if="propuestaSeleccionada" class="flex w-full items-center gap-2">
                  <div class="flex shrink-0 items-center gap-2">
                     <UTooltip v-if="puedeEditar" text="Editar propuesta">
                        <UButton
                           icon="i-lucide-pen"
                           color="neutral"
                           variant="ghost"
                           aria-label="Editar propuesta"
                           @click="
                              () => {
                                 modalEditarMostrar = true
                              }
                           "
                        />
                     </UTooltip>
                     <UTooltip v-if="puedeBorrar" text="Eliminar propuesta">
                        <UButton
                           icon="i-lucide-trash-2"
                           color="error"
                           variant="ghost"
                           aria-label="Eliminar propuesta"
                           @click="
                              () => {
                                 modalEliminarMostrar = true
                              }
                           "
                        />
                     </UTooltip>
                  </div>
                  <div class="flex flex-1 flex-wrap justify-center gap-2">
                     <UButton
                        icon="i-lucide-message-circle-question"
                        color="warning"
                        variant="soft"
                        @click="
                           () => {
                              modalAntecedentesMostrar = true
                           }
                        "
                     >
                        Solicitar precisar
                     </UButton>
                     <UButton
                        icon="i-lucide-x"
                        color="error"
                        variant="soft"
                        @click="
                           () => {
                              modalRechazarMostrar = true
                           }
                        "
                     >
                        Rechazar
                     </UButton>
                     <UButton
                        icon="i-lucide-check"
                        color="success"
                        variant="soft"
                        @click="
                           () => {
                              modalAceptarMostrar = true
                           }
                        "
                     >
                        Aceptar
                     </UButton>
                  </div>
                  <!-- Espaciador simétrico al grupo de la izquierda (editar/eliminar), para que el
                       grupo central quede centrado sin importar qué permisos tenga el usuario. -->
                  <div
                     v-if="puedeEditar || puedeBorrar"
                     class="invisible flex shrink-0 items-center gap-2"
                     aria-hidden="true"
                  >
                     <UButton v-if="puedeEditar" icon="i-lucide-pen" tabindex="-1" />
                     <UButton v-if="puedeBorrar" icon="i-lucide-trash-2" tabindex="-1" />
                  </div>
               </div>
            </template>
         </USlideover>

         <!-- Confirmar aceptar -->
         <ConfirmModal
            v-model:open="modalAceptarMostrar"
            title="Aceptar propuesta"
            confirm-label="Aceptar"
            confirm-icon="i-lucide-check"
            confirm-color="success"
            :loading="procesandoDecision"
            @confirm="enviarDecision('Aceptada')"
         >
            <p class="text-sm text-usm-text dark:text-slate-200">
               ¿Aceptar la propuesta <span class="font-semibold">{{ propuestaSeleccionada?.titulo }}</span
               >?
            </p>
         </ConfirmModal>

         <!-- Confirmar rechazar -->
         <ConfirmModal
            v-model:open="modalRechazarMostrar"
            title="Rechazar propuesta"
            confirm-label="Rechazar"
            confirm-icon="i-lucide-x"
            confirm-color="error"
            :loading="procesandoDecision"
            :disabled="!comentarioRechazo.trim()"
            @confirm="enviarDecision('Rechazada', comentarioRechazo)"
         >
            <div class="space-y-3">
               <p class="text-sm text-usm-text dark:text-slate-200">
                  ¿Rechazar la propuesta <span class="font-semibold">{{ propuestaSeleccionada?.titulo }}</span
                  >?
               </p>
               <UFormField label="Motivo del rechazo" required :help="`${comentarioRechazo.length}/3000`">
                  <UTextarea
                     v-model="comentarioRechazo"
                     :rows="3"
                     maxlength="3000"
                     class="w-full"
                     placeholder="Explica por qué se rechaza…"
                  />
               </UFormField>
            </div>
         </ConfirmModal>

         <!-- Confirmar pedir antecedentes -->
         <ConfirmModal
            v-model:open="modalAntecedentesMostrar"
            title="Solicitar precisar"
            confirm-label="Enviar solicitud"
            confirm-icon="i-lucide-message-circle-question"
            confirm-color="warning"
            :loading="procesandoDecision"
            :disabled="!comentarioAntecedentes.trim()"
            @confirm="enviarDecision('Antecedentes solicitados', comentarioAntecedentes)"
         >
            <div class="space-y-3">
               <p class="text-sm text-usm-text dark:text-slate-200">
                  ¿Solicitar precisar la propuesta <span class="font-semibold">{{ propuestaSeleccionada?.titulo }}</span
                  >?
               </p>
               <UFormField
                  label="Qué antecedentes se necesitan"
                  required
                  :help="`${comentarioAntecedentes.length}/3000`"
               >
                  <UTextarea
                     v-model="comentarioAntecedentes"
                     :rows="3"
                     maxlength="3000"
                     class="w-full"
                     placeholder="Detalla qué le falta a la propuesta…"
                  />
               </UFormField>
            </div>
         </ConfirmModal>

         <!-- Editar (jefatura) -->
         <FormularioPropuesta
            v-model:open="modalEditarMostrar"
            :catalogos="catalogos"
            :propuesta="propuestaSeleccionada"
            modo="staff"
            @guardado="onGuardadoEdicion"
         />

         <!-- Confirmar eliminar -->
         <ConfirmModal
            v-model:open="modalEliminarMostrar"
            title="Eliminar propuesta"
            confirm-label="Eliminar"
            confirm-icon="i-lucide-trash-2"
            confirm-color="error"
            :loading="eliminandoPropuesta"
            @confirm="eliminarPropuesta"
         >
            <div class="space-y-2">
               <p class="text-sm text-usm-text dark:text-slate-200">
                  ¿Eliminar la propuesta <span class="font-semibold">{{ propuestaSeleccionada?.titulo }}</span
                  >?
               </p>
               <p class="text-sm text-error">
                  Se eliminará también todo su historial de estados y la comisión asignada. Esta acción no se puede
                  deshacer.
               </p>
            </div>
         </ConfirmModal>
      </template>
   </div>
</template>
