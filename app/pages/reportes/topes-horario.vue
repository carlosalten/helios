<script setup lang="ts">
definePageMeta({ layout: 'default' })

const HORARIOS_BLOQUES = [
   '08:00–08:35', '08:35–09:10', '09:40–10:15', '10:15–10:50',
   '11:05–11:40', '11:40–12:15', '12:30–13:05', '13:05–13:40',
   '14:30–15:05', '15:05–15:40', '16:05–16:40', '16:40–17:15',
   '17:30–18:05', '18:05–18:40',
] as const

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const
const CANT_BLOQUES = 14
const CANT_DIAS = 5

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

interface AsignaturaEnBloque {
   sigla: string
   nombre: string
   paralelo: string
   display: string
}

interface EstudianteConTope {
   rut: string
   nombres: string
   apellidoPaterno: string
   apellidoMaterno: string
   nombreCompleto: string
   horario: AsignaturaEnBloque[][][]
   cantTopes: number
}

const inputDirest = ref<HTMLInputElement | null>(null)
const direstArchivo = ref<File | null>(null)
const cargando = ref(false)
const error = ref<string | null>(null)
const estudiantesConTope = ref<EstudianteConTope[]>([])
const estudianteSeleccionado = ref<EstudianteConTope | null>(null)

function seleccionarDirest(e: Event) {
   const input = e.target as HTMLInputElement
   direstArchivo.value = input.files?.[0] ?? null
   estudiantesConTope.value = []
   estudianteSeleccionado.value = null
   error.value = null
}

function getDato(fila: string[], col: number): string {
   const val = fila[col]
   return val !== undefined ? val.replace(/"/g, '').trim() : ''
}

async function calcular() {
   if (!direstArchivo.value) return
   cargando.value = true
   error.value = null
   estudiantesConTope.value = []
   estudianteSeleccionado.value = null

   try {
      const csvText = await direstArchivo.value.text()
      const lineas = csvText.split(/\r?\n/).slice(1)

      type EntradaMap = {
         info: Omit<EstudianteConTope, 'horario' | 'cantTopes' | 'nombreCompleto'>
         horario: Map<string, AsignaturaEnBloque>[][]
      }

      const horarioMap = new Map<string, EntradaMap>()

      for (const linea of lineas) {
         if (!linea.trim()) continue
         const datos = linea.split(';')
         const rut = getDato(datos, COL_RUT).toUpperCase()
         if (!rut) continue

         const diaChar = getDato(datos, COL_DIA).charAt(0)
         const inicioStr = getDato(datos, COL_BLOQUE_INICIO)
         const finStr = getDato(datos, COL_BLOQUE_FIN)
         if (!diaChar || !inicioStr || !finStr) continue

         const dia = parseInt(diaChar)
         const inicio = parseInt(inicioStr)
         const fin = parseInt(finStr)
         if (isNaN(dia) || isNaN(inicio) || isNaN(fin) || dia < 1 || dia > 5) continue

         const sigla = getDato(datos, COL_SIGLA)
         const nombre = getDato(datos, COL_NOMBRE_ASIG)
         const paralelo = getDato(datos, COL_PARALELO)
         const asigKey = `${sigla}-${paralelo}`
         const display = sigla ? `${sigla} (${paralelo})` : nombre

         if (!horarioMap.has(rut)) {
            horarioMap.set(rut, {
               info: {
                  rut,
                  nombres: getDato(datos, COL_NOMBRES),
                  apellidoPaterno: getDato(datos, COL_APELLIDO_PAT),
                  apellidoMaterno: getDato(datos, COL_APELLIDO_MAT),
               },
               horario: Array.from({ length: CANT_BLOQUES }, () =>
                  Array.from({ length: CANT_DIAS }, () => new Map<string, AsignaturaEnBloque>()),
               ),
            })
         }

         const entrada = horarioMap.get(rut)!
         for (let b = inicio - 1; b < fin && b < CANT_BLOQUES; b++) {
            if (b < 0) continue
            entrada.horario[b]![dia - 1]!.set(asigKey, { sigla, nombre, paralelo, display })
         }
      }

      const resultado: EstudianteConTope[] = []

      for (const [, entrada] of horarioMap) {
         let cantTopes = 0
         const horario: AsignaturaEnBloque[][][] = entrada.horario.map(fila =>
            fila.map(celda => {
               const asigs = Array.from(celda.values())
               if (asigs.length >= 2) cantTopes++
               return asigs
            }),
         )

         if (cantTopes > 0) {
            const { rut, nombres, apellidoPaterno, apellidoMaterno } = entrada.info
            resultado.push({
               rut,
               nombres,
               apellidoPaterno,
               apellidoMaterno,
               nombreCompleto: `${apellidoPaterno} ${apellidoMaterno}, ${nombres}`,
               horario,
               cantTopes,
            })
         }
      }

      resultado.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'))
      estudiantesConTope.value = resultado

      if (resultado.length === 0) {
         error.value = 'No se encontraron topes de horario en el archivo.'
      }
   } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Error al procesar el archivo.'
   } finally {
      cargando.value = false
   }
}

function asignaturasCelda(bloqueIdx: number, diaIdx: number): AsignaturaEnBloque[] {
   return estudianteSeleccionado.value?.horario[bloqueIdx]?.[diaIdx] ?? []
}

function esTope(bloqueIdx: number, diaIdx: number): boolean {
   return asignaturasCelda(bloqueIdx, diaIdx).length >= 2
}

function tieneClase(bloqueIdx: number, diaIdx: number): boolean {
   return asignaturasCelda(bloqueIdx, diaIdx).length >= 1
}

const topesDelSeleccionado = computed(() => {
   const est = estudianteSeleccionado.value
   if (!est) return []
   const lista: { dia: string; diaIdx: number; bloque: number; asignaturas: AsignaturaEnBloque[] }[] = []
   for (let d = 0; d < CANT_DIAS; d++) {
      for (let b = 0; b < CANT_BLOQUES; b++) {
         const asigs = est.horario[b]?.[d] ?? []
         if (asigs.length >= 2) {
            lista.push({ dia: DIAS_SEMANA[d]!, diaIdx: d, bloque: b + 1, asignaturas: asigs })
         }
      }
   }
   return lista
})
</script>

<template>
   <div>
      <!-- Upload section -->
      <div class="overflow-hidden rounded-2xl border border-default bg-default p-6 mb-6">
         <div class="flex items-center gap-4 mb-6">
            <div
               class="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950 flex items-center justify-center shrink-0">
               <UIcon name="i-heroicons-exclamation-triangle-16-solid"
                  class="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
               <p class="text-usm-text-muted dark:text-slate-400 text-sm">Detección de conflictos de horario por
                  estudiante</p>
            </div>
         </div>

         <UCard class="border border-default mb-4">
            <p class="font-semibold text-usm-text dark:text-slate-100 text-sm">Reporte Direst (CSV)</p>
            <p class="text-usm-text-muted dark:text-slate-400 text-xs mt-0.5">
               Archivo <span class="font-mono">Direst_050_*.csv</span> con carga horaria de todos los estudiantes
            </p>
            <div class="flex items-center justify-between mt-3 gap-2">
               <span v-if="direstArchivo"
                  class="text-xs text-usm-text-muted dark:text-slate-400 truncate font-mono min-w-0">
                  {{ direstArchivo.name }}
               </span>
               <span v-else />
               <input ref="inputDirest" type="file" accept=".csv" class="hidden" @change="seleccionarDirest" />
               <UButton size="sm" color="primary" :variant="direstArchivo ? 'soft' : 'solid'"
                  :icon="direstArchivo ? 'i-heroicons-check-16-solid' : 'i-heroicons-arrow-up-tray-16-solid'"
                  :class="!direstArchivo ? 'text-white' : ''" class="shrink-0"
                  @click="inputDirest?.click()">
                  {{ direstArchivo ? 'Cambiar' : 'Seleccionar' }}
               </UButton>
            </div>
         </UCard>

         <UAlert v-if="error" color="error" variant="soft" icon="i-heroicons-exclamation-circle-16-solid"
            title="Sin resultados" :description="error" class="mb-4" />

         <UButton block size="lg" color="error" :disabled="!direstArchivo" :loading="cargando"
            icon="i-heroicons-magnifying-glass-16-solid" @click="calcular">
            Detectar topes de horario
         </UButton>
      </div>

      <!-- Results -->
      <div v-if="estudiantesConTope.length > 0"
         class="lg:grid lg:grid-cols-[360px_1fr] lg:gap-6 lg:items-start">

         <!-- Lista de estudiantes -->
         <div class="overflow-hidden rounded-2xl border border-default bg-default mb-6 lg:mb-0">
            <div class="px-4 py-3 border-b border-default flex items-center justify-between">
               <p class="text-sm font-semibold text-usm-text dark:text-slate-100">Estudiantes con topes</p>
               <UBadge :label="`${estudiantesConTope.length}`" color="error" variant="subtle" />
            </div>
            <ul class="divide-y divide-default overflow-y-auto max-h-[65vh]">
               <li v-for="est in estudiantesConTope" :key="est.rut"
                  class="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors"
                  :class="estudianteSeleccionado?.rut === est.rut
                     ? 'bg-red-50 dark:bg-red-950/30 border-l-2 border-red-500'
                     : 'hover:bg-gray-50 dark:hover:bg-slate-800'"
                  @click="estudianteSeleccionado = est">
                  <div class="min-w-0">
                     <p class="text-sm font-medium text-usm-text dark:text-slate-100 truncate">
                        {{ est.nombreCompleto }}
                     </p>
                     <p class="text-xs text-usm-text-muted dark:text-slate-400 font-mono">{{ est.rut }}</p>
                  </div>
                  <UBadge :label="`${est.cantTopes}`" color="error" variant="soft" class="shrink-0" />
               </li>
            </ul>
         </div>

         <!-- Vista de horario -->
         <div v-if="estudianteSeleccionado"
            class="overflow-hidden rounded-2xl border border-default bg-default p-4 sm:p-5">
            <div class="mb-4">
               <p class="font-semibold text-usm-text dark:text-slate-100">
                  {{ estudianteSeleccionado.nombreCompleto }}
               </p>
               <p class="text-xs font-mono text-usm-text-muted dark:text-slate-400 mt-0.5">
                  {{ estudianteSeleccionado.rut }}
               </p>
            </div>

            <!-- Leyenda -->
            <div class="flex flex-wrap gap-4 mb-4 text-xs text-usm-text-muted dark:text-slate-400">
               <div class="flex items-center gap-1.5">
                  <div
                     class="w-3.5 h-3.5 rounded bg-usm-blue-50 dark:bg-usm-blue-950 border border-usm-blue-300 dark:border-usm-blue-800" />
                  Con clase
               </div>
               <div class="flex items-center gap-1.5">
                  <div
                     class="w-3.5 h-3.5 rounded bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-800" />
                  Tope
               </div>
            </div>

            <!-- Grilla horaria -->
            <div class="overflow-x-auto rounded-xl border border-usm-border dark:border-slate-700 shadow-sm">
               <table class="w-full text-sm border-collapse">
                  <thead>
                     <tr class="bg-usm-blue text-white">
                        <th
                           class="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide w-28 shrink-0">
                           Bloque
                        </th>
                        <th v-for="dia in DIAS_SEMANA" :key="dia"
                           class="px-2 py-2.5 text-center font-semibold text-xs uppercase tracking-wide">
                           <span class="hidden sm:inline">{{ dia }}</span>
                           <span class="sm:hidden">{{ dia.slice(0, 3) }}</span>
                        </th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr v-for="b in CANT_BLOQUES" :key="b"
                        class="border-t border-usm-border dark:border-slate-700"
                        :class="b % 2 === 0 ? 'bg-usm-gray-50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-900'">
                        <td class="px-3 py-2 shrink-0">
                           <div class="font-semibold text-usm-text dark:text-slate-200 text-xs">Bloque {{ b }}</div>
                           <div class="text-usm-text-muted dark:text-slate-400 text-xs font-mono mt-0.5 hidden sm:block">
                              {{ HORARIOS_BLOQUES[b - 1] }}
                           </div>
                        </td>
                        <td v-for="(_, d) in DIAS_SEMANA" :key="d" class="px-1 py-1.5 text-center">
                           <UTooltip
                              :text="asignaturasCelda(b - 1, d).map(a => a.display).join(' | ')"
                              :disabled="!tieneClase(b - 1, d)">
                              <div
                                 class="mx-auto w-full rounded-md py-1 px-0.5 min-h-7 flex items-center justify-center"
                                 :class="{
                                    'bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300': esTope(b - 1, d),
                                    'bg-usm-blue-50 dark:bg-usm-blue-950 border border-usm-blue-200 dark:border-usm-blue-800 text-usm-blue-700 dark:text-usm-blue-300': tieneClase(b - 1, d) && !esTope(b - 1, d),
                                    'bg-transparent': !tieneClase(b - 1, d),
                                 }">
                                 <span v-if="esTope(b - 1, d)"
                                    class="text-xs font-bold leading-none">
                                    ×{{ asignaturasCelda(b - 1, d).length }}
                                 </span>
                                 <span v-else-if="tieneClase(b - 1, d)"
                                    class="text-xs leading-none font-mono truncate max-w-full px-0.5">
                                    {{ asignaturasCelda(b - 1, d)[0]?.sigla ?? '' }}
                                 </span>
                              </div>
                           </UTooltip>
                        </td>
                     </tr>
                  </tbody>
               </table>
            </div>

            <!-- Detalle de topes -->
            <div v-if="topesDelSeleccionado.length > 0" class="mt-5 space-y-2.5">
               <p class="text-sm font-semibold text-usm-text dark:text-slate-100">
                  {{ topesDelSeleccionado.length }} tope{{ topesDelSeleccionado.length > 1 ? 's' : '' }} detectado{{ topesDelSeleccionado.length > 1 ? 's' : '' }}
               </p>
               <div v-for="tope in topesDelSeleccionado" :key="`${tope.diaIdx}-${tope.bloque}`"
                  class="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
                  <p class="text-xs font-semibold text-red-700 dark:text-red-400 mb-1.5">
                     {{ tope.dia }} — Bloque {{ tope.bloque }}
                     <span class="font-mono font-normal">({{ HORARIOS_BLOQUES[tope.bloque - 1] }})</span>
                  </p>
                  <ul class="space-y-0.5">
                     <li v-for="asig in tope.asignaturas" :key="asig.sigla + asig.paralelo"
                        class="text-xs text-usm-text dark:text-slate-200">
                        <span class="font-mono font-semibold">{{ asig.sigla }}</span>
                        <span class="text-usm-text-muted dark:text-slate-400"> ({{ asig.paralelo }}) — {{
                           asig.nombre }}</span>
                     </li>
                  </ul>
               </div>
            </div>
         </div>

         <!-- Placeholder escritorio sin selección -->
         <div v-else class="hidden lg:block">
            <EmptyState icon="i-heroicons-cursor-arrow-ripple" message="Selecciona un estudiante para ver su horario" />
         </div>
      </div>
   </div>
</template>
