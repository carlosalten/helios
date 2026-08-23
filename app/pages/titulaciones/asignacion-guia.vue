<script setup lang="ts">
import type { TtProceso, TtProfesor, TtPropuestaRevision } from '~/types/titulaciones'

const toast = useToast()

const [{ data: propuestas, status, refresh }, { data: profesores }, { data: procesos }] = await Promise.all([
   useFetch<TtPropuestaRevision[]>('/api/titulaciones/propuestas'),
   useFetch<TtProfesor[]>('/api/titulaciones/profesores'),
   useFetch<TtProceso[]>('/api/titulaciones/procesos'),
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
// Aparecen todos los equipos que tengan al menos un integrante postulado a Feria de Software,
// sin importar el estado de esas propuestas (Pendiente/Aceptada/Rechazada/Antecedentes) — cada
// integrante muestra su propio estado (ver colorEstado). Solo se puede asignar guía una vez que
// todos los integrantes están aceptados (ver equipoListoParaAsignar): el servidor lo exige igual.
interface EquipoFeria {
   grupoId: number
   grupoNombre: string
   grupoNumero: number
   grupoSubtitulo: string | null
   integrantes: TtPropuestaRevision[]
}
const equiposFeria = computed<EquipoFeria[]>(() => {
   const porGrupo = new Map<number, EquipoFeria>()
   for (const p of propuestasDelProceso.value) {
      if (p.modalidad !== 'Tesina Feria de Software' || !p.estudiante.grupo) continue
      const grupo = p.estudiante.grupo
      const existente = porGrupo.get(grupo.id)
      if (existente) existente.integrantes.push(p)
      else
         porGrupo.set(grupo.id, {
            grupoId: grupo.id,
            grupoNombre: grupo.nombre,
            grupoNumero: grupo.numero,
            grupoSubtitulo: grupo.subtitulo,
            integrantes: [p],
         })
   }
   return [...porGrupo.values()].sort((a, b) => a.grupoNombre.localeCompare(b.grupoNombre))
})

// "Asignado" solo si TODOS los integrantes comparten el mismo guía (así es como esta página
// siempre asigna: nunca deja al equipo con guías distintos entre sí).
function guiaEquipo(equipo: EquipoFeria): string | null {
   const emails = equipo.integrantes.map((i) => guiaDe(i)?.email ?? null)
   const primero = emails[0]
   return primero && emails.every((e) => e === primero) ? primero : null
}
// El endpoint de asignación exige que todas las propuestas involucradas estén aceptadas.
function equipoListoParaAsignar(equipo: EquipoFeria): boolean {
   return equipo.integrantes.every((i) => ultimoEstado(i) === 'Aceptada')
}

/* ── Investigación: agrupada por línea ───────────────────────────────────── */
// Aparecen todas las postulaciones de Investigación, sin importar su estado — cada una muestra
// el suyo (ver colorEstado). Solo se puede asignar guía una vez aceptada (propuestaListaParaAsignar):
// el servidor lo exige igual.
const investigacionPropuestas = computed(() =>
   propuestasDelProceso.value.filter((p) => p.modalidad === 'Investigación')
)

interface GrupoLinea {
   lineaId: number
   lineaNombre: string
   propuestas: TtPropuestaRevision[]
}
const investigacionPorLinea = computed<GrupoLinea[]>(() => {
   const porLinea = new Map<number, GrupoLinea>()
   for (const p of investigacionPropuestas.value) {
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

// El endpoint de asignación exige que la propuesta esté aceptada (Investigación/Proyecto propio).
function propuestaListaParaAsignar(p: TtPropuestaRevision): boolean {
   return ultimoEstado(p) === 'Aceptada'
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
type TabAsignacion = 'feria' | 'investigacion' | 'proyecto'
const tabActivo = ref<TabAsignacion>('feria')
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
         (acc, e) => acc + e.integrantes.filter((i) => guiaDe(i)).length,
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
      const n = equiposFeria.value.filter((e) => !guiaEquipo(e)).length
      return `Faltan ${n} equipo${n === 1 ? '' : 's'}`
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
async function asignarGuia(propuestaIds: number[], profesorEmail: string | null, clave: string) {
   asignando.value = clave
   try {
      await $fetch('/api/titulaciones/asignacion-guia/asignar', {
         method: 'POST',
         body: { propuestaIds, profesorEmail },
      })
      await refresh()
      toast.add({
         title: profesorEmail ? 'Guía asignado' : 'Guía quitado',
         color: 'success',
         icon: 'i-lucide-check-circle',
      })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al asignar'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      asignando.value = null
   }
}
function onCambiarGuiaEquipo(equipo: EquipoFeria, valor: string | undefined) {
   const email = !valor || valor === SENTINEL_SIN_ASIGNAR ? null : valor
   asignarGuia(
      equipo.integrantes.map((i) => i.id),
      email,
      `equipo-${equipo.grupoId}`
   )
}
function onCambiarGuiaIndividual(p: TtPropuestaRevision, valor: string | undefined) {
   const email = !valor || valor === SENTINEL_SIN_ASIGNAR ? null : valor
   asignarGuia([p.id], email, `prop-${p.id}`)
}

/* ── Deshacer asignaciones (solo lo visible en el tab activo) ────────────── */
const confirmDeshacerMostrar = ref(false)
const deshaciendo = ref(false)
async function confirmarDeshacer() {
   const ids =
      tabActivo.value === 'feria'
         ? equiposFeria.value.flatMap((e) => e.integrantes.map((i) => i.id))
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
      await refresh()
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
            Asigna el profesor guía de cada propuesta ya aceptada. En Feria de Software se asigna a todo el equipo a la
            vez; en Investigación y Proyecto propio, propuesta por propuesta.
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
               <EmptyState
                  v-if="!equiposFeria.length"
                  icon="i-lucide-users"
                  message="No hay equipos con propuestas de Feria de Software."
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
                     <UBadge :color="guiaEquipo(equipo) ? 'success' : 'warning'" variant="subtle" class="shrink-0">
                        {{ guiaEquipo(equipo) ? 'Asignado' : 'Sin asignar' }}
                     </UBadge>
                  </div>

                  <p class="mb-2 text-xs font-medium tracking-wide text-usm-text-muted uppercase dark:text-slate-400">
                     Integrantes que postularon
                  </p>
                  <div class="mb-4 space-y-2">
                     <div
                        v-for="integrante in equipo.integrantes"
                        :key="integrante.id"
                        class="flex items-center justify-between gap-3 rounded-lg border border-default p-2.5"
                     >
                        <div class="min-w-0">
                           <p class="truncate text-sm font-medium text-usm-text dark:text-white">
                              {{ nombreCompleto(integrante) }}
                           </p>
                           <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                              {{ integrante.estudiante.run }}
                           </p>
                        </div>
                        <div class="flex shrink-0 items-center gap-2">
                           <UBadge v-if="integrante.rol" color="info" variant="subtle">
                              {{ integrante.rol.nombre }}
                           </UBadge>
                           <UBadge :color="colorEstado(ultimoEstado(integrante))" variant="subtle">
                              {{ ultimoEstado(integrante) ?? 'Sin estado' }}
                           </UBadge>
                        </div>
                     </div>
                  </div>

                  <UFormField
                     label="Profesor guía del equipo"
                     :description="
                        equipoListoParaAsignar(equipo)
                           ? undefined
                           : 'Todos los integrantes deben tener su propuesta aceptada para asignar guía.'
                     "
                  >
                     <USelect
                        :model-value="valorGuia(guiaEquipo(equipo))"
                        :items="itemsProfesoresGuia"
                        value-key="value"
                        :disabled="!puedeEditar || !equipoListoParaAsignar(equipo)"
                        :loading="asignando === `equipo-${equipo.grupoId}`"
                        class="w-full"
                        @update:model-value="(v) => onCambiarGuiaEquipo(equipo, v as string | undefined)"
                     />
                  </UFormField>
               </div>
            </div>

            <!-- Investigación -->
            <div v-else-if="tabActivo === 'investigacion'" class="space-y-6">
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
               <EmptyState
                  v-if="!proyectoPropioPropuestas.length"
                  icon="i-lucide-lightbulb"
                  message="No hay postulaciones de Proyecto propio."
               />
               <div
                  v-for="p in proyectoPropioPropuestas"
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
   </div>
</template>
