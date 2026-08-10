<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Paralelo } from '~/types/paralelo'
import type { Semestre } from '~/types/semestre'
import type { AsignaturaPlan } from '~/types/asignaturaPlan'
import type { Curso } from '~/types/curso'

const toast = useToast()

const [{ data: paralelos, status, refresh }, { data: semestres }, { data: asignaturasPlan }, { data: cursos }] =
   await Promise.all([
      useFetch<Paralelo[]>('/api/paralelos'),
      useFetch<Semestre[]>('/api/semestres'),
      useFetch<AsignaturaPlan[]>('/api/asignaturas-plan'),
      useFetch<Curso[]>('/api/cursos'),
   ])

function labelAsignaturaPlan(ap: AsignaturaPlan) {
   return `${ap.asignatura.nombre} (${ap.asignatura.codigo}) — ${ap.plan.carrera.nombre}, Plan N° ${ap.plan.numero}, Semestre ${ap.semestre}`
}

// Sin el plan/carrera: en el formulario de crear ya se elige el plan aparte, así que
// repetirlo en cada opción de asignatura sería redundante.
function labelAsignaturaPlanCrear(ap: AsignaturaPlan) {
   return `${ap.asignatura.nombre} (${ap.asignatura.codigo}) — Semestre ${ap.semestre}`
}

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/paralelos')
const { tieneAlcanceSobreCarrera } = useAlcanceCarrera()

// Ver la lista ya no se acota por carrera (ver /api/paralelos), pero editar/borrar sigue
// acotado a la(s) carrera(s) que el usuario dirige — mismo criterio que usan los propios
// endpoints de mutación (resolverCarrerasJefe).
function puedeEditarParalelo(paralelo: Paralelo) {
   return puedeEditar.value && tieneAlcanceSobreCarrera(paralelo.asignaturaPlan.plan.carreraCodigo)
}
function puedeBorrarParalelo(paralelo: Paralelo) {
   return puedeBorrar.value && tieneAlcanceSobreCarrera(paralelo.asignaturaPlan.plan.carreraCodigo)
}

const opcionesAsignaturaPlan = computed(() =>
   [...(asignaturasPlan.value ?? [])]
      .sort((a, b) => a.semestre - b.semestre || a.asignatura.nombre.localeCompare(b.asignatura.nombre))
      .map((ap) => ({ label: labelAsignaturaPlan(ap), value: ap.id }))
)

// Un paralelo solo puede quedar en un curso del mismo plan que su asignatura; el curso ya
// pertenece a un semestre específico, así que elegir el curso define el semestre del paralelo.
function cursosDelPlan(asignaturaPlanId: number) {
   const planId = asignaturasPlan.value?.find((ap) => ap.id === asignaturaPlanId)?.planId
   return (cursos.value ?? []).filter((c) => c.planId === planId)
}

function opcionesCursoDe(asignaturaPlanId: number) {
   return cursosDelPlan(asignaturaPlanId).map((c) => ({ label: `${c.nombre} — ${c.semestre.nombre}`, value: c.id }))
}

// Sin opción "todos": la tabla ya no muestra las columnas Plan ni Semestre, así que la
// lista siempre queda acotada a un plan y un semestre específicos (si no, sería imposible
// distinguir a qué plan/semestre pertenece cada fila).
const filtroSemestre = ref<number>()
const filtroPlan = ref<number>()
const busqueda = ref('')

const opcionesSemestreReal = computed(() => (semestres.value ?? []).map((s) => ({ label: s.nombre, value: s.id })))

// Para "Nuevo paralelo" el selector de plan queda acotado a las asignaturas que el usuario
// puede administrar (/api/asignaturas-plan, ver server/utils/alcanceCarrera.ts): no tiene
// sentido ofrecer un plan donde no podría elegir ninguna asignatura de todas formas.
const opcionesPlanReal = computed(() => {
   const planes = new Map<number, string>()
   for (const ap of asignaturasPlan.value ?? []) {
      if (!planes.has(ap.planId)) {
         planes.set(ap.planId, `${ap.plan.carrera.nombre} — Plan N° ${ap.plan.numero}`)
      }
   }
   return [...planes.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ label, value }))
})

// Para el FILTRO de la lista, en cambio, se arma a partir de los paralelos ya visibles
// (/api/paralelos ya no se acota por carrera): así se puede filtrar por cualquier plan, no
// solo los que el usuario administra.
const opcionesFiltroPlan = computed(() => {
   const planes = new Map<number, string>()
   for (const p of paralelos.value ?? []) {
      const { planId, plan } = p.asignaturaPlan
      if (!planes.has(planId)) planes.set(planId, `${plan.carrera.nombre} — Plan N° ${plan.numero}`)
   }
   return [...planes.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ label, value }))
})

watchEffect(() => {
   if (filtroSemestre.value == null && semestres.value?.length) {
      filtroSemestre.value = semestres.value.find((s) => s.vigente)?.id ?? semestres.value[0]!.id
   }
   if (filtroPlan.value == null && opcionesFiltroPlan.value.length) {
      filtroPlan.value = opcionesFiltroPlan.value[0]!.value
   }
})

const paralelosFiltrados = computed(() => {
   let lista = paralelos.value ?? []
   if (filtroSemestre.value != null) lista = lista.filter((p) => p.curso.semestreId === filtroSemestre.value)
   if (filtroPlan.value != null) lista = lista.filter((p) => p.asignaturaPlan.planId === filtroPlan.value)
   if (busqueda.value.trim()) {
      const q = normalizarTexto(busqueda.value)
      lista = lista.filter(
         (p) =>
            normalizarTexto(p.codigo).includes(q) ||
            normalizarTexto(p.asignaturaPlan.asignatura.nombre).includes(q) ||
            normalizarTexto(p.asignaturaPlan.asignatura.codigo).includes(q)
      )
   }
   return lista
})

const { paginaActual, itemsPagina: paralelosPagina, porPagina } = usePaginacion(paralelosFiltrados)

const columnas: TableColumn<Paralelo>[] = [
   { id: 'curso', header: 'Curso', size: 110 },
   { id: 'asignatura', header: 'Asignatura' },
   { accessorKey: 'codigo', header: 'Código de Paralelo', size: 90 },
   { accessorKey: 'cupo', header: 'Cupo', size: 80 },
   { id: 'acciones', header: '', size: 100 },
]

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({ planId: 0, semestreId: 0, codigo: '', cupo: 0, asignaturaPlanId: 0, cursoId: 0 })
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

// La asignatura solo muestra las de este plan; el curso, los de este plan en este semestre.
const opcionesAsignaturaPlanCrear = computed(() =>
   [...(asignaturasPlan.value ?? [])]
      .filter((ap) => ap.planId === formCrear.planId)
      .sort((a, b) => a.semestre - b.semestre || a.asignatura.nombre.localeCompare(b.asignatura.nombre))
      .map((ap) => ({ label: labelAsignaturaPlanCrear(ap), value: ap.id }))
)
const opcionesCursoCrear = computed(() =>
   (cursos.value ?? [])
      .filter((c) => c.planId === formCrear.planId && c.semestreId === formCrear.semestreId)
      .map((c) => ({ label: c.nombre, value: c.id }))
)

// Si el plan cambia, la asignatura seleccionada podría no pertenecer a él; si el plan o el
// semestre cambian, el curso seleccionado podría no pertenecer a esa combinación.
watch(
   () => formCrear.planId,
   () => {
      if (!opcionesAsignaturaPlanCrear.value.some((o) => o.value === formCrear.asignaturaPlanId)) {
         formCrear.asignaturaPlanId = opcionesAsignaturaPlanCrear.value[0]?.value ?? 0
      }
   }
)
watch([() => formCrear.planId, () => formCrear.semestreId], () => {
   if (!opcionesCursoCrear.value.some((o) => o.value === formCrear.cursoId)) {
      formCrear.cursoId = opcionesCursoCrear.value[0]?.value ?? 0
   }
})

// El código del paralelo es, por convención, el número del curso (igual que al crear un
// paralelo arrastrando una asignatura en /paralelos/asignacion).
watch(
   () => formCrear.cursoId,
   (cursoId) => {
      const curso = cursos.value?.find((c) => c.id === cursoId)
      if (curso) formCrear.codigo = String(curso.numero)
   }
)

function abrirCrear() {
   formCrear.planId =
      filtroPlan.value != null && opcionesPlanReal.value.some((p) => p.value === filtroPlan.value)
         ? filtroPlan.value
         : (opcionesPlanReal.value[0]?.value ?? 0)
   formCrear.semestreId =
      filtroSemestre.value != null && opcionesSemestreReal.value.some((s) => s.value === filtroSemestre.value)
         ? filtroSemestre.value
         : (opcionesSemestreReal.value[0]?.value ?? 0)
   formCrear.codigo = ''
   formCrear.cupo = 0
   formCrear.asignaturaPlanId = opcionesAsignaturaPlanCrear.value[0]?.value ?? 0
   formCrear.cursoId = opcionesCursoCrear.value[0]?.value ?? 0
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

function asignaturaCodigoDe(asignaturaPlanId: number) {
   return asignaturasPlan.value?.find((ap) => ap.id === asignaturaPlanId)?.asignatura.codigo ?? ''
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null

   if (
      existeParaleloDuplicado(paralelos.value ?? [], {
         cursoId: formCrear.cursoId,
         asignaturaCodigo: asignaturaCodigoDe(formCrear.asignaturaPlanId),
         codigo: formCrear.codigo,
      })
   ) {
      errorGuardar.value = 'Ya existe un paralelo con este código para esta asignatura en este curso'
      guardando.value = false
      return
   }

   try {
      await $fetch('/api/paralelos', {
         method: 'POST',
         body: {
            codigo: formCrear.codigo,
            cupo: Number(formCrear.cupo),
            asignaturaPlanId: Number(formCrear.asignaturaPlanId),
            cursoId: Number(formCrear.cursoId),
         },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Paralelo creado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const paraleloEditar = ref<Paralelo | null>(null)
const formEditar = reactive({ codigo: '', cupo: 0, asignaturaPlanId: 0, cursoId: 0 })
const errorEditar = ref<string | null>(null)

watch(
   () => formEditar.asignaturaPlanId,
   (asignaturaPlanId) => {
      if (!opcionesCursoDe(asignaturaPlanId).some((o) => o.value === formEditar.cursoId)) {
         formEditar.cursoId = opcionesCursoDe(asignaturaPlanId)[0]?.value ?? 0
      }
   }
)

function abrirEditar(paralelo: Paralelo) {
   paraleloEditar.value = paralelo
   formEditar.codigo = paralelo.codigo
   formEditar.cupo = paralelo.cupo
   formEditar.asignaturaPlanId = paralelo.asignaturaPlanId
   formEditar.cursoId = paralelo.cursoId
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!paraleloEditar.value) return
   guardando.value = true
   errorEditar.value = null

   if (
      existeParaleloDuplicado(paralelos.value ?? [], {
         cursoId: formEditar.cursoId,
         asignaturaCodigo: asignaturaCodigoDe(formEditar.asignaturaPlanId),
         codigo: formEditar.codigo,
         excluirId: paraleloEditar.value.id,
      })
   ) {
      errorEditar.value = 'Ya existe un paralelo con este código para esta asignatura en este curso'
      guardando.value = false
      return
   }

   try {
      const url: string = `/api/paralelos/${paraleloEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: {
            codigo: formEditar.codigo,
            cupo: Number(formEditar.cupo),
            asignaturaPlanId: Number(formEditar.asignaturaPlanId),
            cursoId: Number(formEditar.cursoId),
         },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Paralelo actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const paraleloAEliminar = ref<Paralelo | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(paralelo: Paralelo) {
   paraleloAEliminar.value = paralelo
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!paraleloAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/paralelos/${paraleloAEliminar.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Paralelo eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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
            <p class="text-sm text-usm-text-muted dark:text-slate-400">
               Paralelos de las asignaturas que se dictan cada semestre.
            </p>
         </div>
         <UButton
            icon="i-lucide-plus"
            class="sm:shrink-0"
            :disabled="!asignaturasPlan?.length || !cursos?.length || !puedeCrear"
            @click="abrirCrear"
         >
            Nuevo paralelo
         </UButton>
      </div>

      <!-- Filtros -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
         <UInput
            v-model="busqueda"
            icon="i-lucide-search"
            placeholder="Buscar por código o asignatura…"
            class="sm:w-72"
         />
         <USelect v-model="filtroSemestre" :items="opcionesSemestreReal" value-key="value" class="sm:w-56" />
         <USelect v-model="filtroPlan" :items="opcionesFiltroPlan" value-key="value" class="w-full sm:w-96" />
         <span class="text-sm text-usm-text-muted dark:text-slate-400">
            {{ paralelosFiltrados.length }} paralelo{{ paralelosFiltrados.length !== 1 ? 's' : '' }}
         </span>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="6" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!paralelosFiltrados.length"
            icon="i-lucide-layers"
            message="No hay paralelos registrados"
            :action="
               asignaturasPlan?.length && cursos?.length && !busqueda && puedeCrear ? 'Nuevo paralelo' : undefined
            "
            @action="abrirCrear"
         />
         <UTable v-else :data="paralelosPagina" :columns="columnas">
            <template #curso-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ row.original.curso.nombre }}</span>
            </template>
            <template #asignatura-cell="{ row }">
               <div>
                  <p class="font-medium text-usm-text dark:text-white">
                     {{ row.original.asignaturaPlan.asignatura.nombre }}
                  </p>
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">
                     {{ row.original.asignaturaPlan.asignatura.codigo }}
                  </p>
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
                        :disabled="!puedeEditarParalelo(row.original)"
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
                        :disabled="!puedeBorrarParalelo(row.original)"
                        @click="abrirConfirmEliminar(row.original)"
                     />
                  </UTooltip>
               </div>
            </template>
         </UTable>
      </div>

      <div v-if="paralelosFiltrados.length > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="paralelosFiltrados.length" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo paralelo" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-paralelo-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Plan" name="planId">
                     <USelect v-model="formCrear.planId" :items="opcionesPlanReal" value-key="value" class="w-full" />
                  </UFormField>
                  <UFormField label="Semestre" name="semestreId">
                     <USelect
                        v-model="formCrear.semestreId"
                        :items="opcionesSemestreReal"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
               </div>
               <UFormField label="Curso" name="cursoId">
                  <USelect
                     v-model="formCrear.cursoId"
                     :items="opcionesCursoCrear"
                     value-key="value"
                     :disabled="!opcionesCursoCrear.length"
                     class="w-full"
                  />
                  <p v-if="!opcionesCursoCrear.length" class="mt-1 text-xs text-usm-text-muted dark:text-slate-400">
                     Este plan no tiene cursos en el semestre seleccionado. Crea uno primero en la sección Cursos.
                  </p>
               </UFormField>
               <UFormField label="Asignatura" name="asignaturaPlanId">
                  <USelectMenu
                     v-model="formCrear.asignaturaPlanId"
                     :items="opcionesAsignaturaPlanCrear"
                     value-key="value"
                     placeholder="Selecciona una asignatura…"
                     :search-input="{ placeholder: 'Buscar por nombre o código…' }"
                     class="w-full"
                  />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Código del Paralelo" name="codigo" :error="errorGuardar ?? undefined">
                     <UInput v-model="formCrear.codigo" placeholder="300, 301, ..." class="w-full" />
                  </UFormField>
                  <UFormField label="Cupo" name="cupo" help="0 a 100">
                     <UInput
                        :model-value="String(formCrear.cupo)"
                        type="number"
                        min="0"
                        max="100"
                        class="w-full"
                        @update:model-value="formCrear.cupo = Number($event)"
                     />
                  </UFormField>
               </div>
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
            <UButton type="submit" form="form-paralelo-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal
         v-model:open="modalEditarMostrar"
         :title="`Editar paralelo ${paraleloEditar?.codigo}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm id="form-paralelo-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Código" name="codigo" :error="errorEditar ?? undefined">
                     <UInput v-model="formEditar.codigo" class="w-full" />
                  </UFormField>
                  <UFormField label="Cupo" name="cupo" help="0 a 100">
                     <UInput
                        :model-value="String(formEditar.cupo)"
                        type="number"
                        min="0"
                        max="100"
                        class="w-full"
                        @update:model-value="formEditar.cupo = Number($event)"
                     />
                  </UFormField>
               </div>
               <UFormField label="Asignatura (plan)" name="asignaturaPlanId">
                  <USelect
                     v-model="formEditar.asignaturaPlanId"
                     :items="opcionesAsignaturaPlan"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Curso" name="cursoId">
                  <USelect
                     v-model="formEditar.cursoId"
                     :items="opcionesCursoDe(formEditar.asignaturaPlanId)"
                     value-key="value"
                     :disabled="!opcionesCursoDe(formEditar.asignaturaPlanId).length"
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
            <UButton type="submit" form="form-paralelo-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar paralelo"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar el paralelo
            <span class="font-semibold">{{ paraleloAEliminar?.codigo }}</span>
            de <span class="font-semibold">{{ paraleloAEliminar?.asignaturaPlan.asignatura.nombre }}</span
            >? Solo es posible si no tiene sesiones asociadas.
         </p>
      </ConfirmModal>
   </div>
</template>
