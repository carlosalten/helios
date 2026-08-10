<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Curso } from '~/types/curso'
import type { Plan } from '~/types/plan'
import type { Semestre } from '~/types/semestre'
import { nombreCortoDia } from '~/types/dia'

const toast = useToast()
const { user } = useUserSession()

const [{ data: cursos, status, refresh }, { data: semestres }, { data: planesDisponibles }] = await Promise.all([
   useFetch<Curso[]>('/api/cursos'),
   useFetch<Semestre[]>('/api/semestres'),
   // Planes de las carreras que el usuario puede administrar (todas para Administrador;
   // acotado por carrera para Jefe de Carrera / Director Departamento). Se usa para el
   // selector de "Nuevo curso" y el de "Editar": no tiene sentido ofrecer planes fuera de
   // ese alcance para una mutación que el backend rechazaría igual.
   useFetch<Plan[]>('/api/cursos/planes'),
])

function labelPlan(plan: { numero: number; carrera: { nombre: string } }) {
   return `${plan.carrera.nombre} — Plan N° ${plan.numero}`
}

// Para "Nuevo curso" y "Editar" el selector de plan queda acotado al alcance de la
// mutación (ver /api/cursos/planes): no tiene sentido ofrecer un plan que el backend
// rechazaría. Para el FILTRO de la lista, en cambio, se arma a partir de los cursos ya
// visibles (ver `cursosFiltrados`), que ahora se ven todos sin importar la carrera.
const opcionesPlanCrear = computed(() =>
   (planesDisponibles.value ?? []).map((p) => ({ label: labelPlan(p), value: p.id }))
)
const opcionesSemestre = computed(() => (semestres.value ?? []).map((s) => ({ label: s.nombre, value: s.id })))
const semestreVigente = computed(() => (semestres.value ?? []).find((s) => s.vigente) ?? null)

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/cursos')
const { tieneAlcanceSobreCarrera } = useAlcanceCarrera()
const esAdministrador = computed(() => user.value?.rol === 'Administrador')

function puedeEditarCurso(curso: Curso) {
   return puedeEditar.value && tieneAlcanceSobreCarrera(curso.plan.carreraCodigo)
}
function puedeBorrarCurso(curso: Curso) {
   return puedeBorrar.value && tieneAlcanceSobreCarrera(curso.plan.carreraCodigo)
}

// Se arma a partir de los cursos visibles (no de /api/planes) para que el filtro liste
// exactamente los planes que tienen cursos que ver — incluidas las carreras donde el
// usuario no puede editar, ya ahora se ven todas. Sin opción "todos los planes": la tabla
// ya no muestra la columna Plan, así que la lista siempre queda acotada a un plan
// específico (si no, sería imposible saber a qué plan pertenece cada fila).
const opcionesFiltroPlan = computed(() => {
   const vistos = new Map<number, { numero: number; carrera: { nombre: string } }>()
   for (const curso of cursos.value ?? []) {
      if (!vistos.has(curso.planId)) vistos.set(curso.planId, curso.plan)
   }
   return [...vistos.entries()]
      .map(([id, plan]) => ({ label: labelPlan(plan), value: id }))
      .sort((a, b) => a.label.localeCompare(b.label))
})

const filtroPlan = ref<number>()
const filtroSemestre = ref<number | '__todos__'>(semestreVigente.value?.id ?? '__todos__')

// También corrige el filtro si el plan seleccionado deja de tener cursos (p. ej. se borró el
// último): si no, el USelect queda con un `value` que ya no está en `items` y muestra el ID
// crudo en vez de la carrera y el plan.
watchEffect(() => {
   if (!opcionesFiltroPlan.value.some((o) => o.value === filtroPlan.value)) {
      filtroPlan.value = opcionesFiltroPlan.value[0]?.value
   }
})

const cursosFiltrados = computed(() => {
   let lista = cursos.value ?? []
   if (filtroPlan.value != null) lista = lista.filter((c) => c.planId === filtroPlan.value)
   if (filtroSemestre.value !== '__todos__') lista = lista.filter((c) => c.semestreId === filtroSemestre.value)
   return lista
})

const opcionesFiltroSemestre = computed(() => [
   { label: 'Todos los semestres', value: '__todos__' as const },
   ...opcionesSemestre.value,
])

const { paginaActual, itemsPagina: cursosPagina, porPagina } = usePaginacion(cursosFiltrados)

function formatHora(hora: string) {
   return hora.slice(11, 16)
}

/* ── Aviso de cambios de otros usuarios ──────────────────────
   No se recarga solo: recargar bajo el cursor haría saltar la tabla o vaciaría el panel de
   detalle abierto. Se avisa y el usuario decide cuándo actualizar.

   Aquí interesan todos los tipos de cambio, incluidos los de salas: `tieneTopes` se calcula
   sobre las sesiones que comparten sala o profesor, así que un cambio en cualquiera de esos
   recursos puede alterar lo que muestra la tabla. */
const hayCambios = ref(false)
const autoresCambios = ref<string[]>([])
const actualizando = ref(false)

useHorarioTiempoReal((eventos) => {
   const ajenos = eventos.filter((e) => e.autorEmail !== user.value?.email)
   if (!ajenos.length) return

   hayCambios.value = true
   autoresCambios.value = [...new Set([...autoresCambios.value, ...ajenos.map((e) => e.autorNombre)])]
})

async function actualizar() {
   actualizando.value = true
   try {
      await refresh()
      hayCambios.value = false
      autoresCambios.value = []
   } finally {
      actualizando.value = false
   }
}

function colorAsignaturasConProfesor(curso: Curso) {
   if (curso.cantidadAsignaturas === 0) return 'neutral'
   return curso.cantidadAsignaturasConProfesor === curso.cantidadAsignaturas ? 'success' : 'warning'
}

/* ── Panel de detalle: paralelos del curso seleccionado ───────────────────── */
const cursoSeleccionado = ref<Curso | null>(null)

function seleccionarCurso(row: { original: Curso }) {
   cursoSeleccionado.value = row.original
}

// Refleja `cursoSeleccionado` como estado de selección de UTable (que resalta la fila con
// `data-selected`) sin duplicar el origen de la verdad: `get` deriva del curso seleccionado,
// `set` (si algo dentro de la tabla llegara a tocar la selección) actualiza `cursoSeleccionado`.
const filaSeleccionada = computed<Record<string, boolean>>({
   get: () => (cursoSeleccionado.value ? { [String(cursoSeleccionado.value.id)]: true } : {}),
   set: (valor) => {
      const id = Object.keys(valor).find((clave) => valor[clave])
      cursoSeleccionado.value = id ? (cursos.value?.find((c) => String(c.id) === id) ?? null) : null
   },
})

// Mantiene el panel sincronizado si el curso seleccionado se edita (o lo cierra si se
// elimina) tras un `refresh()`. Como cualquier recarga (la del botón Actualizar, pero
// también la que sigue a guardar o eliminar) deja los datos al día, aprovecha para bajar
// el aviso de cambios pendientes.
watch(cursos, () => {
   if (cursoSeleccionado.value) {
      cursoSeleccionado.value = cursos.value?.find((c) => c.id === cursoSeleccionado.value!.id) ?? null
   }
   hayCambios.value = false
   autoresCambios.value = []
})

const columnas: TableColumn<Curso>[] = [
   { accessorKey: 'nombre', header: 'Nombre' },
   { accessorKey: 'numero', header: 'Número de Paralelo', size: 90 },
   { accessorKey: 'numeroSemestre', header: 'N° Sem. Plan', size: 100 },
   { id: 'cantidadAsignaturas', header: 'Asignaturas', size: 130 },
   { id: 'cantidadAsignaturasConProfesor', header: 'Asignaturas con Profesor', size: 150 },
   { id: 'tieneTopes', header: 'Topes de Horario', size: 130 },
   { id: 'acciones', header: '', size: 100 },
]

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({ nombre: '', numero: 1, numeroSemestre: 1, planId: 0, semestreId: 0 })
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

function abrirCrear() {
   formCrear.nombre = ''
   formCrear.numero = 1
   formCrear.numeroSemestre = 1
   const planDelFiltro =
      filtroPlan.value != null && planesDisponibles.value?.some((p) => p.id === filtroPlan.value)
         ? filtroPlan.value
         : undefined
   formCrear.planId = planDelFiltro ?? planesDisponibles.value?.[0]?.id ?? 0
   const semestreDelFiltro =
      filtroSemestre.value !== '__todos__' && semestres.value?.some((s) => s.id === filtroSemestre.value)
         ? filtroSemestre.value
         : undefined
   formCrear.semestreId = semestreDelFiltro ?? semestreVigente.value?.id ?? semestres.value?.[0]?.id ?? 0
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/cursos', {
         method: 'POST',
         body: {
            nombre: formCrear.nombre,
            numero: Number(formCrear.numero),
            numeroSemestre: Number(formCrear.numeroSemestre),
            planId: Number(formCrear.planId),
            semestreId: Number(formCrear.semestreId),
         },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Curso creado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const cursoEditar = ref<Curso | null>(null)
const formEditar = reactive({ nombre: '', numero: 1, numeroSemestre: 1, planId: 0, semestreId: 0 })
const errorEditar = ref<string | null>(null)

function abrirEditar(curso: Curso) {
   cursoEditar.value = curso
   formEditar.nombre = curso.nombre
   formEditar.numero = curso.numero
   formEditar.numeroSemestre = curso.numeroSemestre
   formEditar.planId = curso.planId
   formEditar.semestreId = curso.semestreId
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!cursoEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/cursos/${cursoEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: {
            nombre: formEditar.nombre,
            numero: Number(formEditar.numero),
            numeroSemestre: Number(formEditar.numeroSemestre),
            planId: Number(formEditar.planId),
            semestreId: Number(formEditar.semestreId),
         },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Curso actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const cursoAEliminar = ref<Curso | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(curso: Curso) {
   cursoAEliminar.value = curso
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!cursoAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/cursos/${cursoAEliminar.value.id}`
      const { eliminados } = await $fetch<{ eliminados: { paralelos: number; sesiones: number; reservas: number } }>(
         url,
         { method: 'DELETE' }
      )
      confirmEliminarMostrar.value = false
      await refresh()
      const titulo = eliminados.paralelos
         ? `Curso eliminado junto con ${eliminados.paralelos} paralelo(s), ${eliminados.sesiones} sesión(es) y ${eliminados.reservas} reserva(s)`
         : 'Curso eliminado'
      toast.add({ title: titulo, color: 'success', icon: 'i-lucide-check-circle' })
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
               Los cursos agrupan asignaturas del mismo paralelo (ej. 1er año paralelo 300, 2do año paralelo 300, etc.)
            </p>
         </div>
         <div class="flex items-center gap-2 sm:shrink-0">
            <AvisoCambios
               :hay-cambios="hayCambios"
               :cargando="actualizando"
               :autores="autoresCambios"
               @actualizar="actualizar"
            />
            <UButton
               icon="i-lucide-plus"
               :disabled="!planesDisponibles?.length || !semestres?.length || !puedeCrear"
               @click="abrirCrear"
            >
               Nuevo curso
            </UButton>
         </div>
      </div>

      <!-- Filtros -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
         <USelect v-model="filtroPlan" :items="opcionesFiltroPlan" value-key="value" class="w-full sm:w-96" />
         <USelect v-model="filtroSemestre" :items="opcionesFiltroSemestre" value-key="value" class="sm:w-56" />
         <span class="text-sm text-usm-text-muted dark:text-slate-400">
            {{ cursosFiltrados.length }} curso{{ cursosFiltrados.length !== 1 ? 's' : '' }}
         </span>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="6" />

      <div v-else class="lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-6">
         <div class="space-y-6">
            <div class="overflow-hidden rounded-2xl border border-default bg-default">
               <EmptyState
                  v-if="!cursosFiltrados.length"
                  icon="i-lucide-graduation-cap"
                  message="No hay cursos registrados"
                  :action="
                     planesDisponibles?.length && semestres?.length && filtroSemestre === '__todos__' && puedeCrear
                        ? 'Nuevo curso'
                        : undefined
                  "
                  @action="abrirCrear"
               />
               <UTable
                  v-else
                  v-model:row-selection="filaSeleccionada"
                  :data="cursosPagina"
                  :columns="columnas"
                  :get-row-id="(row) => String(row.id)"
                  @select="(_e, row) => seleccionarCurso(row)"
               >
                  <template #cantidadAsignaturas-cell="{ row }">
                     <UBadge variant="subtle" color="neutral">
                        {{ row.original.cantidadAsignaturas }}
                        asignatura{{ row.original.cantidadAsignaturas !== 1 ? 's' : '' }}
                     </UBadge>
                  </template>
                  <template #cantidadAsignaturasConProfesor-cell="{ row }">
                     <div class="flex justify-center">
                        <UBadge variant="subtle" :color="colorAsignaturasConProfesor(row.original)">
                           {{ row.original.cantidadAsignaturasConProfesor }}/{{ row.original.cantidadAsignaturas }}
                        </UBadge>
                     </div>
                  </template>
                  <template #tieneTopes-cell="{ row }">
                     <UBadge variant="subtle" :color="row.original.tieneTopes ? 'error' : 'success'">
                        {{ row.original.tieneTopes ? 'Con topes' : 'Sin topes' }}
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
                              aria-label="Editar"
                              :disabled="!puedeEditarCurso(row.original)"
                              @click.stop="abrirEditar(row.original)"
                           />
                        </UTooltip>
                        <UTooltip text="Eliminar">
                           <UButton
                              icon="i-lucide-trash-2"
                              color="error"
                              variant="ghost"
                              size="xs"
                              aria-label="Eliminar"
                              :disabled="!puedeBorrarCurso(row.original)"
                              @click.stop="abrirConfirmEliminar(row.original)"
                           />
                        </UTooltip>
                     </div>
                  </template>
               </UTable>
            </div>

            <div v-if="cursosFiltrados.length > porPagina" class="flex justify-center">
               <UPagination v-model:page="paginaActual" :total="cursosFiltrados.length" :items-per-page="porPagina" />
            </div>
         </div>

         <!-- Panel de detalle del curso seleccionado -->
         <div class="mt-6 space-y-3 lg:sticky lg:top-6 lg:mt-0">
            <h3 class="font-semibold text-usm-text dark:text-white">Detalle del curso</h3>
            <div v-if="cursoSeleccionado" class="space-y-3">
               <div class="rounded-2xl border border-default bg-default p-4">
                  <div class="mb-3 flex items-start justify-between gap-2">
                     <p class="truncate text-sm font-semibold text-usm-text dark:text-white">
                        {{ cursoSeleccionado.nombre }}
                     </p>
                     <UButton
                        icon="i-lucide-x"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        aria-label="Cerrar"
                        @click="
                           () => {
                              cursoSeleccionado = null
                           }
                        "
                     />
                  </div>

                  <div class="mb-4 flex items-center justify-between gap-2 rounded-lg border border-default p-2">
                     <p class="text-xs font-semibold text-usm-text-muted dark:text-slate-400">Cantidad de paralelos</p>
                     <UBadge variant="subtle" color="neutral">{{ cursoSeleccionado.cantidadParalelos }}</UBadge>
                  </div>

                  <EmptyState
                     v-if="!cursoSeleccionado.paralelos.length"
                     icon="i-lucide-users-round"
                     message="Este curso no tiene paralelos."
                  />
                  <div v-else class="space-y-2.5">
                     <div
                        v-for="paralelo in cursoSeleccionado.paralelos"
                        :key="paralelo.id"
                        class="rounded-lg border border-default p-2.5 text-xs"
                     >
                        <div class="mb-1 flex items-start justify-between gap-2">
                           <p class="font-medium text-usm-text dark:text-white">
                              {{ paralelo.asignaturaCodigo }} · {{ paralelo.asignaturaNombre }}
                           </p>
                           <UBadge variant="subtle" color="neutral" class="shrink-0"
                              >Paralelo {{ paralelo.codigo }}</UBadge
                           >
                        </div>

                        <p class="mb-1.5 text-usm-text-muted dark:text-slate-400">
                           <template v-if="paralelo.profesores.length">
                              {{ paralelo.profesores.map((p) => `${p.nombre} ${p.apellido}`).join(', ') }}
                           </template>
                           <template v-else>Sin profesor asignado</template>
                        </p>

                        <div class="flex flex-wrap items-center gap-1.5">
                           <UBadge variant="subtle" :color="paralelo.horasCompletas ? 'success' : 'warning'">
                              {{ paralelo.horasCompletas ? 'Horas completas' : 'Horas incompletas' }}
                           </UBadge>
                           <UBadge variant="subtle" color="neutral">
                              Teoría {{ paralelo.bloquesTeoriaAsignados }}/{{ paralelo.bloquesTeoriaRequeridos }}
                           </UBadge>
                           <UBadge variant="subtle" color="neutral">
                              Práctica {{ paralelo.bloquesPracticaAsignados }}/{{ paralelo.bloquesPracticaRequeridos }}
                           </UBadge>
                           <UBadge v-if="paralelo.topes.length" variant="subtle" color="error">
                              {{ paralelo.topes.length }} tope{{ paralelo.topes.length !== 1 ? 's' : '' }}
                           </UBadge>
                        </div>

                        <div v-if="paralelo.topes.length" class="mt-2 space-y-1.5">
                           <div
                              v-for="(tope, i) in paralelo.topes"
                              :key="`${paralelo.id}-${tope.diaSemana}-${tope.bloqueId}-${tope.tipo}-${i}`"
                              class="rounded-md border border-error/40 bg-error/5 p-1.5"
                           >
                              <p class="font-medium text-usm-text dark:text-white">
                                 {{ nombreCortoDia(tope.diaSemana) }} · Bloque N° {{ tope.bloqueNumero }} ({{
                                    formatHora(tope.bloqueInicio)
                                 }}–{{ formatHora(tope.bloqueFin) }}) · {{ tope.tipo === 'sala' ? 'Sala' : 'Profesor' }}
                                 {{ tope.recurso }}
                              </p>
                              <p
                                 v-for="(otro, j) in tope.otros"
                                 :key="j"
                                 class="text-usm-text-muted dark:text-slate-400"
                              >
                                 Topa con {{ otro.asignaturaCodigo }} · Paralelo {{ otro.paraleloCodigo }} ·
                                 {{ otro.cursoNombre }}
                              </p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
            <EmptyState
               v-else
               icon="i-lucide-mouse-pointer-click"
               message="Haz click en un curso para ver el detalle de sus paralelos."
            />
         </div>
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo curso" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-curso-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Plan" name="planId">
                  <USelect v-model="formCrear.planId" :items="opcionesPlanCrear" value-key="value" class="w-full" />
               </UFormField>
               <UFormField label="Semestre" name="semestreId">
                  <USelect v-model="formCrear.semestreId" :items="opcionesSemestre" value-key="value" class="w-full" />
               </UFormField>
               <UFormField label="Nombre" name="nombre" :error="errorGuardar ?? undefined">
                  <UInput v-model="formCrear.nombre" placeholder="1er año, 2do año, ..." class="w-full" />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Número de Paralelo" name="numero">
                     <UInput
                        :model-value="String(formCrear.numero)"
                        type="number"
                        min="1"
                        class="w-full"
                        @update:model-value="formCrear.numero = Number($event)"
                     />
                  </UFormField>
                  <UFormField label="Semestre del plan" name="numeroSemestre" help="1 a 12">
                     <UInput
                        :model-value="String(formCrear.numeroSemestre)"
                        type="number"
                        min="1"
                        max="12"
                        class="w-full"
                        @update:model-value="formCrear.numeroSemestre = Number($event)"
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
            <UButton type="submit" form="form-curso-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal
         v-model:open="modalEditarMostrar"
         :title="`Editar curso ${cursoEditar?.nombre}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm id="form-curso-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Plan" name="planId">
                  <USelect v-model="formEditar.planId" :items="opcionesPlanCrear" value-key="value" class="w-full" />
               </UFormField>
               <UFormField label="Semestre" name="semestreId">
                  <USelect v-model="formEditar.semestreId" :items="opcionesSemestre" value-key="value" class="w-full" />
               </UFormField>
               <UFormField label="Nombre" name="nombre" :error="errorEditar ?? undefined">
                  <UInput v-model="formEditar.nombre" class="w-full" />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Número de Paralelo" name="numero">
                     <UInput
                        :model-value="String(formEditar.numero)"
                        type="number"
                        min="1"
                        class="w-full"
                        @update:model-value="formEditar.numero = Number($event)"
                     />
                  </UFormField>
                  <UFormField label="Semestre del plan" name="numeroSemestre" help="1 a 12">
                     <UInput
                        :model-value="String(formEditar.numeroSemestre)"
                        type="number"
                        min="1"
                        max="12"
                        class="w-full"
                        @update:model-value="formEditar.numeroSemestre = Number($event)"
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
                     modalEditarMostrar = false
                  }
               "
               >Cancelar</UButton
            >
            <UButton type="submit" form="form-curso-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar curso"
         :confirm-label="cursoAEliminar?.cantidadParalelos && esAdministrador ? 'Eliminar de todos modos' : 'Eliminar'"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <div class="space-y-3">
            <UAlert
               v-if="cursoAEliminar?.cantidadParalelos && esAdministrador"
               color="error"
               variant="subtle"
               icon="i-lucide-triangle-alert"
               title="Esto borra todo el horario del curso"
               :description="`El curso tiene ${cursoAEliminar.cantidadParalelos} paralelo(s). Como Administrador, al eliminarlo se borran en cascada sus paralelos, las sesiones de clase y las reservas de sala asociadas. Esta acción no se puede deshacer.`"
            />
            <p class="text-sm text-usm-text dark:text-slate-200">
               ¿Eliminar el curso
               <span class="font-semibold">{{ cursoAEliminar?.nombre }}</span
               >?
               <template v-if="!(cursoAEliminar?.cantidadParalelos && esAdministrador)">
                  Solo es posible si no tiene paralelos asociados.
               </template>
            </p>
         </div>
      </ConfirmModal>
   </div>
</template>
