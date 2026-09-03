<script setup lang="ts">
import type { Plan } from '~/types/plan'
import type { Semestre } from '~/types/semestre'
import type { ReporteCargaMasiva, ResultadoCargaMasiva } from '~/types/cargaMasiva'

definePageMeta({ layout: 'default' })

const toast = useToast()
const { puedeCrear } = usePermiso('/cursos/carga-masiva')

// Se reusa el selector de planes de /cursos: trae ya acotados los planes sobre los que el
// usuario puede crear o borrar cursos, que es exactamente lo que hace esta carga.
const { data: planes } = await useFetch<Plan[]>('/api/cursos/planes', { default: () => [] })
const { data: semestres } = await useFetch<Semestre[]>('/api/semestres', { default: () => [] })

const planId = ref<number | undefined>()
const semestreId = ref<number | undefined>()
const archivo = ref<File | null>(null)
const inputArchivo = ref<HTMLInputElement | null>(null)

const csv = ref('')
const reporte = ref<ReporteCargaMasiva | null>(null)
const resultado = ref<ResultadoCargaMasiva | null>(null)
const validando = ref(false)
const cargando = ref(false)
const confirmarAbierto = ref(false)

const opcionesPlan = computed(() =>
   planes.value.map((plan) => ({
      label: `${plan.carrera.nombre} · Plan N° ${plan.numero}${plan.vigente ? ' (vigente)' : ''}`,
      value: plan.id,
   }))
)

const opcionesSemestre = computed(() =>
   semestres.value.map((semestre) => ({
      label: `${semestre.nombre}${semestre.vigente ? ' (vigente)' : ''}`,
      value: semestre.id,
   }))
)

const planSeleccionado = computed(() => planes.value.find((plan) => plan.id === planId.value) ?? null)
const semestreSeleccionado = computed(() => semestres.value.find((s) => s.id === semestreId.value) ?? null)
const destinoListo = computed(() => planId.value !== undefined && semestreId.value !== undefined)
const hayErrores = computed(() => (reporte.value?.errores.length ?? 0) > 0)
const puedeCargar = computed(() => puedeCrear.value && reporte.value !== null && !hayErrores.value)

// Cambiar el destino invalida el análisis anterior: el mismo archivo da otro resultado contra
// otro plan o semestre, así que se vuelve a validar con lo que ya está cargado en memoria.
watch([planId, semestreId], () => {
   resultado.value = null
   if (csv.value) void validar()
   else reporte.value = null
})

// El export institucional no siempre viene en UTF-8; si no decodifica, se reintenta con
// Windows-1252, que es lo que produce Excel en español.
async function leerTexto(file: File) {
   const buffer = await file.arrayBuffer()
   try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
   } catch {
      return new TextDecoder('windows-1252').decode(buffer)
   }
}

async function seleccionarArchivo(evento: Event) {
   const input = evento.target as HTMLInputElement
   const file = input.files?.[0]
   if (!file) return

   archivo.value = file
   csv.value = await leerTexto(file)
   resultado.value = null
   input.value = ''
   await validar()
}

function limpiar() {
   archivo.value = null
   csv.value = ''
   reporte.value = null
   resultado.value = null
}

async function validar() {
   if (!destinoListo.value || !csv.value) return
   validando.value = true
   try {
      reporte.value = await $fetch<ReporteCargaMasiva>('/api/cursos/carga-masiva/validar', {
         method: 'POST',
         body: { csv: csv.value, planId: planId.value, semestreId: semestreId.value },
      })
   } catch (error) {
      reporte.value = null
      const mensaje = error instanceof Error ? error.message : 'No se pudo analizar el archivo'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      validando.value = false
   }
}

async function cargar() {
   if (!puedeCargar.value) return
   cargando.value = true
   try {
      resultado.value = await $fetch<ResultadoCargaMasiva>('/api/cursos/carga-masiva', {
         method: 'POST',
         body: { csv: csv.value, planId: planId.value, semestreId: semestreId.value },
      })
      reporte.value = null
      confirmarAbierto.value = false
      toast.add({ title: 'Horario cargado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo cargar el horario'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      cargando.value = false
   }
}
</script>

<template>
   <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <div>
            <h2 class="text-lg font-semibold text-usm-text dark:text-white">Carga masiva de horario</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
               Crea los cursos, paralelos, sesiones de clase y reservas de sala de un plan a partir del CSV de
               programación académica.
            </p>
         </div>
      </div>

      <!-- Destino de la carga -->
      <UCard>
         <template #header>
            <h3 class="font-medium text-usm-text dark:text-white">1 · Destino</h3>
         </template>

         <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Carrera y plan" name="plan">
               <USelect
                  v-model="planId"
                  :items="opcionesPlan"
                  placeholder="Selecciona un plan…"
                  class="w-full"
                  :disabled="cargando"
               />
            </UFormField>
            <UFormField label="Semestre" name="semestre">
               <USelect
                  v-model="semestreId"
                  :items="opcionesSemestre"
                  placeholder="Selecciona un semestre…"
                  class="w-full"
                  :disabled="cargando"
               />
            </UFormField>
         </div>
      </UCard>

      <!-- Archivo -->
      <UCard>
         <template #header>
            <h3 class="font-medium text-usm-text dark:text-white">2 · Archivo CSV</h3>
         </template>

         <div class="space-y-4">
            <p class="text-sm text-gray-500 dark:text-gray-400">
               Se consideran solo las filas del campus <strong>Viña del Mar</strong> cuyo código de carrera coincide con
               el de la carrera del plan elegido, y que sean de tipo <strong>Cátedra</strong> o
               <strong>Práctico</strong>. Se asume que todas esas filas pertenecen al plan seleccionado. Una sala
               <strong>SALS</strong> o <strong>LABS</strong> se toma como sesión sin sala asignada.
            </p>

            <input ref="inputArchivo" type="file" accept=".csv,text/csv" class="hidden" @change="seleccionarArchivo" />

            <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
               <UButton
                  icon="i-lucide-upload"
                  :disabled="!destinoListo || cargando"
                  @click="() => inputArchivo?.click()"
               >
                  {{ archivo ? 'Cambiar archivo' : 'Seleccionar archivo CSV' }}
               </UButton>
               <span v-if="archivo" class="truncate text-sm text-gray-600 dark:text-gray-300">
                  {{ archivo.name }}
               </span>
               <UButton
                  v-if="archivo"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-x"
                  :disabled="cargando"
                  @click="limpiar"
               >
                  Quitar
               </UButton>
            </div>

            <UAlert
               v-if="!destinoListo"
               icon="i-lucide-info"
               color="neutral"
               variant="subtle"
               title="Elige primero la carrera, el plan y el semestre."
            />
         </div>
      </UCard>

      <!-- Análisis -->
      <UCard v-if="validando || reporte">
         <template #header>
            <h3 class="font-medium text-usm-text dark:text-white">3 · Revisión previa</h3>
         </template>

         <div v-if="validando" class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <UIcon name="i-lucide-loader-circle" class="animate-spin" />
            Analizando el archivo…
         </div>

         <div v-else-if="reporte" class="space-y-5">
            <!-- Lectura del archivo -->
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
               <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Filas del archivo</p>
                  <p class="text-lg font-semibold text-usm-text dark:text-white">{{ reporte.lectura.filasArchivo }}</p>
               </div>
               <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Otro campus</p>
                  <p class="text-lg font-semibold text-usm-text dark:text-white">
                     {{ reporte.lectura.filasOtroCampus }}
                  </p>
               </div>
               <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Otra carrera</p>
                  <p class="text-lg font-semibold text-usm-text dark:text-white">
                     {{ reporte.lectura.filasOtraCarrera }}
                  </p>
               </div>
               <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Otro tipo de sesión</p>
                  <p class="text-lg font-semibold text-usm-text dark:text-white">
                     {{ reporte.lectura.filasOtroTipo }}
                  </p>
               </div>
               <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Sin formato válido</p>
                  <p class="text-lg font-semibold text-usm-text dark:text-white">
                     {{ reporte.lectura.filasIgnoradasFormato }}
                  </p>
               </div>
               <div class="rounded-lg bg-primary-50 p-3 dark:bg-primary-950">
                  <p class="text-xs text-primary-700 dark:text-primary-300">A procesar</p>
                  <p class="text-lg font-semibold text-primary-700 dark:text-primary-200">
                     {{ reporte.lectura.filasConsideradas }}
                  </p>
               </div>
            </div>

            <!-- Errores que bloquean -->
            <div v-if="hayErrores" class="space-y-3">
               <UAlert
                  icon="i-lucide-octagon-alert"
                  color="error"
                  variant="subtle"
                  title="La carga está detenida"
                  description="Corrige lo siguiente en el sistema (o en el archivo) y vuelve a intentarlo."
               />
               <div
                  v-for="error in reporte.errores"
                  :key="error.titulo"
                  class="rounded-lg border border-error-200 p-3 dark:border-error-900"
               >
                  <p class="text-sm font-medium text-error-700 dark:text-error-300">{{ error.titulo }}</p>
                  <ul class="mt-2 flex flex-wrap gap-1.5">
                     <li
                        v-for="detalle in error.detalles"
                        :key="detalle"
                        class="rounded bg-error-50 px-2 py-0.5 font-mono text-xs text-error-700 dark:bg-error-950 dark:text-error-300"
                     >
                        {{ detalle }}
                     </li>
                  </ul>
               </div>
            </div>

            <!-- Resumen de lo que se va a hacer -->
            <template v-else>
               <div class="grid gap-4 lg:grid-cols-2">
                  <div class="rounded-lg border border-error-200 p-4 dark:border-error-900">
                     <p class="text-sm font-medium text-error-700 dark:text-error-300">Se eliminará</p>
                     <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        El horario que hoy tiene este plan en el semestre seleccionado.
                     </p>
                     <dl class="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                        <div class="flex justify-between">
                           <dt>Cursos</dt>
                           <dd>{{ reporte.aEliminar.cursos }}</dd>
                        </div>
                        <div class="flex justify-between">
                           <dt>Paralelos</dt>
                           <dd>{{ reporte.aEliminar.paralelos }}</dd>
                        </div>
                        <div class="flex justify-between">
                           <dt>Sesiones de clase</dt>
                           <dd>{{ reporte.aEliminar.sesiones }}</dd>
                        </div>
                        <div class="flex justify-between">
                           <dt>Reservas de sala</dt>
                           <dd>{{ reporte.aEliminar.reservas }}</dd>
                        </div>
                     </dl>
                  </div>

                  <div class="rounded-lg border border-success-200 p-4 dark:border-success-900">
                     <p class="text-sm font-medium text-success-700 dark:text-success-300">Se creará</p>
                     <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Las reservas de sala se generan como series recurrentes semanales, omitiendo los feriados.
                     </p>
                     <dl class="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                        <div class="flex justify-between">
                           <dt>Cursos</dt>
                           <dd>{{ reporte.aCrear.cursosNuevos.length }}</dd>
                        </div>
                        <div class="flex justify-between">
                           <dt>Paralelos</dt>
                           <dd>{{ reporte.aCrear.paralelos }}</dd>
                        </div>
                        <div class="flex justify-between">
                           <dt>Sesiones de clase</dt>
                           <dd>{{ reporte.aCrear.sesiones }}</dd>
                        </div>
                        <div class="flex justify-between">
                           <dt>Reservas de sala</dt>
                           <dd>{{ reporte.aCrear.reservas }}</dd>
                        </div>
                     </dl>
                  </div>
               </div>

               <div v-if="reporte.aCrear.cursosNuevos.length">
                  <p class="text-sm font-medium text-usm-text dark:text-white">Cursos que se crearán</p>
                  <ul class="mt-2 flex flex-wrap gap-1.5">
                     <li
                        v-for="curso in reporte.aCrear.cursosNuevos"
                        :key="curso"
                        class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                     >
                        {{ curso }}
                     </li>
                  </ul>
               </div>
            </template>

            <!-- Advertencias (no bloquean) -->
            <div v-if="reporte.advertencias.length" class="space-y-2">
               <p class="text-sm font-medium text-warning-700 dark:text-warning-300">
                  Advertencias ({{ reporte.advertencias.length }})
               </p>
               <ul class="max-h-56 space-y-1 overflow-y-auto rounded-lg bg-warning-50 p-3 dark:bg-warning-950">
                  <li
                     v-for="(advertencia, indice) in reporte.advertencias"
                     :key="indice"
                     class="text-xs text-warning-800 dark:text-warning-200"
                  >
                     • {{ advertencia }}
                  </li>
               </ul>
            </div>

            <div class="flex justify-end">
               <UButton
                  icon="i-lucide-database-backup"
                  color="primary"
                  :disabled="!puedeCargar"
                  @click="
                     () => {
                        confirmarAbierto = true
                     }
                  "
               >
                  Cargar horario
               </UButton>
            </div>
         </div>
      </UCard>

      <!-- Resultado -->
      <UCard v-if="resultado">
         <template #header>
            <h3 class="font-medium text-usm-text dark:text-white">Carga completada</h3>
         </template>

         <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
               <div class="rounded-lg bg-success-50 p-3 dark:bg-success-950">
                  <p class="text-xs text-success-700 dark:text-success-300">Cursos creados</p>
                  <p class="text-lg font-semibold text-success-800 dark:text-success-200">
                     {{ resultado.cursosCreados }}
                  </p>
               </div>
               <div class="rounded-lg bg-success-50 p-3 dark:bg-success-950">
                  <p class="text-xs text-success-700 dark:text-success-300">Paralelos</p>
                  <p class="text-lg font-semibold text-success-800 dark:text-success-200">
                     {{ resultado.paralelosCreados }}
                  </p>
               </div>
               <div class="rounded-lg bg-success-50 p-3 dark:bg-success-950">
                  <p class="text-xs text-success-700 dark:text-success-300">Sesiones</p>
                  <p class="text-lg font-semibold text-success-800 dark:text-success-200">
                     {{ resultado.sesionesCreadas }}
                  </p>
               </div>
               <div class="rounded-lg bg-success-50 p-3 dark:bg-success-950">
                  <p class="text-xs text-success-700 dark:text-success-300">Reservas de sala</p>
                  <p class="text-lg font-semibold text-success-800 dark:text-success-200">
                     {{ resultado.reservasCreadas }}
                  </p>
               </div>
            </div>

            <p class="text-sm text-gray-500 dark:text-gray-400">
               Se eliminó el horario anterior del plan en este semestre: {{ resultado.eliminados.cursos }} curso(s),
               {{ resultado.eliminados.paralelos }} paralelo(s), {{ resultado.eliminados.sesiones }} sesión(es) y
               {{ resultado.eliminados.reservas }} reserva(s).
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
               {{ resultado.reservasAyudantiaReasignadas }} reserva(s) de Ayudantía que dependían de un paralelo borrado
               se reenlazaron automáticamente al paralelo nuevo equivalente.
            </p>

            <div v-if="resultado.advertencias.length" class="space-y-2">
               <p class="text-sm font-medium text-warning-700 dark:text-warning-300">
                  Advertencias ({{ resultado.advertencias.length }})
               </p>
               <ul class="max-h-56 space-y-1 overflow-y-auto rounded-lg bg-warning-50 p-3 dark:bg-warning-950">
                  <li
                     v-for="(advertencia, indice) in resultado.advertencias"
                     :key="indice"
                     class="text-xs text-warning-800 dark:text-warning-200"
                  >
                     • {{ advertencia }}
                  </li>
               </ul>
            </div>

            <div class="flex justify-end gap-2">
               <UButton variant="ghost" color="neutral" to="/cursos">Ver cursos</UButton>
               <UButton variant="ghost" color="neutral" to="/horario">Ver horario</UButton>
            </div>
         </div>
      </UCard>

      <ConfirmModal
         v-model:open="confirmarAbierto"
         title="Reemplazar el horario del plan"
         confirm-label="Borrar y cargar"
         confirm-color="error"
         confirm-icon="i-lucide-database-backup"
         :loading="cargando"
         @confirm="cargar"
      >
         <div class="space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <p>
               Se reemplazará todo el horario de
               <strong>{{ planSeleccionado?.carrera.nombreCorto }} · Plan N° {{ planSeleccionado?.numero }}</strong>
               en el semestre <strong>{{ semestreSeleccionado?.nombre }}</strong
               >.
            </p>
            <p v-if="reporte" class="text-error-700 dark:text-error-300">
               Se borrarán {{ reporte.aEliminar.cursos }} curso(s), {{ reporte.aEliminar.paralelos }} paralelo(s),
               {{ reporte.aEliminar.sesiones }} sesión(es) y {{ reporte.aEliminar.reservas }} reserva(s) de sala. Esta
               acción no se puede deshacer.
            </p>
            <p class="text-gray-500 dark:text-gray-400">
               El horario del plan en otros semestres no se toca. La carga puede demorar varios segundos.
            </p>
         </div>
      </ConfirmModal>
   </div>
</template>
