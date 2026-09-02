<script setup lang="ts">
import { MODALIDADES_PROPUESTA } from '~/types/titulaciones'
import type { TtProceso, TtProfesor, TtPropuestaRevision } from '~/types/titulaciones'

const toast = useToast()

const [{ data: propuestas, status, refresh }, { data: profesores }, { data: procesos }] = await Promise.all([
   useFetch<TtPropuestaRevision[]>('/api/titulaciones/propuestas'),
   useFetch<TtProfesor[]>('/api/titulaciones/profesores'),
   useFetch<TtProceso[]>('/api/titulaciones/procesos'),
])

const { puedeEditar } = usePermiso('/titulaciones/guiados')

/* ── Filtro por proceso (mismo patrón que el resto del módulo) ─────────── */
const procesosOrdenadosDesc = computed(() => [...(procesos.value ?? [])].sort((a, b) => b.anio - a.anio))
const itemsProcesoFiltro = computed(() =>
   procesosOrdenadosDesc.value.map((p) => ({ label: String(p.anio), value: p.id }))
)
// Por defecto, el proceso del año más grande (el primero tras ordenar descendente).
const procesoFiltroId = ref<number | undefined>(procesosOrdenadosDesc.value[0]?.id)

function nombreCompleto(p: TtPropuestaRevision) {
   return `${p.estudiante.nombres} ${p.estudiante.apellidoPaterno} ${p.estudiante.apellidoMaterno}`
}
function guiaDe(p: TtPropuestaRevision) {
   return p.comision[0]?.profesor ?? null
}

const propuestasDelProceso = computed(() =>
   (propuestas.value ?? []).filter(
      (p) => procesoFiltroId.value == null || p.estudiante.procesoId === procesoFiltroId.value
   )
)

// Solo las que tienen guía asignado, sin filtrar por estado: la asignación en TtComision es la
// fuente de verdad de "a quién guía cada profesor", exista o no todavía un estado 'Aceptada'
// vigente (ver la nota sobre asignaciones huérfanas en /titulaciones/asignacion-guia).
const propuestasConGuia = computed(() => propuestasDelProceso.value.filter((p) => guiaDe(p)))

interface AlumnoGuiado {
   propuestaId: number
   nombreCompleto: string
   run: string
   email: string
   modalidad: string
   // Solo aplica a "Tesina Feria de Software" — null en el resto de modalidades.
   grupoNombre: string | null
   rolEnEquipo: string | null
}

interface ProfesorConGuiados {
   profesor: TtProfesor
   alumnos: AlumnoGuiado[]
}

// Alumnos con su profesor asignado, "aplanados" para poder filtrar antes de reagrupar por
// profesor — un elemento por propuesta con guía.
interface AlumnoConProfesor extends AlumnoGuiado {
   profesorEmail: string
}
const alumnosConProfesor = computed<AlumnoConProfesor[]>(() =>
   propuestasConGuia.value.map((p) => {
      const esFeria = p.modalidad === 'Tesina Feria de Software'
      return {
         propuestaId: p.id,
         nombreCompleto: nombreCompleto(p),
         run: p.estudiante.run,
         email: p.estudiante.email,
         modalidad: p.modalidad,
         grupoNombre: esFeria ? (p.estudiante.grupo?.nombre ?? null) : null,
         rolEnEquipo: esFeria ? (p.rol?.nombre ?? null) : null,
         profesorEmail: guiaDe(p)!.email,
      }
   })
)

// Aparecen TODOS los profesores guía del sistema, incluso sin alumnos asignados — mismo criterio
// que el tab de Feria de Software en /titulaciones/asignacion-guia (que lista todos los equipos,
// tengan o no integrantes). Sin filtrar por profesor/modalidad/grupo/rol/búsqueda: esta versión
// alimenta el panel "Cupos" (que se mantiene como resumen global, ajeno a lo que se esté
// buscando en la lista de la izquierda — mismo criterio que "Carga por profesor" en
// /titulaciones/asignacion-guia).
const profesoresConGuiados = computed<ProfesorConGuiados[]>(() => {
   const porEmail = new Map<string, AlumnoGuiado[]>()
   for (const a of alumnosConProfesor.value) {
      porEmail.set(a.profesorEmail, [...(porEmail.get(a.profesorEmail) ?? []), a])
   }
   return (profesores.value ?? [])
      .filter((p) => p.esGuia)
      .map((profesor) => ({
         profesor,
         alumnos: (porEmail.get(profesor.email) ?? []).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto)),
      }))
      .sort((a, b) =>
         `${a.profesor.apellido} ${a.profesor.nombre}`.localeCompare(`${b.profesor.apellido} ${b.profesor.nombre}`)
      )
})

/* ── Informar por correo (mailto) ─────────────────────────────────────────
   El botón de cada card arma un mailto: con el listado COMPLETO de alumnos asignados al
   profesor en el proceso seleccionado — no el filtrado por el buscador/modalidad/grupo/rol de
   la lista, que solo acota lo que se ve en pantalla (mismo criterio que el panel "Cupos"): el
   correo siempre informa la asignación real, no una vista parcial. */
const alumnosCompletosPorProfesor = computed(
   () => new Map(profesoresConGuiados.value.map((pg) => [pg.profesor.email, pg.alumnos]))
)
function alumnosCompletosDe(profesorEmail: string) {
   return alumnosCompletosPorProfesor.value.get(profesorEmail) ?? []
}

const procesoLabelActual = computed(
   () => procesosOrdenadosDesc.value.find((p) => p.id === procesoFiltroId.value)?.anio ?? ''
)

function lineaAlumnoCorreo(alumno: AlumnoGuiado, indice: number) {
   const campos = [alumno.nombreCompleto, `RUT ${alumno.run}`, alumno.email, alumno.modalidad]
   if (alumno.grupoNombre) campos.push(`Grupo: ${alumno.grupoNombre}`)
   if (alumno.rolEnEquipo) campos.push(`Rol: ${alumno.rolEnEquipo}`)
   return `${indice + 1}. ${campos.join(' · ')}`
}

function mailtoDe(profesor: TtProfesor) {
   const alumnos = alumnosCompletosDe(profesor.email)
   const asunto = `Alumnos asignados como guía IBT Informática — Proceso ${procesoLabelActual.value}`
   const cuerpo = [
      `Estimado/a ${profesor.nombre} ${profesor.apellido}:`,
      '',
      `Junto con saludar, le informo que se le ha asignado como profesor(a) guía de ${alumnos.length} ` +
         `estudiante${alumnos.length === 1 ? '' : 's'} en el proceso ${procesoLabelActual.value} de Ingeniería en Informática:`,
      '',
      'Dichos estudiantes son los siguientes:',
      '',
      ...alumnos.map((a, i) => lineaAlumnoCorreo(a, i)),
      '',
      'Saludos cordiales.',
      'Jefatura de Carrera Ingeniería en Informática',
   ].join('\n')
   return `mailto:${profesor.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
}

/* ── Filtros de la lista (profesor, modalidad, grupo, rol) y buscador ────── */
const itemsProfesorFiltro = computed(() => [
   { label: 'Todos los profesores', value: '__todos__' as const },
   ...(profesores.value ?? [])
      .filter((p) => p.esGuia)
      .map((p) => ({ label: `${p.nombre} ${p.apellido}`, value: p.email }))
      .sort((a, b) => a.label.localeCompare(b.label)),
])
const profesorFiltro = ref<string | '__todos__'>('__todos__')

type ModalidadFiltro = (typeof MODALIDADES_PROPUESTA)[number] | '__todos__'
const itemsModalidadFiltro: { label: string; value: ModalidadFiltro }[] = [
   { label: 'Todas las modalidades', value: '__todos__' },
   ...MODALIDADES_PROPUESTA.map((m) => ({ label: m, value: m })),
]
const modalidadFiltro = ref<ModalidadFiltro>('__todos__')

const itemsGrupoFiltro = computed(() => [
   { label: 'Todos los grupos', value: '__todos__' as const },
   ...[...new Set(alumnosConProfesor.value.map((a) => a.grupoNombre).filter((g): g is string => g != null))]
      .sort((a, b) => a.localeCompare(b))
      .map((g) => ({ label: g, value: g })),
])
const grupoFiltro = ref<string | '__todos__'>('__todos__')

const itemsRolFiltro = computed(() => [
   { label: 'Todos los roles', value: '__todos__' as const },
   ...[...new Set(alumnosConProfesor.value.map((a) => a.rolEnEquipo).filter((r): r is string => r != null))]
      .sort((a, b) => a.localeCompare(b))
      .map((r) => ({ label: r, value: r })),
])
const rolFiltro = ref<string | '__todos__'>('__todos__')

const busqueda = ref('')

const hayFiltrosActivos = computed(
   () =>
      modalidadFiltro.value !== '__todos__' ||
      grupoFiltro.value !== '__todos__' ||
      rolFiltro.value !== '__todos__' ||
      busqueda.value.trim() !== ''
)

// Versión de `profesoresConGuiados` para la lista de la izquierda, con todos los filtros
// aplicados. El buscador matchea contra el propio profesor (nombre/apellido/email) o contra
// cada alumno (nombre/run/email): si el profesor calza, se muestran todos sus alumnos (ya
// acotados por modalidad/grupo/rol); si no, solo los alumnos que calzan ellos mismos. Sin
// ningún filtro activo se listan todos los profesores igual que antes (incluso sin alumnos);
// con algún filtro activo, solo quedan los profesores con al menos una coincidencia — salvo que
// se haya elegido un profesor puntual en el filtro, que siempre se muestra.
const profesoresGuiadosFiltrados = computed<ProfesorConGuiados[]>(() => {
   const q = normalizarTexto(busqueda.value.trim())
   const porEmail = new Map<string, AlumnoGuiado[]>()
   for (const a of alumnosConProfesor.value) {
      if (modalidadFiltro.value !== '__todos__' && a.modalidad !== modalidadFiltro.value) continue
      if (grupoFiltro.value !== '__todos__' && a.grupoNombre !== grupoFiltro.value) continue
      if (rolFiltro.value !== '__todos__' && a.rolEnEquipo !== rolFiltro.value) continue
      porEmail.set(a.profesorEmail, [...(porEmail.get(a.profesorEmail) ?? []), a])
   }

   return (profesores.value ?? [])
      .filter((p) => p.esGuia)
      .filter((p) => profesorFiltro.value === '__todos__' || p.email === profesorFiltro.value)
      .map((profesor) => {
         const candidatos = porEmail.get(profesor.email) ?? []
         // Solo cuenta como "coincidencia por nombre de profesor" si hay texto de búsqueda: con
         // el buscador vacío no debe forzar a `coincide` a true (si no, el filtro de modalidad/
         // grupo/rol nunca ocultaría a nadie).
         const profesorCoincideBusqueda =
            q !== '' && normalizarTexto(`${profesor.nombre} ${profesor.apellido} ${profesor.email}`).includes(q)
         const alumnos = (
            q === '' || profesorCoincideBusqueda
               ? candidatos
               : candidatos.filter((a) => normalizarTexto(`${a.nombreCompleto} ${a.run} ${a.email}`).includes(q))
         ).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto))
         return { profesor, alumnos, coincide: alumnos.length > 0 || profesorCoincideBusqueda }
      })
      .filter((pg) => profesorFiltro.value !== '__todos__' || !hayFiltrosActivos.value || pg.coincide)
      .map(({ profesor, alumnos }) => ({ profesor, alumnos }))
      .sort((a, b) =>
         `${a.profesor.apellido} ${a.profesor.nombre}`.localeCompare(`${b.profesor.apellido} ${b.profesor.nombre}`)
      )
})

/* ── Panel: resumen de cupos ──────────────────────────────────────────── */
const resumenCupos = computed(() => {
   const guias = (profesores.value ?? []).filter((p) => p.esGuia)
   const cupoTotal = guias.reduce((acc, p) => acc + p.cupoMaximo, 0)
   const porModalidad = MODALIDADES_PROPUESTA.map((modalidad) => ({
      modalidad,
      cantidad: propuestasConGuia.value.filter((p) => p.modalidad === modalidad).length,
   }))
   return { cupoTotal, asignados: propuestasConGuia.value.length, porModalidad }
})

/* ── Selector de guía (USelect con sentinel "Sin asignar…", ver app/CLAUDE.md) — mismo patrón
   que /titulaciones/asignacion-guia. ────────────────────────────────────────────────────── */
const SENTINEL_SIN_ASIGNAR = '__sin_asignar__'
const itemsProfesoresGuia = computed(() => [
   { label: 'Sin asignar…', value: SENTINEL_SIN_ASIGNAR },
   ...(profesores.value ?? [])
      .filter((p) => p.esGuia)
      .map((p) => ({ label: `${p.nombre} ${p.apellido}`, value: p.email })),
])
function valorGuia(email: string) {
   return email || SENTINEL_SIN_ASIGNAR
}

/* ── Cambiar guía de un alumno (modal) ───────────────────────────────────── */
const asignando = ref<string | null>(null)
const modalCambiarGuiaMostrar = ref(false)
const alumnoCambiarGuia = ref<AlumnoGuiado | null>(null)
const guiaModalSeleccion = ref<string | undefined>(undefined)

function abrirCambiarGuia(profesorActualEmail: string, alumno: AlumnoGuiado) {
   alumnoCambiarGuia.value = alumno
   guiaModalSeleccion.value = valorGuia(profesorActualEmail)
   modalCambiarGuiaMostrar.value = true
}

async function confirmarCambiarGuia() {
   const alumno = alumnoCambiarGuia.value
   if (!alumno) return
   const email =
      !guiaModalSeleccion.value || guiaModalSeleccion.value === SENTINEL_SIN_ASIGNAR ? null : guiaModalSeleccion.value
   const clave = `prop-${alumno.propuestaId}`
   asignando.value = clave
   try {
      await $fetch('/api/titulaciones/asignacion-guia/asignar', {
         method: 'POST',
         body: { propuestaIds: [alumno.propuestaId], profesorEmail: email },
      })
      await refresh()
      modalCambiarGuiaMostrar.value = false
      toast.add({
         title: email ? 'Guía actualizado' : 'Guía quitado',
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
</script>

<template>
   <div class="space-y-6">
      <p class="text-sm text-usm-text-muted dark:text-slate-400">
         Alumnos con profesor guía ya asignado, agrupados por profesor.
      </p>

      <UFormField label="Proceso" class="max-w-xs">
         <USelectMenu v-model="procesoFiltroId" :items="itemsProcesoFiltro" value-key="value" class="w-full" />
      </UFormField>

      <div class="flex flex-wrap gap-3 rounded-2xl border border-default bg-default p-4">
         <UFormField label="Buscar estudiante o profesor" class="w-64">
            <UInput v-model="busqueda" icon="i-lucide-search" placeholder="Nombre, RUT o email…" class="w-full" />
         </UFormField>
         <UFormField label="Profesor" class="w-52">
            <USelectMenu v-model="profesorFiltro" :items="itemsProfesorFiltro" value-key="value" class="w-full" />
         </UFormField>
         <UFormField label="Modalidad" class="w-52">
            <USelect v-model="modalidadFiltro" :items="itemsModalidadFiltro" value-key="value" class="w-full" />
         </UFormField>
         <UFormField label="Grupo" class="w-48">
            <USelectMenu v-model="grupoFiltro" :items="itemsGrupoFiltro" value-key="value" class="w-full" />
         </UFormField>
         <UFormField label="Rol" class="w-48">
            <USelectMenu v-model="rolFiltro" :items="itemsRolFiltro" value-key="value" class="w-full" />
         </UFormField>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
         <div class="min-w-0 space-y-4">
            <EmptyState
               v-if="!profesoresGuiadosFiltrados.length"
               icon="i-lucide-graduation-cap"
               :message="
                  hayFiltrosActivos || profesorFiltro !== '__todos__'
                     ? 'Ningún profesor coincide con los filtros aplicados.'
                     : 'No hay profesores guía registrados.'
               "
            />
            <div
               v-for="pg in profesoresGuiadosFiltrados"
               :key="pg.profesor.email"
               class="rounded-2xl border border-default bg-default p-4"
            >
               <div class="mb-3 flex items-start justify-between gap-3">
                  <div class="min-w-0">
                     <p class="truncate font-semibold text-usm-text dark:text-white">
                        {{ pg.profesor.nombre }} {{ pg.profesor.apellido }}
                     </p>
                     <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">{{ pg.profesor.email }}</p>
                  </div>
                  <div class="flex shrink-0 flex-col items-end gap-1.5">
                     <UBadge :color="pg.alumnos.length > pg.profesor.cupoMaximo ? 'error' : 'neutral'" variant="subtle">
                        {{ pg.alumnos.length }}/{{ pg.profesor.cupoMaximo }} alumnos
                     </UBadge>
                     <UTooltip text="Le envía un correo con la lista de sus alumnos asignados">
                        <UButton
                           size="xs"
                           color="neutral"
                           variant="soft"
                           icon="i-lucide-mail"
                           :disabled="!alumnosCompletosDe(pg.profesor.email).length"
                           :to="mailtoDe(pg.profesor)"
                        >
                           Informar por correo
                        </UButton>
                     </UTooltip>
                  </div>
               </div>

               <EmptyState
                  v-if="!pg.alumnos.length"
                  icon="i-lucide-user-x"
                  :message="
                     hayFiltrosActivos
                        ? 'Ningún alumno de este profesor coincide con los filtros aplicados.'
                        : 'Este profesor no tiene alumnos asignados.'
                  "
               />
               <div v-else class="space-y-2">
                  <div
                     v-for="alumno in pg.alumnos"
                     :key="alumno.propuestaId"
                     class="rounded-lg border border-default p-2.5 transition-colors hover:bg-elevated/50"
                  >
                     <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                           <p class="truncate text-sm font-medium text-usm-text dark:text-white">
                              {{ alumno.nombreCompleto }}
                           </p>
                           <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                              {{ alumno.run }} · {{ alumno.email }}
                           </p>
                        </div>
                        <div class="flex shrink-0 flex-col items-end gap-1.5">
                           <UBadge color="info" variant="subtle">{{ alumno.modalidad }}</UBadge>
                           <UButton
                              size="xs"
                              color="neutral"
                              variant="soft"
                              icon="i-lucide-pen"
                              :disabled="!puedeEditar"
                              @click="abrirCambiarGuia(pg.profesor.email, alumno)"
                           >
                              Cambiar guía
                           </UButton>
                        </div>
                     </div>
                     <p v-if="alumno.grupoNombre" class="mt-1 text-xs text-usm-text-muted dark:text-slate-400">
                        Grupo: {{ alumno.grupoNombre
                        }}<template v-if="alumno.rolEnEquipo"> · {{ alumno.rolEnEquipo }}</template>
                     </p>
                  </div>
               </div>
            </div>
         </div>

         <!-- Panel: resumen de cupos -->
         <div class="mt-6 lg:sticky lg:top-6 lg:mt-0">
            <div class="rounded-2xl border border-default bg-default p-4">
               <h3 class="mb-3 font-semibold text-usm-text dark:text-white">Cupos</h3>
               <div class="mb-4">
                  <div class="mb-1 flex items-center justify-between gap-2">
                     <span class="text-sm text-usm-text-muted dark:text-slate-400">Alumnos asignados</span>
                     <span class="text-sm font-semibold text-usm-text dark:text-white">
                        {{ resumenCupos.asignados }}/{{ resumenCupos.cupoTotal }}
                     </span>
                  </div>
                  <div class="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                     <div
                        class="h-full bg-usm-blue dark:bg-usm-cyan"
                        :style="{
                           width: `${resumenCupos.cupoTotal ? Math.min(100, (resumenCupos.asignados / resumenCupos.cupoTotal) * 100) : 0}%`,
                        }"
                     />
                  </div>
               </div>
               <h4 class="mb-2 text-xs font-semibold tracking-wide text-usm-text-muted uppercase dark:text-slate-400">
                  Por modalidad
               </h4>
               <div class="mb-4 space-y-2">
                  <div
                     v-for="m in resumenCupos.porModalidad"
                     :key="m.modalidad"
                     class="flex items-center justify-between gap-2 text-sm"
                  >
                     <span class="text-usm-text dark:text-slate-200">{{ m.modalidad }}</span>
                     <span class="font-semibold text-usm-text dark:text-white">{{ m.cantidad }}</span>
                  </div>
               </div>

               <h4 class="mb-2 text-xs font-semibold tracking-wide text-usm-text-muted uppercase dark:text-slate-400">
                  Por profesor
               </h4>
               <div class="max-h-[50vh] space-y-3 overflow-y-auto pe-1">
                  <div v-for="pg in profesoresConGuiados" :key="pg.profesor.email">
                     <div class="mb-1 flex items-center justify-between gap-2">
                        <p class="truncate text-sm text-usm-text dark:text-slate-200">
                           {{ pg.profesor.nombre }} {{ pg.profesor.apellido }}
                        </p>
                        <span class="shrink-0 text-sm font-semibold text-usm-text dark:text-white">
                           {{ pg.alumnos.length }}/{{ pg.profesor.cupoMaximo }}
                        </span>
                     </div>
                     <div class="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                        <div
                           class="h-full bg-usm-blue dark:bg-usm-cyan"
                           :style="{
                              width: `${Math.min(100, (pg.alumnos.length / pg.profesor.cupoMaximo) * 100)}%`,
                           }"
                        />
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>

      <!-- Cambiar guía de un alumno -->
      <UModal v-model:open="modalCambiarGuiaMostrar" title="Cambiar profesor guía" :ui="{ footer: 'justify-end' }">
         <template #body>
            <div v-if="alumnoCambiarGuia" class="space-y-4">
               <p class="text-sm text-usm-text dark:text-slate-200">
                  <span class="font-medium">{{ alumnoCambiarGuia.nombreCompleto }}</span>
                  · {{ alumnoCambiarGuia.run }}
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
                     modalCambiarGuiaMostrar = false
                  }
               "
               >Cancelar</UButton
            >
            <UButton :loading="asignando === `prop-${alumnoCambiarGuia?.propuestaId}`" @click="confirmarCambiarGuia">
               Guardar
            </UButton>
         </template>
      </UModal>
   </div>
</template>
