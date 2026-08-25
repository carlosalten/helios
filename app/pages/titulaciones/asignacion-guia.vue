<script setup lang="ts">
import type {
   TtGrupoConIntegrantes,
   TtGrupoIntegrante,
   TtProceso,
   TtProfesor,
   TtPropuestaRevision,
} from '~/types/titulaciones'

const toast = useToast()

const [
   { data: propuestas, status, refresh },
   { data: profesores },
   { data: procesos },
   { data: grupos, refresh: refreshGrupos },
] = await Promise.all([
   useFetch<TtPropuestaRevision[]>('/api/titulaciones/propuestas'),
   useFetch<TtProfesor[]>('/api/titulaciones/profesores'),
   useFetch<TtProceso[]>('/api/titulaciones/procesos'),
   useFetch<TtGrupoConIntegrantes[]>('/api/titulaciones/grupos'),
])

const { puedeEditar } = usePermiso('/titulaciones/asignacion-guia')

/* ── Filtro por proceso (mismo patrón que /titulaciones/grupos) ─────────── */
const procesosOrdenadosDesc = computed(() => [...(procesos.value ?? [])].sort((a, b) => b.anio - a.anio))
const itemsProcesoFiltro = computed(() =>
   procesosOrdenadosDesc.value.map((p) => ({ label: String(p.anio), value: p.id }))
)
// Por defecto, el proceso del año más grande (el primero tras ordenar descendente).
const procesoFiltroId = ref<number | undefined>(procesosOrdenadosDesc.value[0]?.id)

/* ── Helpers de propuesta (mismo criterio que /titulaciones/propuestas) ──── */
function ultimoEstado(p: TtPropuestaRevision) {
   return p.estados[0]?.estado ?? null
}
function nombreCompleto(p: TtPropuestaRevision) {
   return `${p.estudiante.nombres} ${p.estudiante.apellidoPaterno} ${p.estudiante.apellidoMaterno}`
}
function guiaDe(p: TtPropuestaRevision) {
   return p.comision[0]?.profesor ?? null
}
function colorEstado(estado: string | null) {
   if (estado === 'Pendiente') return 'info'
   if (estado === 'Rechazada') return 'error'
   if (estado === 'Aceptada') return 'success'
   if (estado === 'Antecedentes solicitados') return 'warning'
   return 'neutral'
}
// Folio solo visual (no hay un campo de folio persistido en TtPropuesta): TT-<año>-<id>.
function folioDe(p: TtPropuestaRevision) {
   const anio = new Date(p.fecha).getFullYear()
   return `TT-${anio}-${String(p.id).padStart(3, '0')}`
}

// Todo lo demás en esta página (equipos, postulaciones por línea, carga por profesor) se
// calcula a partir de esto — así el filtro de proceso alcanza también al panel de carga.
const propuestasDelProceso = computed(() =>
   (propuestas.value ?? []).filter(
      (p) => procesoFiltroId.value == null || p.estudiante.procesoId === procesoFiltroId.value
   )
)

const propuestasAceptadas = computed(() => propuestasDelProceso.value.filter((p) => ultimoEstado(p) === 'Aceptada'))

/* ── Feria de Software: agrupada por equipo (TtGrupo) ───────────────────── */
// Aparecen TODOS los equipos del proceso seleccionado, incluso si ninguno de sus integrantes
// ingresó propuesta todavía — a diferencia de Investigación/Proyecto propio (que son individuales
// y solo existen si hay una propuesta), acá el equipo (TtGrupo) es la entidad, así que se lista
// completo con su roster real. Cada integrante muestra su propio estado ("Sin propuesta" si nunca
// postuló) y, si está aceptada, su propio botón para asignar/reasignar guía (ver
// abrirAsignarGuia) — la asignación es por estudiante, no por equipo.
function nombreCompletoIntegrante(i: TtGrupoIntegrante) {
   return `${i.nombres} ${i.apellidoPaterno} ${i.apellidoMaterno}`
}

interface EquipoFeria {
   grupoId: number
   grupoNombre: string
   grupoNumero: number
   grupoSubtitulo: string | null
   integrantes: TtGrupoIntegrante[]
}

const gruposDelProceso = computed(() =>
   (grupos.value ?? []).filter((g) => procesoFiltroId.value == null || g.procesoId === procesoFiltroId.value)
)

/* ── Orden y filtro — Feria de Software ──────────────────────────────────── */
type OrdenFeria = 'numero' | 'nombre'
const ordenFeria = ref<OrdenFeria>('numero')
const itemsOrdenFeria = [
   { label: 'Número de grupo', value: 'numero' as const },
   { label: 'Nombre de grupo', value: 'nombre' as const },
]
const numeroGrupoFiltro = ref<number | '__todos__'>('__todos__')
const nombreGrupoFiltro = ref<string | '__todos__'>('__todos__')
const itemsNumeroGrupoFiltro = computed(() => [
   { label: 'Todos los números', value: '__todos__' as const },
   ...[...new Set(gruposDelProceso.value.map((g) => g.numero))]
      .sort((a, b) => a - b)
      .map((n) => ({ label: String(n), value: n })),
])
const itemsNombreGrupoFiltro = computed(() => [
   { label: 'Todos los nombres', value: '__todos__' as const },
   ...[...new Set(gruposDelProceso.value.map((g) => g.nombre))]
      .sort((a, b) => a.localeCompare(b))
      .map((n) => ({ label: n, value: n })),
])

const equiposFeria = computed<EquipoFeria[]>(() => {
   let base = gruposDelProceso.value
   if (numeroGrupoFiltro.value !== '__todos__') base = base.filter((g) => g.numero === numeroGrupoFiltro.value)
   if (nombreGrupoFiltro.value !== '__todos__') base = base.filter((g) => g.nombre === nombreGrupoFiltro.value)
   return base
      .map((g) => ({
         grupoId: g.id,
         grupoNombre: g.nombre,
         grupoNumero: g.numero,
         grupoSubtitulo: g.subtitulo,
         integrantes: g.estudiantes,
      }))
      .sort((a, b) =>
         ordenFeria.value === 'numero' ? a.grupoNumero - b.grupoNumero : a.grupoNombre.localeCompare(b.grupoNombre)
      )
})

// La asignación de guía es por estudiante (ver abrirAsignarGuia) — este resumen es solo para el
// badge del encabezado de cada equipo: cuántos de los integrantes elegibles (propuesta aceptada,
// único estado desde el que se puede asignar guía) ya tienen uno.
function resumenGuiaEquipo(equipo: EquipoFeria) {
   const elegibles = equipo.integrantes.filter((i) => i.estadoPropuesta === 'Aceptada')
   return { asignados: elegibles.filter((i) => i.guia).length, total: elegibles.length }
}

/* ── Investigación: agrupada por línea ───────────────────────────────────── */
// Aparecen todas las postulaciones de Investigación, sin importar su estado — cada una muestra
// el suyo (ver colorEstado). Solo se puede asignar guía una vez aceptada (propuestaListaParaAsignar):
// el servidor lo exige igual.
const investigacionPropuestas = computed(() =>
   propuestasDelProceso.value.filter((p) => p.modalidad === 'Investigación')
)

/* ── Orden y filtro — Investigación / Proyecto propio (comparten estos controles: son
   individuales, con la misma forma, y solo uno de los dos tabs está visible a la vez) ────── */
type OrdenIndividual = 'estudiante' | 'propuesta'
const ordenIndividual = ref<OrdenIndividual>('estudiante')
const itemsOrdenIndividual = [
   { label: 'Nombre del estudiante', value: 'estudiante' as const },
   { label: 'Nombre de la propuesta', value: 'propuesta' as const },
]
const estudianteFiltro = ref<string | '__todos__'>('__todos__')
const propuestaFiltro = ref<string | '__todos__'>('__todos__')
// La lista de la que salen las opciones de los filtros depende del tab abierto (Investigación o
// Proyecto propio), sin filtrar/ordenar todavía — así el filtro siempre ofrece lo que hay en el
// tab activo.
const listaIndividualDelTab = computed(() =>
   tabActivo.value === 'investigacion' ? investigacionPropuestas.value : proyectoPropioPropuestas.value
)
const itemsEstudianteFiltro = computed(() => {
   const porEmail = new Map<string, string>()
   for (const p of listaIndividualDelTab.value) porEmail.set(p.estudiante.email, nombreCompleto(p))
   return [
      { label: 'Todos los estudiantes', value: '__todos__' as const },
      ...[...porEmail.entries()]
         .map(([value, label]) => ({ label, value }))
         .sort((a, b) => a.label.localeCompare(b.label)),
   ]
})
const itemsPropuestaFiltro = computed(() => [
   { label: 'Todas las propuestas', value: '__todos__' as const },
   ...[...new Set(listaIndividualDelTab.value.map((p) => p.titulo))]
      .sort((a, b) => a.localeCompare(b))
      .map((t) => ({ label: t, value: t })),
])

function aplicarOrdenYFiltroIndividual(lista: TtPropuestaRevision[]) {
   let resultado = lista
   if (estudianteFiltro.value !== '__todos__') {
      resultado = resultado.filter((p) => p.estudiante.email === estudianteFiltro.value)
   }
   if (propuestaFiltro.value !== '__todos__') resultado = resultado.filter((p) => p.titulo === propuestaFiltro.value)
   return [...resultado].sort((a, b) =>
      ordenIndividual.value === 'estudiante'
         ? nombreCompleto(a).localeCompare(nombreCompleto(b))
         : a.titulo.localeCompare(b.titulo)
   )
}

interface GrupoLinea {
   lineaId: number
   lineaNombre: string
   propuestas: TtPropuestaRevision[]
}
const investigacionPorLinea = computed<GrupoLinea[]>(() => {
   const porLinea = new Map<number, GrupoLinea>()
   for (const p of aplicarOrdenYFiltroIndividual(investigacionPropuestas.value)) {
      if (!p.lineaInvestigacionId) continue
      const existente = porLinea.get(p.lineaInvestigacionId)
      if (existente) existente.propuestas.push(p)
      else
         porLinea.set(p.lineaInvestigacionId, {
            lineaId: p.lineaInvestigacionId,
            lineaNombre: p.lineaInvestigacion?.nombre ?? '—',
            propuestas: [p],
         })
   }
   return [...porLinea.values()].sort((a, b) => a.lineaNombre.localeCompare(b.lineaNombre))
})

/* ── Proyecto propio: lista plana ────────────────────────────────────────── */
// Mismo criterio que Investigación: aparecen todas, sin importar el estado.
const proyectoPropioPropuestas = computed(() =>
   propuestasDelProceso.value.filter((p) => p.modalidad === 'Proyecto Propio')
)
const proyectoPropioPropuestasVista = computed(() => aplicarOrdenYFiltroIndividual(proyectoPropioPropuestas.value))

// El endpoint de asignación exige que la propuesta esté aceptada (Investigación/Proyecto propio).
function propuestaListaParaAsignar(p: TtPropuestaRevision): boolean {
   return ultimoEstado(p) === 'Aceptada'
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
type TabAsignacion = 'feria' | 'investigacion' | 'proyecto'
const tabActivo = ref<TabAsignacion>('feria')

// Investigación y Proyecto propio comparten estos refs de filtro, pero cada uno tiene sus propias
// opciones (ver itemsEstudianteFiltro/itemsPropuestaFiltro) — al cambiar de tab, el valor
// seleccionado puede no existir en la lista nueva, así que se resetea.
watch(tabActivo, () => {
   estudianteFiltro.value = '__todos__'
   propuestaFiltro.value = '__todos__'
})

const itemsTabs = computed(() => [
   { label: 'Feria de Software', value: 'feria', badge: `${equiposFeria.value.length} equipos` },
   { label: 'Investigación', value: 'investigacion', badge: `${investigacionPropuestas.value.length} postulaciones` },
   { label: 'Proyecto propio', value: 'proyecto', badge: `${proyectoPropioPropuestas.value.length} postulaciones` },
])

const etiquetaModalidadActiva = computed(() => {
   if (tabActivo.value === 'feria') return 'equipo FESW'
   if (tabActivo.value === 'investigacion') return 'Investigación'
   return 'Proyecto Propio'
})

const resumenCarga = computed(() => {
   if (tabActivo.value === 'feria') {
      const estudiantesAsignados = equiposFeria.value.reduce(
         (acc, e) => acc + e.integrantes.filter((i) => i.guia).length,
         0
      )
      return `${estudiantesAsignados} estudiantes FESW asignados`
   }
   const lista = tabActivo.value === 'investigacion' ? investigacionPropuestas.value : proyectoPropioPropuestas.value
   const asignadas = lista.filter((p) => guiaDe(p)).length
   return `${asignadas} de ${lista.length} postulaciones asignadas`
})

const faltantes = computed(() => {
   if (tabActivo.value === 'feria') {
      const n = equiposFeria.value.reduce((acc, e) => acc + e.integrantes.filter((i) => !i.guia).length, 0)
      return `Faltan ${n} estudiante${n === 1 ? '' : 's'}`
   }
   const lista = tabActivo.value === 'investigacion' ? investigacionPropuestas.value : proyectoPropioPropuestas.value
   const n = lista.filter((p) => !guiaDe(p)).length
   return `Faltan ${n} estudiante${n === 1 ? '' : 's'}`
})

/* ── Carga por profesor ───────────────────────────────────────────────────── */
const cargaPorProfesor = computed(() => {
   const modalidadActiva =
      tabActivo.value === 'feria'
         ? 'Tesina Feria de Software'
         : tabActivo.value === 'investigacion'
           ? 'Investigación'
           : 'Proyecto Propio'
   return (profesores.value ?? [])
      .filter((p) => p.esGuia)
      .map((profesor) => {
         const asignadas = propuestasAceptadas.value.filter((p) => guiaDe(p)?.email === profesor.email)
         const deModalidadActiva = asignadas.filter((p) => p.modalidad === modalidadActiva).length
         return { profesor, total: asignadas.length, deModalidadActiva, deOtras: asignadas.length - deModalidadActiva }
      })
      .sort((a, b) =>
         `${a.profesor.apellido} ${a.profesor.nombre}`.localeCompare(`${b.profesor.apellido} ${b.profesor.nombre}`)
      )
})

/* ── Selector de guía (USelect con sentinel "Sin asignar…", ver app/CLAUDE.md) ── */
const SENTINEL_SIN_ASIGNAR = '__sin_asignar__'
const itemsProfesoresGuia = computed(() => [
   { label: 'Sin asignar…', value: SENTINEL_SIN_ASIGNAR },
   ...(profesores.value ?? [])
      .filter((p) => p.esGuia)
      .map((p) => ({ label: `${p.nombre} ${p.apellido}`, value: p.email })),
])
function valorGuia(email: string | null) {
   return email ?? SENTINEL_SIN_ASIGNAR
}

/* ── Asignar / quitar guía ────────────────────────────────────────────────── */
const asignando = ref<string | null>(null)
async function asignarGuia(propuestaIds: number[], profesorEmail: string | null, clave: string): Promise<boolean> {
   asignando.value = clave
   try {
      await $fetch('/api/titulaciones/asignacion-guia/asignar', {
         method: 'POST',
         body: { propuestaIds, profesorEmail },
      })
      await Promise.all([refresh(), refreshGrupos()])
      toast.add({
         title: profesorEmail ? 'Guía asignado' : 'Guía quitado',
         color: 'success',
         icon: 'i-lucide-check-circle',
      })
      return true
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al asignar'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
      return false
   } finally {
      asignando.value = null
   }
}
function onCambiarGuiaIndividual(p: TtPropuestaRevision, valor: string | undefined) {
   const email = !valor || valor === SENTINEL_SIN_ASIGNAR ? null : valor
   asignarGuia([p.id], email, `prop-${p.id}`)
}

/* ── Asignar guía a un integrante de Feria de Software (modal, por estudiante) ──
   A diferencia de Investigación/Proyecto propio (USelect inline por fila), acá se pidió
   explícitamente un botón + modal: cada integrante con su propuesta aceptada tiene su propio
   botón para asignar (o reasignar/quitar) su guía, independiente del resto del equipo. */
const modalAsignarGuiaMostrar = ref(false)
const integranteAsignar = ref<TtGrupoIntegrante | null>(null)
const guiaModalSeleccion = ref<string | undefined>(undefined)

function abrirAsignarGuia(integrante: TtGrupoIntegrante) {
   integranteAsignar.value = integrante
   guiaModalSeleccion.value = valorGuia(integrante.guia?.email ?? null)
   modalAsignarGuiaMostrar.value = true
}

async function confirmarAsignarGuia() {
   const integrante = integranteAsignar.value
   if (!integrante?.propuestaId) return
   const email =
      !guiaModalSeleccion.value || guiaModalSeleccion.value === SENTINEL_SIN_ASIGNAR ? null : guiaModalSeleccion.value
   const ok = await asignarGuia([integrante.propuestaId], email, `prop-${integrante.propuestaId}`)
   if (ok) modalAsignarGuiaMostrar.value = false
}

/* ── Deshacer asignaciones (solo lo visible en el tab activo) ────────────── */
const confirmDeshacerMostrar = ref(false)
const deshaciendo = ref(false)
async function confirmarDeshacer() {
   const ids =
      tabActivo.value === 'feria'
         ? equiposFeria.value.flatMap((e) =>
              e.integrantes.map((i) => i.propuestaId).filter((id): id is number => id != null)
           )
         : tabActivo.value === 'investigacion'
           ? investigacionPropuestas.value.map((p) => p.id)
           : proyectoPropioPropuestas.value.map((p) => p.id)
   if (!ids.length) {
      confirmDeshacerMostrar.value = false
      return
   }
   deshaciendo.value = true
   try {
      await $fetch('/api/titulaciones/asignacion-guia/asignar', {
         method: 'POST',
         body: { propuestaIds: ids, profesorEmail: null },
      })
      await Promise.all([refresh(), refreshGrupos()])
      confirmDeshacerMostrar.value = false
      toast.add({ title: 'Asignaciones deshechas', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al deshacer'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      deshaciendo.value = false
   }
}
</script>

<template>
   <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
         <p class="min-w-0 flex-1 text-sm text-usm-text-muted dark:text-slate-400">
            Asigna el profesor guía de cada propuesta ya aceptada, estudiante por estudiante.
         </p>
         <div class="flex shrink-0 items-center gap-2">
            <UBadge color="neutral" variant="subtle">{{ faltantes }}</UBadge>
            <UButton
               variant="ghost"
               color="neutral"
               icon="i-lucide-undo-2"
               :disabled="!puedeEditar"
               @click="
                  () => {
                     confirmDeshacerMostrar = true
                  }
               "
            >
               Deshacer asignaciones
            </UButton>
         </div>
      </div>

      <UFormField label="Proceso" class="max-w-xs">
         <USelectMenu v-model="procesoFiltroId" :items="itemsProcesoFiltro" value-key="value" class="w-full" />
      </UFormField>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
         <div class="min-w-0">
            <UTabs v-model="tabActivo" :items="itemsTabs" :content="false" class="mb-4" />

            <!-- Feria de Software -->
            <div v-if="tabActivo === 'feria'" class="space-y-4">
               <div class="flex flex-wrap gap-3 rounded-2xl border border-default bg-default p-4">
                  <UFormField label="Ordenar por" class="w-48">
                     <USelect v-model="ordenFeria" :items="itemsOrdenFeria" value-key="value" class="w-full" />
                  </UFormField>
                  <UFormField label="Filtrar por número" class="w-48">
                     <USelectMenu
                        v-model="numeroGrupoFiltro"
                        :items="itemsNumeroGrupoFiltro"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
                  <UFormField label="Filtrar por nombre" class="w-48">
                     <USelectMenu
                        v-model="nombreGrupoFiltro"
                        :items="itemsNombreGrupoFiltro"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
               </div>
               <EmptyState
                  v-if="!equiposFeria.length"
                  icon="i-lucide-users"
                  message="No hay equipos registrados en este proceso."
               />
               <div
                  v-for="equipo in equiposFeria"
                  :key="equipo.grupoId"
                  class="rounded-2xl border border-default bg-default p-4"
               >
                  <div class="mb-3 flex items-start justify-between gap-3">
                     <div class="min-w-0">
                        <p class="font-semibold whitespace-normal wrap-break-word text-usm-text dark:text-white">
                           Grupo {{ equipo.grupoNumero }} — {{ equipo.grupoNombre }}
                        </p>
                        <p v-if="equipo.grupoSubtitulo" class="text-xs text-usm-text-muted dark:text-slate-400">
                           {{ equipo.grupoSubtitulo }}
                        </p>
                        <p class="text-xs text-usm-text-muted dark:text-slate-400">
                           {{ equipo.integrantes.length }} integrantes
                        </p>
                     </div>
                     <UBadge
                        v-if="resumenGuiaEquipo(equipo).total === 0"
                        color="neutral"
                        variant="subtle"
                        class="shrink-0"
                     >
                        Sin propuestas aceptadas
                     </UBadge>
                     <UBadge
                        v-else
                        :color="
                           resumenGuiaEquipo(equipo).asignados === resumenGuiaEquipo(equipo).total
                              ? 'success'
                              : 'warning'
                        "
                        variant="subtle"
                        class="shrink-0"
                     >
                        {{ resumenGuiaEquipo(equipo).asignados }}/{{ resumenGuiaEquipo(equipo).total }} con guía
                     </UBadge>
                  </div>

                  <EmptyState
                     v-if="!equipo.integrantes.length"
                     icon="i-lucide-user-x"
                     message="Este equipo no tiene integrantes."
                  />
                  <div v-else class="space-y-2">
                     <div
                        v-for="integrante in equipo.integrantes"
                        :key="integrante.email"
                        class="space-y-2 rounded-lg border border-default p-2.5 transition-colors hover:bg-elevated/50"
                     >
                        <div class="flex flex-wrap items-center justify-between gap-3">
                           <div class="min-w-0">
                              <p class="truncate text-sm font-medium text-usm-text dark:text-white">
                                 {{ nombreCompletoIntegrante(integrante) }}
                              </p>
                              <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                                 {{ integrante.run }}
                              </p>
                           </div>
                           <div class="flex shrink-0 items-center gap-2">
                              <UBadge v-if="integrante.rolNombre" color="info" variant="subtle">
                                 {{ integrante.rolNombre }}
                              </UBadge>
                              <UBadge :color="colorEstado(integrante.estadoPropuesta)" variant="subtle">
                                 {{ integrante.estadoPropuesta ?? 'Sin propuesta' }}
                              </UBadge>
                           </div>
                        </div>
                        <div v-if="integrante.estadoPropuesta === 'Aceptada'" class="flex justify-end">
                           <UButton
                              size="xs"
                              :color="integrante.guia ? 'neutral' : 'primary'"
                              :variant="integrante.guia ? 'soft' : 'solid'"
                              :icon="integrante.guia ? 'i-lucide-pen' : 'i-lucide-user-plus'"
                              :disabled="!puedeEditar"
                              @click="abrirAsignarGuia(integrante)"
                           >
                              {{
                                 integrante.guia
                                    ? `${integrante.guia.nombre} ${integrante.guia.apellido}`
                                    : 'Asignar guía'
                              }}
                           </UButton>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <!-- Investigación -->
            <div v-else-if="tabActivo === 'investigacion'" class="space-y-6">
               <div class="flex flex-wrap gap-3 rounded-2xl border border-default bg-default p-4">
                  <UFormField label="Ordenar por" class="w-52">
                     <USelect
                        v-model="ordenIndividual"
                        :items="itemsOrdenIndividual"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
                  <UFormField label="Filtrar por estudiante" class="w-56">
                     <USelectMenu
                        v-model="estudianteFiltro"
                        :items="itemsEstudianteFiltro"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
                  <UFormField label="Filtrar por propuesta" class="w-56">
                     <USelectMenu
                        v-model="propuestaFiltro"
                        :items="itemsPropuestaFiltro"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
               </div>
               <EmptyState
                  v-if="!investigacionPorLinea.length"
                  icon="i-lucide-flask-conical"
                  message="No hay postulaciones de Investigación."
               />
               <div v-for="grupo in investigacionPorLinea" :key="grupo.lineaId" class="space-y-3">
                  <h3 class="font-semibold text-usm-text dark:text-white">{{ grupo.lineaNombre }}</h3>
                  <div
                     v-for="p in grupo.propuestas"
                     :key="p.id"
                     class="rounded-2xl border border-default bg-default p-4"
                  >
                     <div class="mb-3 flex items-start justify-between gap-3">
                        <div class="min-w-0">
                           <div class="flex flex-wrap items-center gap-2">
                              <p class="truncate font-medium text-usm-text dark:text-white">{{ nombreCompleto(p) }}</p>
                              <span class="text-xs text-usm-text-muted dark:text-slate-400">{{ folioDe(p) }}</span>
                              <UBadge :color="colorEstado(ultimoEstado(p))" variant="subtle">
                                 {{ ultimoEstado(p) ?? 'Sin estado' }}
                              </UBadge>
                           </div>
                           <p class="truncate text-sm text-usm-text-muted dark:text-slate-400">{{ p.titulo }}</p>
                           <NuxtLink
                              to="/titulaciones/propuestas"
                              class="text-xs text-usm-blue hover:underline dark:text-usm-cyan"
                           >
                              Ver detalle de la postulación
                           </NuxtLink>
                        </div>
                        <UBadge :color="guiaDe(p) ? 'success' : 'warning'" variant="subtle" class="shrink-0">
                           {{ guiaDe(p) ? 'Asignado' : 'Por asignar' }}
                        </UBadge>
                     </div>
                     <UFormField
                        label="Profesor guía"
                        :description="
                           propuestaListaParaAsignar(p)
                              ? undefined
                              : 'La propuesta debe estar aceptada para asignar guía.'
                        "
                     >
                        <USelect
                           :model-value="valorGuia(guiaDe(p)?.email ?? null)"
                           :items="itemsProfesoresGuia"
                           value-key="value"
                           :disabled="!puedeEditar || !propuestaListaParaAsignar(p)"
                           :loading="asignando === `prop-${p.id}`"
                           class="w-full"
                           @update:model-value="(v) => onCambiarGuiaIndividual(p, v as string | undefined)"
                        />
                     </UFormField>
                  </div>
               </div>
            </div>

            <!-- Proyecto propio -->
            <div v-else class="space-y-3">
               <div class="flex flex-wrap gap-3 rounded-2xl border border-default bg-default p-4">
                  <UFormField label="Ordenar por" class="w-52">
                     <USelect
                        v-model="ordenIndividual"
                        :items="itemsOrdenIndividual"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
                  <UFormField label="Filtrar por estudiante" class="w-56">
                     <USelectMenu
                        v-model="estudianteFiltro"
                        :items="itemsEstudianteFiltro"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
                  <UFormField label="Filtrar por propuesta" class="w-56">
                     <USelectMenu
                        v-model="propuestaFiltro"
                        :items="itemsPropuestaFiltro"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
               </div>
               <EmptyState
                  v-if="!proyectoPropioPropuestasVista.length"
                  icon="i-lucide-lightbulb"
                  message="No hay postulaciones de Proyecto propio."
               />
               <div
                  v-for="p in proyectoPropioPropuestasVista"
                  :key="p.id"
                  class="rounded-2xl border border-default bg-default p-4"
               >
                  <div class="mb-3 flex items-start justify-between gap-3">
                     <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                           <p class="truncate font-medium text-usm-text dark:text-white">{{ nombreCompleto(p) }}</p>
                           <span class="text-xs text-usm-text-muted dark:text-slate-400">{{ folioDe(p) }}</span>
                           <UBadge :color="colorEstado(ultimoEstado(p))" variant="subtle">
                              {{ ultimoEstado(p) ?? 'Sin estado' }}
                           </UBadge>
                        </div>
                        <p class="truncate text-sm text-usm-text-muted dark:text-slate-400">{{ p.titulo }}</p>
                        <NuxtLink
                           to="/titulaciones/propuestas"
                           class="text-xs text-usm-blue hover:underline dark:text-usm-cyan"
                        >
                           Ver detalle de la postulación
                        </NuxtLink>
                     </div>
                     <UBadge :color="guiaDe(p) ? 'success' : 'warning'" variant="subtle" class="shrink-0">
                        {{ guiaDe(p) ? 'Asignado' : 'Por asignar' }}
                     </UBadge>
                  </div>
                  <UFormField
                     label="Profesor guía"
                     :description="
                        propuestaListaParaAsignar(p) ? undefined : 'La propuesta debe estar aceptada para asignar guía.'
                     "
                  >
                     <USelect
                        :model-value="valorGuia(guiaDe(p)?.email ?? null)"
                        :items="itemsProfesoresGuia"
                        value-key="value"
                        :disabled="!puedeEditar || !propuestaListaParaAsignar(p)"
                        :loading="asignando === `prop-${p.id}`"
                        class="w-full"
                        @update:model-value="(v) => onCambiarGuiaIndividual(p, v as string | undefined)"
                     />
                  </UFormField>
               </div>
            </div>
         </div>

         <!-- Panel: carga por profesor -->
         <div class="mt-6 lg:sticky lg:top-6 lg:mt-0">
            <div class="rounded-2xl border border-default bg-default p-4">
               <h3 class="mb-1 font-semibold text-usm-text dark:text-white">Carga por profesor</h3>
               <p class="mb-3 text-xs text-usm-text-muted dark:text-slate-400">{{ resumenCarga }}</p>
               <EmptyState
                  v-if="!cargaPorProfesor.length"
                  icon="i-lucide-graduation-cap"
                  message="No hay profesores guía registrados."
               />
               <div v-else class="max-h-[70vh] space-y-4 overflow-y-auto pe-1">
                  <div v-for="c in cargaPorProfesor" :key="c.profesor.email">
                     <div class="mb-1 flex items-center justify-between gap-2">
                        <p class="truncate text-sm font-medium text-usm-text dark:text-white">
                           {{ c.profesor.nombre }} {{ c.profesor.apellido }}
                        </p>
                        <span class="shrink-0 text-sm font-semibold text-usm-text dark:text-white">
                           {{ c.total }}/{{ c.profesor.cupoMaximo }}
                        </span>
                     </div>
                     <div class="flex h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                        <div
                           class="h-full bg-usm-blue dark:bg-usm-cyan"
                           :style="{ width: `${Math.min(100, (c.deModalidadActiva / c.profesor.cupoMaximo) * 100)}%` }"
                        />
                        <div
                           class="h-full bg-usm-text-muted/40"
                           :style="{ width: `${Math.min(100, (c.deOtras / c.profesor.cupoMaximo) * 100)}%` }"
                        />
                     </div>
                     <p class="mt-1 text-xs text-usm-text-muted dark:text-slate-400">
                        {{ c.deModalidadActiva }} de {{ etiquetaModalidadActiva }} · {{ c.deOtras }} de otras
                        modalidades
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </div>

      <ConfirmModal
         v-model:open="confirmDeshacerMostrar"
         title="Deshacer asignaciones"
         confirm-label="Deshacer"
         confirm-icon="i-lucide-undo-2"
         confirm-color="error"
         :loading="deshaciendo"
         @confirm="confirmarDeshacer"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Quitar el profesor guía de todas las propuestas/equipos visibles en este tab? Esta acción no se puede
            deshacer.
         </p>
      </ConfirmModal>

      <!-- Asignar guía a un integrante de Feria de Software -->
      <UModal v-model:open="modalAsignarGuiaMostrar" title="Asignar profesor guía" :ui="{ footer: 'justify-end' }">
         <template #body>
            <div v-if="integranteAsignar" class="space-y-4">
               <p class="text-sm text-usm-text dark:text-slate-200">
                  <span class="font-medium">{{ nombreCompletoIntegrante(integranteAsignar) }}</span>
                  · {{ integranteAsignar.run }}
               </p>
               <UFormField label="Profesor guía">
                  <USelectMenu
                     v-model="guiaModalSeleccion"
                     :items="itemsProfesoresGuia"
                     value-key="value"
                     placeholder="Selecciona un profesor guía…"
                     class="w-full"
                  />
               </UFormField>
            </div>
         </template>
         <template #footer>
            <UButton
               variant="ghost"
               color="neutral"
               @click="
                  () => {
                     modalAsignarGuiaMostrar = false
                  }
               "
               >Cancelar</UButton
            >
            <UButton :loading="asignando === `prop-${integranteAsignar?.propuestaId}`" @click="confirmarAsignarGuia">
               Guardar
            </UButton>
         </template>
      </UModal>
   </div>
</template>
