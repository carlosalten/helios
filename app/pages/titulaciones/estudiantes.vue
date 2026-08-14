<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TtEstudiante, TtGrupo, TtProceso, ResultadoCargaMasivaEstudiantes } from '~/types/titulaciones'

const toast = useToast()

const [{ data: estudiantes, status, refresh }, { data: procesos }, { data: grupos }] = await Promise.all([
   useFetch<TtEstudiante[]>('/api/titulaciones/estudiantes'),
   useFetch<TtProceso[]>('/api/titulaciones/procesos'),
   useFetch<TtGrupo[]>('/api/titulaciones/grupos'),
])

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/titulaciones/estudiantes')

const busqueda = ref('')
const procesoFiltro = ref<number | '__todos__'>('__todos__')

const estudiantesFiltrados = computed(() => {
   let lista = estudiantes.value ?? []
   if (procesoFiltro.value !== '__todos__') {
      lista = lista.filter((e) => e.procesoId === procesoFiltro.value)
   }
   if (busqueda.value.trim()) {
      const q = normalizarTexto(busqueda.value)
      lista = lista.filter(
         (e) =>
            normalizarTexto(e.nombres).includes(q) ||
            normalizarTexto(e.apellidoPaterno).includes(q) ||
            normalizarTexto(e.apellidoMaterno).includes(q) ||
            normalizarTexto(e.email).includes(q) ||
            normalizarTexto(e.run).includes(q)
      )
   }
   return lista
})

const { paginaActual, itemsPagina: estudiantesPagina, porPagina } = usePaginacion(estudiantesFiltrados)

const columnas: TableColumn<TtEstudiante>[] = [
   { accessorKey: 'nombres', header: 'Nombres' },
   { id: 'apellidos', header: 'Apellidos' },
   { accessorKey: 'email', header: 'Email' },
   { accessorKey: 'run', header: 'RUN', size: 110 },
   { id: 'proceso', header: 'Proceso', size: 100 },
   { id: 'grupo', header: 'Grupo', size: 120 },
   { id: 'acciones', header: '', size: 80 },
]

const itemsProceso = computed(() => (procesos.value ?? []).map((p) => ({ label: String(p.anio), value: p.id })))
const itemsProcesoFiltro = computed(() => [
   { label: 'Todos los procesos', value: '__todos__' as const },
   ...itemsProceso.value,
])
// Sentinel 0 = "Sin grupo" (ningún id autoincrement real es 0): se convierte a null antes de
// mandarlo al backend.
const itemsGrupo = computed(() => [
   { label: 'Sin grupo', value: 0 },
   ...(grupos.value ?? []).map((g) => ({ label: g.nombre, value: g.id })),
])

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({
   email: '',
   run: '',
   password: '',
   nombres: '',
   apellidoPaterno: '',
   apellidoMaterno: '',
   procesoId: 0,
   grupoId: 0,
})
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)
const errorGuardarEmail = computed(() => (errorGuardar.value?.includes('email') ? errorGuardar.value : undefined))
const errorGuardarRun = computed(() => (errorGuardar.value?.includes('RUN') ? errorGuardar.value : undefined))
const errorGuardarPassword = computed(() =>
   errorGuardar.value?.includes('ontraseña') ? errorGuardar.value : undefined
)
const errorGuardarResto = computed(() =>
   errorGuardar.value && !errorGuardarEmail.value && !errorGuardarRun.value && !errorGuardarPassword.value
      ? errorGuardar.value
      : undefined
)

function abrirCrear() {
   formCrear.email = ''
   formCrear.run = ''
   formCrear.password = ''
   formCrear.nombres = ''
   formCrear.apellidoPaterno = ''
   formCrear.apellidoMaterno = ''
   formCrear.procesoId = procesos.value?.[0]?.id ?? 0
   formCrear.grupoId = 0
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/titulaciones/estudiantes', {
         method: 'POST',
         body: {
            email: formCrear.email,
            run: formCrear.run,
            password: formCrear.password,
            nombres: formCrear.nombres,
            apellidoPaterno: formCrear.apellidoPaterno,
            apellidoMaterno: formCrear.apellidoMaterno,
            procesoId: Number(formCrear.procesoId),
            grupoId: formCrear.grupoId ? Number(formCrear.grupoId) : null,
         },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Estudiante agregado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const estudianteEditar = ref<TtEstudiante | null>(null)
const formEditar = reactive({
   run: '',
   password: '',
   nombres: '',
   apellidoPaterno: '',
   apellidoMaterno: '',
   procesoId: 0,
   grupoId: 0,
})
const errorEditar = ref<string | null>(null)
const errorEditarRun = computed(() => (errorEditar.value?.includes('RUN') ? errorEditar.value : undefined))
const errorEditarPassword = computed(() => (errorEditar.value?.includes('ontraseña') ? errorEditar.value : undefined))
const errorEditarResto = computed(() =>
   errorEditar.value && !errorEditarRun.value && !errorEditarPassword.value ? errorEditar.value : undefined
)

function abrirEditar(estudiante: TtEstudiante) {
   estudianteEditar.value = estudiante
   formEditar.run = estudiante.run
   formEditar.password = ''
   formEditar.nombres = estudiante.nombres
   formEditar.apellidoPaterno = estudiante.apellidoPaterno
   formEditar.apellidoMaterno = estudiante.apellidoMaterno
   formEditar.procesoId = estudiante.procesoId
   formEditar.grupoId = estudiante.grupoId ?? 0
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!estudianteEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/titulaciones/estudiantes/${encodeURIComponent(estudianteEditar.value.email)}`
      await $fetch(url, {
         method: 'PATCH',
         body: {
            run: formEditar.run,
            // Vacío: no se manda, así el backend conserva la contraseña actual.
            password: formEditar.password ? formEditar.password : undefined,
            nombres: formEditar.nombres,
            apellidoPaterno: formEditar.apellidoPaterno,
            apellidoMaterno: formEditar.apellidoMaterno,
            procesoId: Number(formEditar.procesoId),
            grupoId: formEditar.grupoId ? Number(formEditar.grupoId) : null,
         },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Estudiante actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const estudianteAEliminar = ref<TtEstudiante | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(estudiante: TtEstudiante) {
   estudianteAEliminar.value = estudiante
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!estudianteAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/titulaciones/estudiantes/${encodeURIComponent(estudianteAEliminar.value.email)}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Estudiante eliminado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al eliminar'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      eliminando.value = false
   }
}

/* ── Carga masiva (Excel) ────────────────────────────────────
   Los archivos se parsean en el browser (mismo criterio que los reportes de /reportes, ver
   app/pages/reportes/bloques-libres.vue) y se manda al backend solo la lista de estudiantes ya
   extraída — la creación en sí (validación fina, duplicados, contraseña) vive en
   POST /api/titulaciones/estudiantes/carga-masiva. */
interface FilaExcel {
   run: string
   apellidoPaterno: string
   apellidoMaterno: string
   nombres: string
   email: string
   archivo: string
   fila: number
}

// Los datos empiezan en la fila 10 de Excel (1-indexada) → índice 9 en el arreglo 0-indexado
// que entrega `sheet_to_json`. Columnas también 0-indexadas: D/E/F/G/H/K de Excel.
const FILA_INICIO_EXCEL = 9
const COL_RUN_DIGITOS = 3
const COL_RUN_DV = 4
const COL_APELLIDO_PATERNO = 5
const COL_APELLIDO_MATERNO = 6
const COL_NOMBRES = 7
const COL_EMAIL = 10

function celda(fila: unknown[], col: number): string {
   const valor = fila[col]
   return valor == null ? '' : String(valor).trim()
}

async function leerFilasDeExcel(file: File): Promise<FilaExcel[]> {
   const XLSX = await import('xlsx')
   const buffer = await file.arrayBuffer()
   const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
   const sheetName = wb.SheetNames[0]
   if (!sheetName) return []
   const ws = wb.Sheets[sheetName]
   if (!ws) return []

   const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })

   const resultado: FilaExcel[] = []
   for (let i = FILA_INICIO_EXCEL; i < filas.length; i++) {
      const fila = filas[i]
      if (!Array.isArray(fila)) continue

      const runDigitos = celda(fila, COL_RUN_DIGITOS)
      const runDv = celda(fila, COL_RUN_DV)
      const apellidoPaterno = celda(fila, COL_APELLIDO_PATERNO)
      const apellidoMaterno = celda(fila, COL_APELLIDO_MATERNO)
      const nombres = celda(fila, COL_NOMBRES)
      const email = celda(fila, COL_EMAIL)

      // Fila vacía (cola del archivo, tras el último estudiante): se ignora en silencio, no se
      // reporta como error.
      if (!runDigitos && !runDv && !apellidoPaterno && !nombres && !email) continue

      resultado.push({
         run: `${runDigitos}-${runDv.toUpperCase()}`,
         apellidoPaterno,
         apellidoMaterno,
         nombres,
         email,
         archivo: file.name,
         fila: i + 1,
      })
   }
   return resultado
}

const modalCargaMasivaMostrar = ref(false)
const procesoCargaId = ref(0)
const archivosCarga = ref<File[]>([])
const inputCargaMasiva = ref<HTMLInputElement | null>(null)
const procesandoCarga = ref(false)
const resultadoCarga = ref<ResultadoCargaMasivaEstudiantes | null>(null)
const puedeProcesarCarga = computed(
   () => !!procesoCargaId.value && archivosCarga.value.length > 0 && !procesandoCarga.value
)

function abrirCargaMasiva() {
   procesoCargaId.value = procesos.value?.[0]?.id ?? 0
   archivosCarga.value = []
   resultadoCarga.value = null
   modalCargaMasivaMostrar.value = true
}

function agregarArchivosCarga(evento: Event) {
   const input = evento.target as HTMLInputElement
   if (!input.files) return
   for (const f of Array.from(input.files)) {
      if (!archivosCarga.value.some((existente) => existente.name === f.name)) archivosCarga.value.push(f)
   }
   input.value = ''
}

function quitarArchivoCarga(indice: number) {
   archivosCarga.value.splice(indice, 1)
}

async function procesarCargaMasiva() {
   if (!puedeProcesarCarga.value) return
   procesandoCarga.value = true
   resultadoCarga.value = null
   try {
      const filas = (await Promise.all(archivosCarga.value.map((f) => leerFilasDeExcel(f)))).flat()
      resultadoCarga.value = await $fetch<ResultadoCargaMasivaEstudiantes>(
         '/api/titulaciones/estudiantes/carga-masiva',
         {
            method: 'POST',
            body: { procesoId: Number(procesoCargaId.value), filas },
         }
      )
      await refresh()
      toast.add({
         title: `${resultadoCarga.value.creados} estudiante${resultadoCarga.value.creados !== 1 ? 's' : ''} creado${resultadoCarga.value.creados !== 1 ? 's' : ''}`,
         color: 'success',
         icon: 'i-lucide-check-circle',
      })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'No se pudo procesar la carga'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      procesandoCarga.value = false
   }
}
</script>

<template>
   <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <div>
            <p class="text-sm text-usm-text-muted dark:text-slate-400">
               Estudiantes registrados en el módulo de titulaciones.
            </p>
         </div>
         <div class="flex gap-2 sm:shrink-0">
            <UButton
               icon="i-lucide-upload"
               variant="subtle"
               color="neutral"
               :disabled="!puedeCrear"
               @click="abrirCargaMasiva"
            >
               Carga masiva
            </UButton>
            <UButton icon="i-lucide-plus" :disabled="!puedeCrear" @click="abrirCrear"> Nuevo estudiante </UButton>
         </div>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
         <UInput
            v-model="busqueda"
            icon="i-lucide-search"
            placeholder="Buscar por nombre, email o RUN…"
            class="sm:w-72"
         />
         <USelect v-model="procesoFiltro" :items="itemsProcesoFiltro" value-key="value" class="sm:w-52" />
         <span class="text-sm text-usm-text-muted dark:text-slate-400">
            {{ estudiantesFiltrados.length }} estudiante{{ estudiantesFiltrados.length !== 1 ? 's' : '' }}
         </span>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!estudiantesFiltrados.length"
            icon="i-lucide-graduation-cap"
            message="No hay estudiantes registrados"
            :action="!busqueda && puedeCrear ? 'Nuevo estudiante' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="estudiantesPagina" :columns="columnas">
            <template #apellidos-cell="{ row }">
               <span class="text-usm-text dark:text-white">
                  {{ row.original.apellidoPaterno }} {{ row.original.apellidoMaterno }}
               </span>
            </template>
            <template #proceso-cell="{ row }">
               <span class="text-usm-text dark:text-white">{{ row.original.proceso.anio }}</span>
            </template>
            <template #grupo-cell="{ row }">
               <span v-if="row.original.grupo" class="text-usm-text dark:text-white">
                  {{ row.original.grupo.nombre }}
               </span>
               <span v-else class="text-usm-text-muted italic dark:text-slate-400">Sin grupo</span>
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

      <div v-if="estudiantesFiltrados.length > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="estudiantesFiltrados.length" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo estudiante" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-estudiante-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Email" name="email" :error="errorGuardarEmail">
                  <UInput v-model="formCrear.email" type="email" placeholder="nombre@alumnos.usm.cl" class="w-full" />
               </UFormField>
               <UFormField label="RUN" name="run" :error="errorGuardarRun" description="Formato: 12345678-9">
                  <UInput v-model="formCrear.run" placeholder="12345678-9" class="w-full" />
               </UFormField>
               <UFormField
                  label="Contraseña"
                  name="password"
                  :error="errorGuardarPassword"
                  description="Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo."
               >
                  <UInput v-model="formCrear.password" type="password" class="w-full" />
               </UFormField>
               <UFormField label="Nombres" name="nombres" :error="errorGuardarResto">
                  <UInput v-model="formCrear.nombres" class="w-full" />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Apellido paterno" name="apellidoPaterno">
                     <UInput v-model="formCrear.apellidoPaterno" class="w-full" />
                  </UFormField>
                  <UFormField label="Apellido materno" name="apellidoMaterno">
                     <UInput v-model="formCrear.apellidoMaterno" class="w-full" />
                  </UFormField>
               </div>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Proceso" name="procesoId">
                     <USelectMenu
                        v-model="formCrear.procesoId"
                        :items="itemsProceso"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
                  <UFormField label="Grupo" name="grupoId">
                     <USelectMenu v-model="formCrear.grupoId" :items="itemsGrupo" value-key="value" class="w-full" />
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
            <UButton type="submit" form="form-estudiante-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal v-model:open="modalEditarMostrar" title="Editar estudiante" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-estudiante-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Email">
                  <UInput :model-value="estudianteEditar?.email" disabled class="w-full" />
               </UFormField>
               <UFormField label="RUN" name="run" :error="errorEditarRun" description="Formato: 12345678-9">
                  <UInput v-model="formEditar.run" class="w-full" />
               </UFormField>
               <UFormField
                  label="Contraseña"
                  name="password"
                  :error="errorEditarPassword"
                  description="Déjalo en blanco para conservar la contraseña actual."
               >
                  <UInput v-model="formEditar.password" type="password" class="w-full" />
               </UFormField>
               <UFormField label="Nombres" name="nombres" :error="errorEditarResto">
                  <UInput v-model="formEditar.nombres" class="w-full" />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Apellido paterno" name="apellidoPaterno">
                     <UInput v-model="formEditar.apellidoPaterno" class="w-full" />
                  </UFormField>
                  <UFormField label="Apellido materno" name="apellidoMaterno">
                     <UInput v-model="formEditar.apellidoMaterno" class="w-full" />
                  </UFormField>
               </div>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Proceso" name="procesoId">
                     <USelectMenu
                        v-model="formEditar.procesoId"
                        :items="itemsProceso"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
                  <UFormField label="Grupo" name="grupoId">
                     <USelectMenu v-model="formEditar.grupoId" :items="itemsGrupo" value-key="value" class="w-full" />
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
            <UButton type="submit" form="form-estudiante-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar estudiante"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar al estudiante
            <span class="font-semibold">{{ estudianteAEliminar?.nombres }}</span
            >? Solo es posible si no tiene propuestas asociadas.
         </p>
      </ConfirmModal>

      <!-- Modal carga masiva -->
      <UModal
         v-model:open="modalCargaMasivaMostrar"
         title="Carga masiva de estudiantes"
         :ui="{ footer: 'justify-end', content: 'max-w-2xl' }"
      >
         <template #body>
            <div class="space-y-4">
               <UAlert
                  icon="i-lucide-info"
                  color="neutral"
                  variant="subtle"
                  title="Formato esperado del Excel"
                  description="Los datos comienzan en la fila 10. RUN en columnas D (dígitos) y E (dígito verificador), apellido paterno en F, apellido materno en G, nombres en H, email en K. Es aditiva: nunca borra lo existente, y un estudiante ya registrado (mismo RUN o email) se omite sin tocarlo."
               />

               <UFormField label="Proceso" name="procesoId">
                  <USelectMenu
                     v-model="procesoCargaId"
                     :items="itemsProceso"
                     value-key="value"
                     class="w-full"
                     :disabled="procesandoCarga"
                  />
               </UFormField>

               <UFormField label="Archivos (XLS / XLSX)" name="archivos">
                  <input
                     ref="inputCargaMasiva"
                     type="file"
                     accept=".xls,.xlsx"
                     multiple
                     class="hidden"
                     @change="agregarArchivosCarga"
                  />
                  <UButton
                     icon="i-lucide-plus"
                     variant="soft"
                     color="neutral"
                     :disabled="procesandoCarga"
                     @click="() => inputCargaMasiva?.click()"
                  >
                     Agregar archivos
                  </UButton>
                  <div v-if="archivosCarga.length" class="mt-2 flex flex-col gap-1.5">
                     <div
                        v-for="(archivo, indice) in archivosCarga"
                        :key="archivo.name"
                        class="flex items-center justify-between rounded-lg border border-default px-3 py-2"
                     >
                        <span class="flex items-center gap-2 truncate text-sm text-usm-text dark:text-white">
                           <UIcon name="i-lucide-file-spreadsheet" class="size-4 shrink-0" />
                           {{ archivo.name }}
                        </span>
                        <UButton
                           icon="i-lucide-x"
                           size="xs"
                           color="neutral"
                           variant="ghost"
                           :disabled="procesandoCarga"
                           aria-label="Quitar"
                           @click="quitarArchivoCarga(indice)"
                        />
                     </div>
                  </div>
                  <p v-else class="mt-2 text-sm text-usm-text-muted dark:text-slate-400">Sin archivos agregados.</p>
               </UFormField>

               <!-- Resultado -->
               <div v-if="resultadoCarga" class="space-y-3 rounded-lg border border-default p-4">
                  <p class="text-sm font-medium text-usm-text dark:text-white">
                     {{ resultadoCarga.creados }} de {{ resultadoCarga.totalFilas }} estudiante{{
                        resultadoCarga.totalFilas !== 1 ? 's' : ''
                     }}
                     creado{{ resultadoCarga.creados !== 1 ? 's' : '' }}
                  </p>
                  <div v-if="resultadoCarga.omitidosExistian.length" class="space-y-1">
                     <p class="text-xs font-medium text-usm-text-muted dark:text-slate-400">
                        Ya existían ({{ resultadoCarga.omitidosExistian.length }})
                     </p>
                     <ul class="max-h-32 space-y-0.5 overflow-y-auto text-xs text-usm-text-muted dark:text-slate-400">
                        <li v-for="(f, i) in resultadoCarga.omitidosExistian" :key="i">
                           {{ f.archivo }} · fila {{ f.fila }} · {{ f.run }} · {{ f.email }}
                        </li>
                     </ul>
                  </div>
                  <div v-if="resultadoCarga.omitidosDuplicadosArchivo.length" class="space-y-1">
                     <p class="text-xs font-medium text-usm-text-muted dark:text-slate-400">
                        Repetidos en los archivos ({{ resultadoCarga.omitidosDuplicadosArchivo.length }})
                     </p>
                     <ul class="max-h-32 space-y-0.5 overflow-y-auto text-xs text-usm-text-muted dark:text-slate-400">
                        <li v-for="(f, i) in resultadoCarga.omitidosDuplicadosArchivo" :key="i">
                           {{ f.archivo }} · fila {{ f.fila }} · {{ f.run }} · {{ f.email }}
                        </li>
                     </ul>
                  </div>
                  <div v-if="resultadoCarga.filasInvalidas.length" class="space-y-1">
                     <p class="text-xs font-medium text-error">
                        Filas con error ({{ resultadoCarga.filasInvalidas.length }})
                     </p>
                     <ul class="max-h-32 space-y-0.5 overflow-y-auto text-xs text-error">
                        <li v-for="(f, i) in resultadoCarga.filasInvalidas" :key="i">
                           {{ f.archivo }} · fila {{ f.fila }} · {{ f.motivo }}
                        </li>
                     </ul>
                  </div>
               </div>
            </div>
         </template>
         <template #footer>
            <UButton
               variant="ghost"
               color="neutral"
               @click="
                  () => {
                     modalCargaMasivaMostrar = false
                  }
               "
               >Cerrar</UButton
            >
            <UButton
               icon="i-lucide-upload"
               :loading="procesandoCarga"
               :disabled="!puedeProcesarCarga"
               @click="procesarCargaMasiva"
            >
               Procesar carga
            </UButton>
         </template>
      </UModal>
   </div>
</template>
