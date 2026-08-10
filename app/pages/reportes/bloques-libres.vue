<script setup lang="ts">
definePageMeta({ layout: 'default' })

const HORARIOS_BLOQUES = [
   '08:00–08:35',
   '08:35–09:10',
   '09:40–10:15',
   '10:15–10:50',
   '11:05–11:40',
   '11:40–12:15',
   '12:30–13:05',
   '13:05–13:40',
   '14:30–15:05',
   '15:05–15:40',
   '16:05–16:40',
   '16:40–17:15',
   '17:30–18:05',
   '18:05–18:40',
] as const

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
const CANT_BLOQUES = 14
const CANT_DIAS = 5
const FILA_COMIENZO_LISTA = 8
const SIGA_COL_RUT = 3
const SIGA_COL_DV = 4
const COL_RUT = 0
const COL_NOMBRES = 1
const COL_APELLIDO_PAT = 2
const COL_APELLIDO_MAT = 3
const COL_SIGLA = 25
const COL_NOMBRE_ASIG = 26
const COL_PARALELO = 27
const COL_DIA = 38
const COL_BLOQUE_INICIO = 39
const COL_BLOQUE_FIN = 41

interface EstudianteDetalle {
   rut: string
   nombres: string
   apellidoPaterno: string
   apellidoMaterno: string
   asignaturas: string[]
}

interface ResultadoBloques {
   horario: number[][]
   detalle: EstudianteDetalle[][][]
   dias: string[]
   cursos: string[]
   cantEstudiantes: number
}

const inputDirest = ref<HTMLInputElement | null>(null)
const inputLista = ref<HTMLInputElement | null>(null)
const direstArchivo = ref<File | null>(null)
const listasArchivos = ref<File[]>([])
const colacionDisponible = ref(false)

const cargando = ref(false)
const error = ref<string | null>(null)
const resultado = ref<ResultadoBloques | null>(null)

function seleccionarDirest(e: Event) {
   const input = e.target as HTMLInputElement
   direstArchivo.value = input.files?.[0] ?? null
}

function agregarLista(e: Event) {
   const input = e.target as HTMLInputElement
   if (!input.files) return
   for (const f of Array.from(input.files)) {
      if (!listasArchivos.value.some(ex => ex.name === f.name)) {
         listasArchivos.value.push(f)
      }
   }
   input.value = ''
}

function quitarLista(idx: number) {
   listasArchivos.value.splice(idx, 1)
}

const puedeCalcular = computed(() => !!direstArchivo.value && listasArchivos.value.length > 0)

function getDato(fila: string[], col: number): string {
   if (fila.length <= col) return ''
   const val = fila[col]
   return val !== undefined ? val.replace(/"/g, '').trim() : ''
}

async function leerEstudiantesDeExcel(file: File): Promise<string[]> {
   const XLSX = await import('xlsx')
   const buffer = await file.arrayBuffer()
   const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
   const sheetName = wb.SheetNames[0]
   if (!sheetName) return []
   const ws = wb.Sheets[sheetName]
   if (!ws) return []

   const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
   }) as (unknown[] | null)[]

   const ruts: string[] = []
   for (let i = FILA_COMIENZO_LISTA; i < rows.length; i++) {
      const row = rows[i]
      if (!Array.isArray(row)) continue
      const rutRaw = row[SIGA_COL_RUT]
      const dvRaw = row[SIGA_COL_DV]
      if (rutRaw == null || dvRaw == null) continue
      const rut = String(rutRaw).trim().toUpperCase() + '-' + String(dvRaw).trim().toUpperCase()
      if (rut.length > 2) ruts.push(rut)
   }
   return ruts
}

async function calcular() {
   if (!puedeCalcular.value) return
   cargando.value = true
   error.value = null
   resultado.value = null

   try {
      const estudiantes = new Set<string>()
      const cursos: string[] = []

      for (const archivo of listasArchivos.value) {
         cursos.push(archivo.name)
         const ruts = await leerEstudiantesDeExcel(archivo)
         ruts.forEach(r => estudiantes.add(r))
      }

      if (estudiantes.size === 0) {
         error.value = 'No se encontraron estudiantes en las listas. Verifica que los archivos sean listas SIGA válidas.'
         return
      }

      // Cada celda: Map<rut, EstudianteDetalle> para contar únicos y guardar detalle
      const detalleMap: Map<string, EstudianteDetalle>[][] = Array.from(
         { length: CANT_BLOQUES },
         () => Array.from({ length: CANT_DIAS }, () => new Map<string, EstudianteDetalle>()),
      )

      const csvText = await direstArchivo.value!.text()
      const lineas = csvText.split(/\r?\n/).slice(1)

      for (const linea of lineas) {
         if (!linea.trim()) continue
         const datos = linea.split(';')
         const rut = getDato(datos, COL_RUT).toUpperCase()
         if (!estudiantes.has(rut)) continue

         const diaStr = getDato(datos, COL_DIA).charAt(0)
         const inicioStr = getDato(datos, COL_BLOQUE_INICIO)
         const finStr = getDato(datos, COL_BLOQUE_FIN)
         if (!diaStr || !inicioStr || !finStr) continue

         const dia = parseInt(diaStr)
         const inicio = parseInt(inicioStr)
         const fin = parseInt(finStr)
         if (isNaN(dia) || isNaN(inicio) || isNaN(fin) || dia < 1 || dia > 5) continue

         const sigla = getDato(datos, COL_SIGLA)
         const nombreAsig = getDato(datos, COL_NOMBRE_ASIG)
         const paralelo = getDato(datos, COL_PARALELO)
         const asig = sigla ? `${sigla} (${paralelo}) — ${nombreAsig}` : nombreAsig

         for (let b = inicio - 1; b < fin; b++) {
            if (b < 0 || b >= CANT_BLOQUES) continue
            const celda = detalleMap[b]?.[dia - 1]
            if (!celda) continue
            const existente = celda.get(rut)
            if (existente) {
               if (!existente.asignaturas.includes(asig)) existente.asignaturas.push(asig)
            } else {
               celda.set(rut, {
                  rut,
                  nombres: getDato(datos, COL_NOMBRES),
                  apellidoPaterno: getDato(datos, COL_APELLIDO_PAT),
                  apellidoMaterno: getDato(datos, COL_APELLIDO_MAT),
                  asignaturas: [asig],
               })
            }
         }
      }

      const horario = detalleMap.map(fila => fila.map(celda => celda.size))
      const detalle = detalleMap.map(fila => fila.map(celda => Array.from(celda.values())))

      resultado.value = {
         horario,
         detalle,
         dias: DIAS_SEMANA,
         cursos,
         cantEstudiantes: estudiantes.size,
      }
   } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Error al procesar los archivos.'
   } finally {
      cargando.value = false
   }
}

type EstadoCelda = 'libre' | 'colacion' | 'ocupado'

function conteoCelda(bloqueIdx: number, diaIdx: number): number {
   return resultado.value?.horario[bloqueIdx]?.[diaIdx] ?? 0
}

function estadoCelda(bloqueIdx: number, diaIdx: number): EstadoCelda {
   if (!resultado.value) return 'ocupado'
   if (conteoCelda(bloqueIdx, diaIdx) > 0) return 'ocupado'
   const esColacion = !colacionDisponible.value && (bloqueIdx === 6 || bloqueIdx === 7) && (diaIdx === 1 || diaIdx === 3)
   return esColacion ? 'colacion' : 'libre'
}

// --- Modal ---

const modalAbierto = ref(false)
const celdaModal = ref<{ bloqueIdx: number; diaIdx: number } | null>(null)

const tituloModal = computed(() => {
   if (!celdaModal.value || !resultado.value) return ''
   const { bloqueIdx, diaIdx } = celdaModal.value
   const dia = resultado.value.dias[diaIdx] ?? ''
   const horario = HORARIOS_BLOQUES[bloqueIdx] ?? ''
   return `Bloque ${bloqueIdx + 1} — ${dia} (${horario})`
})

const estudiantesModal = computed((): EstudianteDetalle[] => {
   if (!celdaModal.value || !resultado.value) return []
   const { bloqueIdx, diaIdx } = celdaModal.value
   return resultado.value.detalle[bloqueIdx]?.[diaIdx] ?? []
})

function rutsCelda(bloqueIdx: number, diaIdx: number): string {
   return (resultado.value?.detalle[bloqueIdx]?.[diaIdx] ?? []).map(e => e.rut).join(', ')
}

function abrirModal(bloqueIdx: number, diaIdx: number) {
   celdaModal.value = { bloqueIdx, diaIdx }
   modalAbierto.value = true
}
</script>

<template>
   <div>
      <div class="p-6 overflow-hidden rounded-2xl border border-default bg-default">
         <div class="flex items-center gap-4 mb-8">
               <div class="w-12 h-12 rounded-xl bg-usm-green-50 dark:bg-usm-green-950 flex items-center justify-center shrink-0">
                  <UIcon name="i-heroicons-calendar-days-16-solid" class="w-6 h-6 text-usm-green-700 dark:text-usm-green-400" />
               </div>
               <div>
                  <p class="text-usm-text-muted dark:text-slate-400 text-sm">Disponibilidad horaria común de un grupo de estudiantes</p>
               </div>
            </div>

         <!-- Dos columnas en desktop -->
         <div class="lg:grid lg:grid-cols-[380px_1fr] lg:gap-8 lg:items-start">
            <!-- Controles -->
            <div>
            <div class="grid gap-4 mb-6">
               <!-- Direst file -->
               <UCard class="border border-default">
                  <p class="font-semibold text-usm-text dark:text-slate-100 text-sm">Reporte Direst (CSV)</p>
                  <p class="text-usm-text-muted dark:text-slate-400 text-xs mt-0.5">
                     Archivo <span class="font-mono">Direst_050_TU.csv</span> con carga horaria de todos los estudiantes
                  </p>
                  <div class="flex items-center justify-between gap-2 mt-3">
                     <span v-if="direstArchivo" class="text-xs text-usm-text-muted dark:text-slate-400 truncate font-mono">
                        {{ direstArchivo.name }}
                     </span>
                     <span v-else />
                     <input ref="inputDirest" type="file" accept=".csv" class="hidden" @change="seleccionarDirest" />
                     <UButton size="sm" color="primary" :variant="direstArchivo ? 'soft' : 'solid'"
                        :icon="direstArchivo ? 'i-heroicons-check-16-solid' : 'i-heroicons-arrow-up-tray-16-solid'"
                        :class="!direstArchivo ? 'text-white' : ''" class="shrink-0" @click="inputDirest?.click()">
                        {{ direstArchivo ? 'Cambiar' : 'Seleccionar' }}
                     </UButton>
                  </div>
               </UCard>

               <!-- Course lists -->
               <UCard class="border border-default">
                  <p class="font-semibold text-usm-text dark:text-slate-100 text-sm">Listas de curso (XLS / XLSX)</p>
                  <p class="text-usm-text-muted dark:text-slate-400 text-xs mt-0.5">Una o más listas de estudiantes exportadas desde SIGA</p>
                  <div class="flex items-center justify-end mt-3 mb-3">
                     <input ref="inputLista" type="file" accept=".xls,.xlsx" multiple class="hidden"
                        @change="agregarLista" />
                     <UButton size="sm" variant="soft" color="primary" icon="i-heroicons-plus-16-solid"
                        @click="inputLista?.click()">
                        Agregar lista
                     </UButton>
                  </div>

                  <div v-if="listasArchivos.length > 0" class="flex flex-col gap-1.5">
                     <div v-for="(archivo, idx) in listasArchivos" :key="archivo.name"
                        class="flex items-center justify-between px-3 py-2 rounded-lg bg-usm-gray-50 dark:bg-slate-700 border border-usm-gray-200 dark:border-slate-600">
                        <div class="flex items-center gap-2 min-w-0">
                           <UIcon name="i-heroicons-document-16-solid" class="w-4 h-4 text-usm-gray-400 shrink-0" />
                           <span class="text-sm text-usm-text dark:text-slate-200 truncate font-mono">{{ archivo.name }}</span>
                        </div>
                        <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-x-mark-16-solid"
                           class="shrink-0 ml-2" @click="quitarLista(idx)" />
                     </div>
                  </div>
                  <p v-else class="text-sm text-usm-text-muted dark:text-slate-400 text-center py-1">Sin listas agregadas</p>
               </UCard>

               <!-- Colacion toggle -->
               <UCard class="border border-default">
                  <p class="font-semibold text-usm-text dark:text-slate-100 text-sm">Bloques protegidos (Mar/Jue, Bloques 7–8)</p>
                  <p class="text-usm-text-muted dark:text-slate-400 text-xs mt-0.5">
                     Bloques 7 y 8 del martes y jueves — por defecto marcados como no disponibles
                  </p>
                  <div class="flex items-center gap-3 mt-3">
                     <span class="text-xs font-medium"
                        :class="colacionDisponible ? 'text-usm-yellow-700 dark:text-usm-yellow-400' : 'text-usm-text-muted dark:text-slate-400'">
                        {{ colacionDisponible ? 'Disponibles' : 'No disponibles' }}
                     </span>
                     <USwitch v-model="colacionDisponible" color="warning" class="switch-light" />
                  </div>
               </UCard>
            </div>

            <UAlert v-if="error" color="error" variant="soft" icon="i-heroicons-exclamation-circle-16-solid"
               title="Error al procesar" :description="error" class="mb-4" />

            <UButton block size="lg" color="success" :disabled="!puedeCalcular" :loading="cargando"
               icon="i-heroicons-sparkles-16-solid" class="text-usm-green-950!" @click="calcular">
               Calcular bloques libres
            </UButton>
            </div>

            <!-- Resultados -->
            <div v-if="resultado" class="mt-8 lg:mt-0">
               <div class="flex flex-wrap items-center gap-2 mb-5">
                  <UBadge color="success" variant="solid" class="text-usm-green-950!">
                     {{ resultado.cantEstudiantes }} estudiantes
                  </UBadge>
                  <UBadge v-for="curso in resultado.cursos" :key="curso" color="primary" variant="solid"
                     class="text-white">
                     {{ curso }}
                  </UBadge>
               </div>

               <div class="flex flex-wrap gap-4 mb-4 text-xs text-usm-text-muted dark:text-slate-400">
                  <div class="flex items-center gap-1.5">
                     <div class="w-3.5 h-3.5 rounded bg-usm-green-200 dark:bg-usm-green-900 border border-usm-green-400 dark:border-usm-green-700"></div>
                     Libre
                  </div>
                  <div class="flex items-center gap-1.5">
                     <div class="w-3.5 h-3.5 rounded bg-usm-yellow-100 dark:bg-usm-yellow-950 border border-usm-yellow-300 dark:border-usm-yellow-800"></div>
                     Protegidos
                  </div>
                  <div class="flex items-center gap-1.5">
                     <div class="w-3.5 h-3.5 rounded bg-usm-gray-200 dark:bg-slate-600 border border-usm-gray-300 dark:border-slate-500"></div>
                     Ocupado
                  </div>
               </div>

               <div class="overflow-x-auto rounded-xl border border-usm-border dark:border-slate-700 shadow-sm">
                  <table class="w-full text-sm border-collapse">
                     <thead>
                        <tr class="bg-usm-blue text-white">
                           <th class="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide w-36">
                              Bloque
                           </th>
                           <th v-for="dia in resultado.dias" :key="dia"
                              class="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wide">
                              {{ dia }}
                           </th>
                        </tr>
                     </thead>
                     <tbody>
                        <template v-for="b in CANT_BLOQUES" :key="b">
                           <tr v-if="b === 9" class="border-t-2 border-usm-blue-200 dark:border-usm-blue-800 bg-usm-blue-50 dark:bg-usm-blue-950">
                              <td :colspan="1 + resultado.dias.length"
                                 class="px-4 py-2 text-center text-xs font-semibold text-usm-blue-600 dark:text-usm-blue-300 tracking-wide uppercase">
                                 — Receso de Almuerzo —
                              </td>
                           </tr>
                           <tr class="border-t border-usm-border dark:border-slate-700" :class="b % 2 === 0 ? 'bg-usm-gray-50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-900'">
                              <td class="px-4 py-2.5">
                                 <div class="font-semibold text-usm-text dark:text-slate-200 text-xs">Bloque {{ b }}</div>
                                 <div class="text-usm-text-muted dark:text-slate-400 text-xs font-mono mt-0.5">{{ HORARIOS_BLOQUES[b - 1] }}
                                 </div>
                              </td>
                              <td v-for="(_, d) in resultado.dias" :key="d" class="px-2 py-2 text-center">
                                 <UTooltip :text="rutsCelda(b - 1, d)" :disabled="estadoCelda(b - 1, d) !== 'ocupado'">
                                    <div
                                       class="mx-auto w-full max-w-24 rounded-lg py-1.5 flex items-center justify-center"
                                       :class="{
                                          'bg-usm-green-100 dark:bg-usm-green-950 border border-usm-green-300 dark:border-usm-green-800 text-usm-green-700 dark:text-usm-green-400': estadoCelda(b - 1, d) === 'libre',
                                          'bg-usm-yellow-50 dark:bg-usm-yellow-950 border border-usm-yellow-300 dark:border-usm-yellow-800 text-usm-yellow-700 dark:text-usm-yellow-400': estadoCelda(b - 1, d) === 'colacion',
                                          'bg-usm-gray-100 dark:bg-slate-700 border border-usm-gray-200 dark:border-slate-600 text-usm-gray-600 dark:text-slate-300 cursor-pointer hover:bg-usm-gray-200 dark:hover:bg-slate-600 transition-colors': estadoCelda(b - 1, d) === 'ocupado',
                                       }" @click="estadoCelda(b - 1, d) === 'ocupado' && abrirModal(b - 1, d)">
                                       <UIcon v-if="estadoCelda(b - 1, d) === 'libre'" name="i-heroicons-check-16-solid"
                                          class="w-4 h-4" />
                                       <UIcon v-else-if="estadoCelda(b - 1, d) === 'colacion'"
                                          name="i-heroicons-lock-closed-16-solid" class="w-3.5 h-3.5" />
                                       <span v-else class="text-xs font-semibold tabular-nums leading-none">{{
                                          conteoCelda(b -
                                             1, d) }}</span>
                                    </div>
                                 </UTooltip>
                              </td>
                           </tr>
                        </template>
                     </tbody>
                  </table>
               </div>
            </div>
         </div>

         <!-- Modal detalle de bloque ocupado -->
            <UModal v-model:open="modalAbierto" :title="tituloModal"
               :ui="{ content: 'sm:max-w-4xl', header: 'border-b border-default', title: 'text-usm-blue dark:text-usm-cyan font-semibold', footer: 'justify-end border-t border-default' }">
               <template #body>
                  <div v-if="estudiantesModal.length === 0" class="py-6 text-center text-usm-text-muted text-sm">
                     Sin datos
                  </div>
                  <div v-else class="overflow-x-auto">
                     <table class="w-full text-xs border-collapse">
                        <thead>
                           <tr class="border-b border-usm-border dark:border-slate-700">
                              <th
                                 class="py-2 px-3 text-left text-xs font-semibold text-usm-text-muted dark:text-slate-400 uppercase tracking-wide">
                                 RUT</th>
                              <th
                                 class="py-2 px-3 text-left text-xs font-semibold text-usm-text-muted dark:text-slate-400 uppercase tracking-wide">
                                 Nombre</th>
                              <th
                                 class="py-2 px-3 text-left text-xs font-semibold text-usm-text-muted dark:text-slate-400 uppercase tracking-wide">
                                 Asignatura</th>
                           </tr>
                        </thead>
                        <tbody>
                           <tr v-for="est in estudiantesModal" :key="est.rut"
                              class="border-b border-usm-border dark:border-slate-700 last:border-0 hover:bg-usm-gray-50 dark:hover:bg-slate-700">
                              <td class="py-2.5 px-3 font-mono text-xs text-usm-text dark:text-slate-200 whitespace-nowrap">{{ est.rut }}
                              </td>
                              <td class="py-2.5 px-3 text-xs text-usm-text dark:text-slate-200 whitespace-nowrap">
                                 {{ est.apellidoPaterno }} {{ est.apellidoMaterno }}, {{ est.nombres }}
                              </td>
                              <td class="py-2.5 px-3 text-xs text-usm-text dark:text-slate-200">
                                 <div v-for="asig in est.asignaturas" :key="asig">{{ asig }}</div>
                              </td>
                           </tr>
                        </tbody>
                     </table>
                  </div>
               </template>
               <template #footer>
                  <UButton color="primary" class="text-white" @click="() => { modalAbierto = false }">Cerrar</UButton>
               </template>
            </UModal>
      </div>
   </div>
</template>
