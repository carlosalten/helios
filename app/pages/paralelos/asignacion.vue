<script setup lang="ts">
import type { Plan, AsignaturaConAsignacion } from '~/types/plan'
import type { Curso } from '~/types/curso'
import type { Paralelo } from '~/types/paralelo'
import type { Semestre } from '~/types/semestre'

const toast = useToast()

const {
   puedeCrear: puedeCrearParaleloBase,
   puedeEditar: puedeEditarParaleloBase,
   puedeBorrar: puedeBorrarParaleloBase,
} = usePermiso('/paralelos')
const { tieneAlcanceSobreCarrera } = useAlcanceCarrera()

const [
   { data: planes, status: statusPlanes },
   { data: cursosTodos },
   { data: paralelosTodos, refresh: refrescarParalelos },
   { data: semestres },
] = await Promise.all([
   useFetch<Plan[]>('/api/planes'),
   useFetch<Curso[]>('/api/cursos'),
   useFetch<Paralelo[]>('/api/paralelos'),
   useFetch<Semestre[]>('/api/semestres'),
])

/* ── Plan seleccionado ───────────────────────────────────── */
const planSeleccionadoId = ref<number | undefined>(undefined)
const planSeleccionado = computed(() => (planes.value ?? []).find((p) => p.id === planSeleccionadoId.value) ?? null)

// Se puede VER la malla y los cursos de cualquier plan (/api/planes y
// /api/planes/[id]/asignaturas ya no se acotan por carrera), pero las mutaciones
// (crear/editar/borrar paralelo) siguen acotadas a la(s) carrera(s) que el usuario dirige —
// mismo criterio que usan los propios endpoints de mutación (resolverCarrerasJefe). Como toda
// la página gira en torno a UN plan a la vez, basta un solo chequeo por acción.
const puedeModificarPlanActual = computed(
   () => !!planSeleccionado.value && tieneAlcanceSobreCarrera(planSeleccionado.value.carreraCodigo)
)
const puedeCrearParalelo = computed(() => puedeCrearParaleloBase.value && puedeModificarPlanActual.value)
const puedeEditarParalelo = computed(() => puedeEditarParaleloBase.value && puedeModificarPlanActual.value)
const puedeBorrarParalelo = computed(() => puedeBorrarParaleloBase.value && puedeModificarPlanActual.value)

function labelPlan(plan: Plan) {
   return `${plan.carrera.nombre} — Plan N° ${plan.numero}${plan.vigente ? ' · Vigente' : ''}`
}
const opcionesPlan = computed(() => (planes.value ?? []).map((p) => ({ label: labelPlan(p), value: p.id })))

/* ── Semestre seleccionado: acota qué cursos del plan se muestran ────────── */
const semestreSeleccionadoId = ref<number | undefined>(undefined)
watchEffect(() => {
   if (semestreSeleccionadoId.value == null && semestres.value?.length) {
      semestreSeleccionadoId.value = semestres.value.find((s) => s.vigente)?.id ?? semestres.value[0]!.id
   }
})
const opcionesSemestre = computed(() => (semestres.value ?? []).map((s) => ({ label: s.nombre, value: s.id })))

/* ── Malla: asignaturas del plan agrupadas por semestre ─────────────────── */
const asignaturas = ref<AsignaturaConAsignacion[]>([])
const cargandoAsignaturas = ref(false)

async function cargarAsignaturas() {
   if (!planSeleccionado.value) return
   const url: string = `/api/planes/${planSeleccionado.value.id}/asignaturas`
   asignaturas.value = await $fetch<AsignaturaConAsignacion[]>(url)
}

watch(planSeleccionadoId, async () => {
   asignaturas.value = []
   if (!planSeleccionado.value) return
   cargandoAsignaturas.value = true
   try {
      await cargarAsignaturas()
   } finally {
      cargandoAsignaturas.value = false
   }
})

const asignaturasAsignadas = computed(() => asignaturas.value.filter((a) => a.asignado))

// Las electivas no viven en la columna de su `semestre` (ese valor es solo un relleno sin
// significado — ver AsignaturaPlan.esElectiva): van en su propia columna al final de la malla,
// igual que en /planes/asignacion.
const columnas = computed(() => {
   if (!planSeleccionado.value) return []
   const maxAsignado = asignaturasAsignadas.value.reduce(
      (max, a) => (!a.esElectiva ? Math.max(max, a.semestre) : max),
      0
   )
   const total = Math.max(planSeleccionado.value.cantidadSemestres, maxAsignado)
   return Array.from({ length: total }, (_, i) => i + 1)
})

const electivas = computed(() => asignaturasAsignadas.value.filter((a) => a.esElectiva))

// Columna de Electivos, cuando el plan la tiene habilitada, al final de la misma grilla.
const totalColumnasMalla = computed(() => columnas.value.length + (planSeleccionado.value?.tieneElectivos ? 1 : 0))

function asignaturasDeSemestre(semestre: number) {
   return asignaturasAsignadas.value.filter((a) => !a.esElectiva && a.semestre === semestre)
}

// Cuántos paralelos ya existen para esta asignatura dentro del plan seleccionado.
function paralelosDeAsignatura(asignatura: AsignaturaConAsignacion) {
   if (asignatura.asignaturaPlanId === null) return 0
   return (paralelosTodos.value ?? []).filter((p) => p.asignaturaPlanId === asignatura.asignaturaPlanId).length
}

/* ── Cursos del plan y sus paralelos ─────────────────────────────────────── */
const cursosDelPlan = computed(() => {
   if (!planSeleccionado.value) return []
   const id = planSeleccionado.value.id
   return (cursosTodos.value ?? []).filter(
      (c) => c.planId === id && (semestreSeleccionadoId.value == null || c.semestreId === semestreSeleccionadoId.value)
   )
})

// Orden manual (solo visual, no se persiste) de los paneles de curso: conserva la
// posición que el usuario les dio y agrega al final los cursos nuevos que entren al
// filtro actual, descartando los que ya no correspondan.
const ordenCursosIds = ref<number[]>([])
watch(
   cursosDelPlan,
   (lista) => {
      const idsActuales = new Set(lista.map((c) => c.id))
      const conservados = ordenCursosIds.value.filter((id) => idsActuales.has(id))
      const nuevos = lista.map((c) => c.id).filter((id) => !conservados.includes(id))
      ordenCursosIds.value = [...conservados, ...nuevos]
   },
   { immediate: true }
)

const cursosOrdenados = computed(() => {
   const porId = new Map(cursosDelPlan.value.map((c) => [c.id, c]))
   return ordenCursosIds.value.map((id) => porId.get(id)).filter((c): c is Curso => c !== undefined)
})

// Filtro por nombre: solo acota qué paneles se muestran, no toca el orden guardado.
const busquedaCurso = ref('')
const cursosVisibles = computed(() => {
   if (!busquedaCurso.value.trim()) return cursosOrdenados.value
   const q = normalizarTexto(busquedaCurso.value)
   return cursosOrdenados.value.filter((c) => normalizarTexto(c.nombre).includes(q))
})

/* ── Drag and drop: reordenar los paneles de curso arrastrándolos ────────── */
const arrastrandoCursoId = ref<number | null>(null)
const sobreCursoId = ref<number | null>(null)

function iniciarArrastreCurso(e: DragEvent, curso: Curso) {
   arrastrandoCursoId.value = curso.id
   e.dataTransfer?.setData('text/plain', String(curso.id))
   if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function terminarArrastreCurso() {
   arrastrandoCursoId.value = null
   sobreCursoId.value = null
}

function permiteDropCurso() {
   return arrastrandoCursoId.value !== null
}

function onDragOverPanelCurso(curso: Curso) {
   if (!permiteDropCurso()) return
   if (curso.id !== arrastrandoCursoId.value) sobreCursoId.value = curso.id
}

function onDropPanelCurso(curso: Curso) {
   const origenId = arrastrandoCursoId.value
   arrastrandoCursoId.value = null
   sobreCursoId.value = null
   if (origenId === null || origenId === curso.id) return

   const copia = [...ordenCursosIds.value]
   const actual = copia.indexOf(origenId)
   const destino = copia.indexOf(curso.id)
   if (actual === -1 || destino === -1) return
   copia.splice(actual, 1)
   copia.splice(copia.indexOf(curso.id), 0, origenId)
   ordenCursosIds.value = copia
}

function paralelosDeCurso(cursoId: number) {
   return (paralelosTodos.value ?? []).filter((p) => p.cursoId === cursoId)
}

// El paralelo quedó en un curso cuyo semestre curricular no coincide con el semestre-en-
// plan de su asignatura (se pudo crear igual desde el modal de advertencia). Una asignatura
// electiva se puede dictar en un curso de cualquier semestre, así que nunca cuenta como
// "fuera de semestre".
function esFueraDeSemestre(paralelo: Paralelo, curso: Curso) {
   return !paralelo.asignaturaPlan.esElectiva && paralelo.asignaturaPlan.semestre !== curso.numeroSemestre
}

/* ── Drag and drop: arrastra una asignatura de la malla a un panel de curso
   para crear un paralelo. El código del paralelo es el número del curso. ── */
const arrastrando = ref<AsignaturaConAsignacion | null>(null)
const creando = ref<number | null>(null)

function puedeArrastrar(asignatura: AsignaturaConAsignacion) {
   return puedeCrearParalelo.value && asignatura.asignaturaPlanId !== null
}

function iniciarArrastre(e: DragEvent, asignatura: AsignaturaConAsignacion) {
   if (!puedeArrastrar(asignatura)) return
   arrastrando.value = asignatura
   e.dataTransfer?.setData('text/plain', String(asignatura.id))
   if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}

function terminarArrastre() {
   arrastrando.value = null
}

function permiteDrop() {
   return arrastrando.value !== null && creando.value === null
}

async function crearParalelo(asignatura: AsignaturaConAsignacion, curso: Curso) {
   if (!asignatura.asignaturaPlanId) return

   if (
      existeParaleloDuplicado(paralelosTodos.value ?? [], {
         cursoId: curso.id,
         asignaturaCodigo: asignatura.codigo,
         codigo: String(curso.numero),
      })
   ) {
      toast.add({
         title: 'Ya existe un paralelo de esta asignatura en este curso',
         color: 'error',
         icon: 'i-lucide-alert-circle',
      })
      return
   }

   creando.value = asignatura.asignaturaPlanId
   try {
      await $fetch('/api/paralelos', {
         method: 'POST',
         body: {
            codigo: String(curso.numero),
            cupo: 0,
            asignaturaPlanId: asignatura.asignaturaPlanId,
            cursoId: curso.id,
         },
      })
      await refrescarParalelos()
   } catch (err: unknown) {
      const mensaje = (err as { data?: { message?: string } }).data?.message ?? 'Error al crear el paralelo'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      creando.value = null
   }
}

// Si el semestre-en-plan de la asignatura no coincide con el numeroSemestre del curso,
// se advierte antes de crear (el usuario puede confirmar igual: no es un bloqueo duro).
const modalAdvertenciaMostrar = ref(false)
const pendiente = ref<{ asignatura: AsignaturaConAsignacion; curso: Curso } | null>(null)

async function onDrop(e: DragEvent, curso: Curso) {
   if (!permiteDrop()) return
   e.preventDefault()
   const asignatura = arrastrando.value
   arrastrando.value = null
   if (!asignatura?.asignaturaPlanId) return

   if (!asignatura.esElectiva && asignatura.semestre !== curso.numeroSemestre) {
      pendiente.value = { asignatura, curso }
      modalAdvertenciaMostrar.value = true
      return
   }

   await crearParalelo(asignatura, curso)
}

async function confirmarCreacionConAdvertencia() {
   if (!pendiente.value) return
   const { asignatura, curso } = pendiente.value
   modalAdvertenciaMostrar.value = false
   await crearParalelo(asignatura, curso)
}

/* ── Borrar paralelo: botón en la ficha o arrastrarlo de vuelta a la malla ── */
const eliminando = ref<number | null>(null)

async function borrarParalelo(paralelo: Paralelo) {
   if (eliminando.value !== null) return
   eliminando.value = paralelo.id
   try {
      await $fetch(`/api/paralelos/${paralelo.id}`, { method: 'DELETE' })
      await refrescarParalelos()
      toast.add({ title: 'Paralelo eliminado', color: 'success', icon: 'i-lucide-trash-2' })
   } catch (err: unknown) {
      const mensaje = (err as { data?: { message?: string } }).data?.message ?? 'Error al eliminar el paralelo'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      eliminando.value = null
   }
}

const arrastrandoParalelo = ref<Paralelo | null>(null)
const sobreParaleloId = ref<number | null>(null)

function iniciarArrastreParalelo(e: DragEvent, paralelo: Paralelo) {
   if (!puedeBorrarParalelo.value) return
   arrastrandoParalelo.value = paralelo
   e.dataTransfer?.setData('text/plain', String(paralelo.id))
   if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function terminarArrastreParalelo() {
   arrastrandoParalelo.value = null
   sobreParaleloId.value = null
}

function permiteDropParalelo() {
   return arrastrandoParalelo.value !== null && eliminando.value === null
}

function onDragOverMalla(e: DragEvent) {
   if (!permiteDropParalelo()) return
   e.preventDefault()
   sobreParaleloId.value = null
}

async function onDropMalla(e: DragEvent) {
   if (!permiteDropParalelo()) return
   e.preventDefault()
   const paralelo = arrastrandoParalelo.value
   arrastrandoParalelo.value = null
   sobreParaleloId.value = null
   if (!paralelo) return
   await borrarParalelo(paralelo)
}

// Reordena los paralelos de un curso: quita el movido de donde esté, lo reinserta antes
// de `antesDeId` (o al final si no se especifica) y persiste la columna completa.
async function reordenarParalelosDeCurso(cursoId: number, paraleloIdMovido: number, antesDeId?: number) {
   const lista = paralelosDeCurso(cursoId)
   const actual = lista.findIndex((p) => p.id === paraleloIdMovido)
   if (actual === -1) return
   const [item] = lista.splice(actual, 1)
   if (!item) return
   const destino = antesDeId !== undefined ? lista.findIndex((p) => p.id === antesDeId) : -1
   if (destino === -1) lista.push(item)
   else lista.splice(destino, 0, item)

   const ordenIds = lista.map((p) => p.id)
   if (ordenIds.length < 2) return

   try {
      await $fetch('/api/paralelos/reordenar', { method: 'POST', body: { cursoId, ordenIds } })
      await refrescarParalelos()
   } catch (err: unknown) {
      const mensaje = (err as { data?: { message?: string } }).data?.message ?? 'Error al reordenar'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   }
}

function onDragOverParaleloItem(e: DragEvent, curso: Curso, paralelo: Paralelo) {
   if (!permiteDropParalelo()) return
   e.preventDefault()
   e.stopPropagation()
   if (arrastrandoParalelo.value?.cursoId === curso.id && arrastrandoParalelo.value.id !== paralelo.id) {
      sobreParaleloId.value = paralelo.id
   }
}

// Cambia el paralelo de curso (se soltó en un curso distinto al que ya tenía): conserva
// código/cupo/asignatura y queda al final de la columna destino.
const moviendoParaleloId = ref<number | null>(null)

async function moverParaleloACurso(paralelo: Paralelo, curso: Curso) {
   if (moviendoParaleloId.value !== null) return

   if (
      existeParaleloDuplicado(paralelosTodos.value ?? [], {
         cursoId: curso.id,
         asignaturaCodigo: paralelo.asignaturaPlan.asignatura.codigo,
         codigo: paralelo.codigo,
         excluirId: paralelo.id,
      })
   ) {
      toast.add({
         title: 'Ya existe un paralelo de esta asignatura en el curso destino',
         color: 'error',
         icon: 'i-lucide-alert-circle',
      })
      return
   }

   moviendoParaleloId.value = paralelo.id
   try {
      await $fetch(`/api/paralelos/${paralelo.id}`, {
         method: 'PATCH',
         body: {
            codigo: paralelo.codigo,
            cupo: paralelo.cupo,
            asignaturaPlanId: paralelo.asignaturaPlanId,
            cursoId: curso.id,
         },
      })
      await refrescarParalelos()
      toast.add({ title: 'Paralelo movido', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (err: unknown) {
      const mensaje = (err as { data?: { message?: string } }).data?.message ?? 'Error al mover el paralelo'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      moviendoParaleloId.value = null
   }
}

async function onDropParaleloItem(e: DragEvent, curso: Curso, targetParalelo: Paralelo) {
   if (!permiteDropParalelo()) return
   e.preventDefault()
   e.stopPropagation()
   const paralelo = arrastrandoParalelo.value
   arrastrandoParalelo.value = null
   sobreParaleloId.value = null
   if (!paralelo || paralelo.id === targetParalelo.id) return
   if (paralelo.cursoId === curso.id) {
      await reordenarParalelosDeCurso(curso.id, paralelo.id, targetParalelo.id)
   } else {
      await moverParaleloACurso(paralelo, curso)
   }
}

// El panel de curso acepta tres tipos de arrastre: una asignatura de la malla (crea un
// paralelo), un paralelo (del propio curso, lo manda al final si se soltó en el fondo fuera
// de una ficha específica; o de otro curso, lo mueve ahí), o el panel de otro curso (los
// reordena entre sí).
function onDragOverCurso(e: DragEvent, curso: Curso) {
   if (permiteDrop()) {
      e.preventDefault()
      return
   }
   if (permiteDropParalelo()) {
      e.preventDefault()
      if (arrastrandoParalelo.value?.cursoId === curso.id) sobreParaleloId.value = null
      return
   }
   if (permiteDropCurso()) {
      e.preventDefault()
      onDragOverPanelCurso(curso)
   }
}

async function onDropCurso(e: DragEvent, curso: Curso) {
   if (permiteDrop()) {
      await onDrop(e, curso)
      return
   }
   if (permiteDropParalelo()) {
      e.preventDefault()
      const paralelo = arrastrandoParalelo.value
      arrastrandoParalelo.value = null
      sobreParaleloId.value = null
      if (!paralelo) return
      if (paralelo.cursoId === curso.id) await reordenarParalelosDeCurso(curso.id, paralelo.id)
      else await moverParaleloACurso(paralelo, curso)
      return
   }
   if (permiteDropCurso()) {
      e.preventDefault()
      onDropPanelCurso(curso)
   }
}

/* ── Editar el código haciendo click sobre él ─────────────────────────────── */
const editandoCodigoId = ref<number | null>(null)
const codigoEditado = ref('')
const guardandoCodigo = ref<number | null>(null)

function abrirEditarCodigo(paralelo: Paralelo) {
   if (!puedeEditarParalelo.value) return
   editandoCodigoId.value = paralelo.id
   codigoEditado.value = paralelo.codigo
}

function cancelarEditarCodigo() {
   editandoCodigoId.value = null
}

async function guardarCodigo(paralelo: Paralelo) {
   if (editandoCodigoId.value !== paralelo.id) return
   editandoCodigoId.value = null
   const nuevo = codigoEditado.value.trim()
   if (!nuevo || nuevo === paralelo.codigo) return

   if (
      existeParaleloDuplicado(paralelosTodos.value ?? [], {
         cursoId: paralelo.cursoId,
         asignaturaCodigo: paralelo.asignaturaPlan.asignatura.codigo,
         codigo: nuevo,
         excluirId: paralelo.id,
      })
   ) {
      toast.add({
         title: 'Ya existe un paralelo con este código para esta asignatura en este curso',
         color: 'error',
         icon: 'i-lucide-alert-circle',
      })
      return
   }

   guardandoCodigo.value = paralelo.id
   try {
      await $fetch(`/api/paralelos/${paralelo.id}`, {
         method: 'PATCH',
         body: {
            codigo: nuevo,
            cupo: paralelo.cupo,
            asignaturaPlanId: paralelo.asignaturaPlanId,
            cursoId: paralelo.cursoId,
         },
      })
      await refrescarParalelos()
      toast.add({ title: 'Código actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (err: unknown) {
      const mensaje = (err as { data?: { message?: string } }).data?.message ?? 'Error al actualizar el código'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      guardandoCodigo.value = null
   }
}

/* ── Editar el cupo haciendo click sobre él ───────────────────────────────── */
const editandoCupoId = ref<number | null>(null)
const cupoEditado = ref('0')
const guardandoCupo = ref<number | null>(null)

function abrirEditarCupo(paralelo: Paralelo) {
   if (!puedeEditarParalelo.value) return
   editandoCupoId.value = paralelo.id
   cupoEditado.value = String(paralelo.cupo)
}

function cancelarEditarCupo() {
   editandoCupoId.value = null
}

async function guardarCupo(paralelo: Paralelo) {
   if (editandoCupoId.value !== paralelo.id) return
   editandoCupoId.value = null
   const nuevo = Math.min(100, Math.max(0, Number(cupoEditado.value)))
   if (!Number.isFinite(nuevo) || nuevo === paralelo.cupo) return

   guardandoCupo.value = paralelo.id
   try {
      await $fetch(`/api/paralelos/${paralelo.id}`, {
         method: 'PATCH',
         body: {
            codigo: paralelo.codigo,
            cupo: nuevo,
            asignaturaPlanId: paralelo.asignaturaPlanId,
            cursoId: paralelo.cursoId,
         },
      })
      await refrescarParalelos()
      toast.add({ title: 'Cupo actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (err: unknown) {
      const mensaje = (err as { data?: { message?: string } }).data?.message ?? 'Error al actualizar el cupo'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      guardandoCupo.value = null
   }
}
</script>

<template>
   <div class="space-y-6">
      <div>
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Selecciona un plan, revisa su malla y arrastra una asignatura hasta el curso donde quieras crear un
            paralelo. El código del paralelo se toma del número del curso. Arrastra los paralelos dentro de un curso
            para ordenarlos. Para eliminar un paralelo, usa el botón de su ficha o arrástralo de vuelta hasta la malla.
         </p>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
         <USelectMenu
            v-model="planSeleccionadoId"
            :items="opcionesPlan"
            value-key="value"
            :loading="statusPlanes === 'pending'"
            placeholder="Selecciona un plan…"
            :search-input="{ placeholder: 'Buscar carrera o número…' }"
            class="w-full sm:w-96"
         />
         <USelect
            v-model="semestreSeleccionadoId"
            :items="opcionesSemestre"
            value-key="value"
            placeholder="Selecciona un semestre…"
            class="w-full sm:w-56"
         />
      </div>

      <EmptyState
         v-if="!planSeleccionado"
         icon="i-lucide-mouse-pointer-click"
         message="Selecciona un plan para ver su malla y crear paralelos"
      />

      <template v-else>
         <!-- Malla: asignaturas del plan por semestre -->
         <div class="space-y-3">
            <h3 class="font-semibold text-usm-text dark:text-white">Malla curricular</h3>

            <TableSkeleton v-if="cargandoAsignaturas" :rows="5" />

            <EmptyState
               v-else-if="!asignaturasAsignadas.length"
               icon="i-lucide-layers"
               message="Este plan todavía no tiene asignaturas asociadas a un semestre"
            />

            <div
               v-else
               class="grid grid-flow-col auto-cols-47.5 gap-3 overflow-x-auto pb-2 transition-colors duration-150 lg:grid-flow-row lg:auto-cols-auto lg:overflow-x-visible lg:pb-0 lg:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
               :class="permiteDropParalelo() ? 'outline-2 -outline-offset-2 outline-usm-red/40 rounded-2xl' : ''"
               :style="{ '--cols': totalColumnasMalla }"
               @dragover="onDragOverMalla"
               @drop="onDropMalla"
            >
               <div
                  v-for="semestre in columnas"
                  :key="semestre"
                  class="flex min-w-0 flex-col rounded-2xl border border-default bg-muted/40 p-2"
               >
                  <p class="mb-2 px-1 text-xs font-semibold text-usm-text-muted dark:text-slate-400">
                     Semestre {{ semestre }}
                  </p>
                  <!-- Alto fijo para 6 asignaturas (6 fichas de 50px + 5 gaps de 8px = 21.25rem);
                     con más, la columna scrollea en vez de seguir creciendo. -->
                  <div class="min-h-20 max-h-85 flex-1 space-y-2 overflow-y-auto">
                     <p
                        v-if="!asignaturasDeSemestre(semestre).length"
                        class="py-6 text-center text-[11px] text-usm-text-muted/60 dark:text-slate-500"
                     >
                        Sin asignaturas
                     </p>
                     <div
                        v-for="asignatura in asignaturasDeSemestre(semestre)"
                        :key="asignatura.id"
                        :draggable="puedeArrastrar(asignatura)"
                        class="rounded-lg border border-default bg-default p-2 text-xs shadow-sm transition-opacity"
                        :class="[
                           puedeArrastrar(asignatura)
                              ? 'cursor-grab active:cursor-grabbing'
                              : 'cursor-not-allowed opacity-60',
                           creando === asignatura.asignaturaPlanId ? 'pointer-events-none opacity-50' : '',
                        ]"
                        @dragstart="iniciarArrastre($event, asignatura)"
                        @dragend="terminarArrastre"
                     >
                        <UTooltip :text="asignatura.nombre">
                           <p class="truncate font-medium text-usm-text dark:text-white">{{ asignatura.nombre }}</p>
                        </UTooltip>
                        <div class="flex items-center justify-between gap-1">
                           <p class="truncate text-usm-text-muted dark:text-slate-400">{{ asignatura.codigo }}</p>
                           <UTooltip :text="`${paralelosDeAsignatura(asignatura)} paralelo(s) creado(s)`">
                              <UBadge
                                 size="xs"
                                 variant="subtle"
                                 :color="paralelosDeAsignatura(asignatura) > 0 ? 'info' : 'neutral'"
                              >
                                 <UIcon name="i-lucide-copy" class="size-3" />
                                 {{ paralelosDeAsignatura(asignatura) }}
                              </UBadge>
                           </UTooltip>
                        </div>
                     </div>
                  </div>
               </div>

               <!-- Columna de Electivos: solo si el plan la tiene habilitada. Una asignatura
                  aquí se puede arrastrar a un curso de cualquier semestre (ver esFueraDeSemestre). -->
               <div
                  v-if="planSeleccionado.tieneElectivos"
                  class="flex min-w-0 flex-col rounded-2xl border border-usm-purple-200 bg-usm-purple-50/40 p-2 dark:border-usm-purple-900 dark:bg-usm-purple-950/20"
               >
                  <p class="mb-2 px-1 text-xs font-semibold text-usm-purple-700 dark:text-usm-purple-300">Electivos</p>
                  <!-- Alto fijo para 6 asignaturas (6 fichas de 50px + 5 gaps de 8px = 21.25rem);
                     con más, la columna scrollea en vez de seguir creciendo. -->
                  <div class="min-h-20 max-h-85 flex-1 space-y-2 overflow-y-auto">
                     <p
                        v-if="!electivas.length"
                        class="py-6 text-center text-[11px] text-usm-text-muted/60 dark:text-slate-500"
                     >
                        Sin electivos
                     </p>
                     <div
                        v-for="asignatura in electivas"
                        :key="asignatura.id"
                        :draggable="puedeArrastrar(asignatura)"
                        class="rounded-lg border border-default bg-default p-2 text-xs shadow-sm transition-opacity"
                        :class="[
                           puedeArrastrar(asignatura)
                              ? 'cursor-grab active:cursor-grabbing'
                              : 'cursor-not-allowed opacity-60',
                           creando === asignatura.asignaturaPlanId ? 'pointer-events-none opacity-50' : '',
                        ]"
                        @dragstart="iniciarArrastre($event, asignatura)"
                        @dragend="terminarArrastre"
                     >
                        <UTooltip :text="asignatura.nombre">
                           <p class="truncate font-medium text-usm-text dark:text-white">{{ asignatura.nombre }}</p>
                        </UTooltip>
                        <div class="flex items-center justify-between gap-1">
                           <p class="truncate text-usm-text-muted dark:text-slate-400">{{ asignatura.codigo }}</p>
                           <UTooltip :text="`${paralelosDeAsignatura(asignatura)} paralelo(s) creado(s)`">
                              <UBadge
                                 size="xs"
                                 variant="subtle"
                                 :color="paralelosDeAsignatura(asignatura) > 0 ? 'info' : 'neutral'"
                              >
                                 <UIcon name="i-lucide-copy" class="size-3" />
                                 {{ paralelosDeAsignatura(asignatura) }}
                              </UBadge>
                           </UTooltip>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <!-- Paneles de curso: destino del arrastre -->
         <div class="space-y-3">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
               <h3 class="font-semibold text-usm-text dark:text-white">Cursos del plan</h3>
               <UInput
                  v-model="busquedaCurso"
                  icon="i-lucide-search"
                  placeholder="Buscar curso…"
                  class="w-full sm:w-64"
               />
            </div>

            <EmptyState
               v-if="!cursosDelPlan.length"
               icon="i-lucide-school"
               message="Este plan todavía no tiene cursos. Crea uno primero en la sección Cursos."
            />

            <EmptyState
               v-else-if="!cursosVisibles.length"
               icon="i-lucide-search"
               message="No se encontraron cursos con ese nombre"
            />

            <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
               <div
                  v-for="curso in cursosVisibles"
                  :key="curso.id"
                  draggable="true"
                  class="flex cursor-grab flex-col rounded-2xl border border-default bg-muted/40 p-3 transition-[opacity,box-shadow,outline-color] duration-150 active:cursor-grabbing"
                  :class="[
                     permiteDrop() || (permiteDropParalelo() && arrastrandoParalelo?.cursoId === curso.id)
                        ? 'outline-2 -outline-offset-2 outline-usm-blue/40'
                        : '',
                     permiteDropCurso() && sobreCursoId === curso.id
                        ? 'outline-2 -outline-offset-2 outline-usm-purple/50'
                        : '',
                     arrastrandoCursoId === curso.id ? 'opacity-50' : '',
                  ]"
                  @dragstart="iniciarArrastreCurso($event, curso)"
                  @dragend="terminarArrastreCurso"
                  @dragover="onDragOverCurso($event, curso)"
                  @drop="onDropCurso($event, curso)"
               >
                  <UCollapsible :default-open="true" class="flex flex-1 flex-col">
                     <template #default="{ open }">
                        <button
                           type="button"
                           class="mb-2 flex w-full items-center justify-between gap-2 text-left"
                           @click.stop
                        >
                           <div class="min-w-0">
                              <p class="truncate text-sm font-semibold text-usm-text dark:text-white">
                                 {{ curso.nombre }}
                              </p>
                              <p class="text-xs text-usm-text-muted dark:text-slate-400">
                                 N° {{ curso.numero }} · Sem. {{ curso.numeroSemestre }} · {{ curso.semestre.nombre }}
                              </p>
                           </div>
                           <div class="flex shrink-0 items-center gap-2">
                              <UBadge variant="subtle" color="neutral">{{ paralelosDeCurso(curso.id).length }}</UBadge>
                              <UIcon
                                 name="i-lucide-chevron-down"
                                 class="size-4 text-usm-text-muted transition-transform duration-150"
                                 :class="open ? '' : '-rotate-90'"
                              />
                           </div>
                        </button>
                     </template>
                     <template #content>
                        <div class="min-h-16 flex-1 space-y-1.5">
                           <p
                              v-if="!paralelosDeCurso(curso.id).length"
                              class="py-4 text-center text-[11px] text-usm-text-muted/60 dark:text-slate-500"
                           >
                              Suelta aquí una asignatura para crear un paralelo
                           </p>
                           <div
                              v-for="paralelo in paralelosDeCurso(curso.id)"
                              :key="paralelo.id"
                              :draggable="
                                 puedeBorrarParalelo &&
                                 editandoCodigoId !== paralelo.id &&
                                 editandoCupoId !== paralelo.id
                              "
                              class="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-[opacity,box-shadow]"
                              :class="[
                                 esFueraDeSemestre(paralelo, curso)
                                    ? 'border-usm-yellow-300 bg-usm-yellow-50 dark:border-usm-yellow-800 dark:bg-usm-yellow-950'
                                    : 'border-default bg-default',
                                 puedeBorrarParalelo &&
                                 editandoCodigoId !== paralelo.id &&
                                 editandoCupoId !== paralelo.id
                                    ? 'cursor-grab active:cursor-grabbing'
                                    : '',
                                 eliminando === paralelo.id || moviendoParaleloId === paralelo.id
                                    ? 'pointer-events-none opacity-50'
                                    : '',
                                 sobreParaleloId === paralelo.id
                                    ? '-translate-y-0.5 shadow-[0_-2px_0_0_var(--color-usm-blue)]'
                                    : '',
                              ]"
                              @dragstart="iniciarArrastreParalelo($event, paralelo)"
                              @dragend="terminarArrastreParalelo"
                              @dragover="onDragOverParaleloItem($event, curso, paralelo)"
                              @drop="onDropParaleloItem($event, curso, paralelo)"
                           >
                              <UTooltip
                                 v-if="esFueraDeSemestre(paralelo, curso)"
                                 :text="`Fuera de semestre: la asignatura es del semestre ${paralelo.asignaturaPlan.semestre} del plan`"
                              >
                                 <UIcon
                                    name="i-lucide-triangle-alert"
                                    class="size-3.5 shrink-0 text-usm-yellow-700 dark:text-usm-yellow-400"
                                 />
                              </UTooltip>
                              <UInput
                                 v-if="editandoCodigoId === paralelo.id"
                                 v-model="codigoEditado"
                                 size="xs"
                                 maxlength="10"
                                 autofocus
                                 class="w-16 shrink-0"
                                 :loading="guardandoCodigo === paralelo.id"
                                 @keyup.enter="guardarCodigo(paralelo)"
                                 @keyup.esc="cancelarEditarCodigo"
                                 @blur="guardarCodigo(paralelo)"
                                 @click.stop
                              />
                              <UTooltip
                                 v-else
                                 :text="puedeEditarParalelo ? 'Click para editar el código' : paralelo.codigo"
                              >
                                 <UBadge
                                    variant="subtle"
                                    color="info"
                                    class="shrink-0"
                                    :class="puedeEditarParalelo ? 'cursor-pointer' : ''"
                                    @click.stop="abrirEditarCodigo(paralelo)"
                                 >
                                    {{ paralelo.codigo }}
                                 </UBadge>
                              </UTooltip>
                              <span class="min-w-0 flex-1 truncate text-usm-text dark:text-white">
                                 {{ paralelo.asignaturaPlan.asignatura.nombre }}
                              </span>
                              <UInput
                                 v-if="editandoCupoId === paralelo.id"
                                 v-model="cupoEditado"
                                 type="number"
                                 min="0"
                                 max="100"
                                 size="xs"
                                 autofocus
                                 class="w-14 shrink-0"
                                 :loading="guardandoCupo === paralelo.id"
                                 @keyup.enter="guardarCupo(paralelo)"
                                 @keyup.esc="cancelarEditarCupo"
                                 @blur="guardarCupo(paralelo)"
                                 @click.stop
                              />
                              <UTooltip
                                 v-else
                                 :text="puedeEditarParalelo ? 'Click para editar el cupo' : `Cupo: ${paralelo.cupo}`"
                              >
                                 <UBadge
                                    variant="subtle"
                                    color="neutral"
                                    class="shrink-0"
                                    :class="puedeEditarParalelo ? 'cursor-pointer' : ''"
                                    @click.stop="abrirEditarCupo(paralelo)"
                                 >
                                    <UIcon name="i-lucide-users" class="size-3" />
                                    {{ paralelo.cupo }}
                                 </UBadge>
                              </UTooltip>
                              <UTooltip v-if="puedeBorrarParalelo" text="Eliminar paralelo">
                                 <UButton
                                    icon="i-lucide-x"
                                    color="error"
                                    variant="ghost"
                                    size="xs"
                                    class="shrink-0"
                                    aria-label="Eliminar paralelo"
                                    :loading="eliminando === paralelo.id"
                                    @click="borrarParalelo(paralelo)"
                                 />
                              </UTooltip>
                           </div>
                        </div>
                     </template>
                  </UCollapsible>
               </div>
            </div>
         </div>
      </template>

      <!-- Advertencia: el semestre-en-plan de la asignatura no coincide con el del curso -->
      <ConfirmModal
         v-model:open="modalAdvertenciaMostrar"
         title="El semestre no coincide"
         confirm-label="Crear de todos modos"
         confirm-icon="i-lucide-alert-triangle"
         confirm-color="warning"
         :loading="creando !== null"
         @confirm="confirmarCreacionConAdvertencia"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            <span class="font-semibold">{{ pendiente?.asignatura.nombre }}</span> está en el semestre
            <span class="font-semibold">{{ pendiente?.asignatura.semestre }}</span> del plan, pero
            <span class="font-semibold">{{ pendiente?.curso.nombre }}</span> corresponde al semestre
            <span class="font-semibold">{{ pendiente?.curso.numeroSemestre }}</span> del plan.
         </p>
         <p class="text-sm text-usm-text-muted dark:text-slate-400">¿Quieres crear el paralelo de todas formas?</p>
      </ConfirmModal>
   </div>
</template>
