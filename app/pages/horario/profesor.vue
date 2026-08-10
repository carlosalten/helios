<script setup lang="ts">
import type { Semestre } from '~/types/semestre'
import type { Bloque } from '~/types/bloque'
import type { Persona } from '~/types/persona'
import type { EventoAgenda } from '~/types/agendaProfesor'
import { DIAS_SEMANA, DIAS_FIN_SEMANA } from '~/types/dia'

const [{ data: semestres }, { data: bloquesRaw }, { data: personas }] = await Promise.all([
   useFetch<Semestre[]>('/api/semestres'),
   useFetch<Bloque[]>('/api/bloques'),
   useFetch<Persona[]>('/api/personas'),
])

/* ── Semestre: define la plantilla de bloques y acota las clases ─────────── */
const semestreSeleccionadoId = ref<number>()
watchEffect(() => {
   if (semestreSeleccionadoId.value == null && semestres.value?.length) {
      semestreSeleccionadoId.value = semestres.value.find((s) => s.vigente)?.id ?? semestres.value[0]!.id
   }
})
const opcionesSemestre = computed(() => (semestres.value ?? []).map((s) => ({ label: s.nombre, value: s.id })))

const bloquesSemestre = computed(() =>
   (bloquesRaw.value ?? [])
      .filter((b) => b.semestreId === semestreSeleccionadoId.value)
      .sort((a, b) => a.numero - b.numero)
)

/* ── Profesor: panel con buscador, mismo patrón que el de /horario ───────── */
const busquedaProfesor = ref('')
const profesoresFiltrados = computed(() =>
   (personas.value ?? []).filter((p) =>
      normalizarTexto(`${p.nombre} ${p.apellido}`).includes(normalizarTexto(busquedaProfesor.value))
   )
)
const profesorSeleccionadoId = ref<number>()
const profesorSeleccionado = computed(
   () => (personas.value ?? []).find((p) => p.id === profesorSeleccionadoId.value) ?? null
)

/* ── Semana visible ─────────────────────────────────────────────────────── */
function inicioDeSemana(d: Date) {
   const copia = new Date(d)
   // getDay: 0=domingo. Se retrocede hasta el lunes.
   const dia = copia.getDay() === 0 ? 7 : copia.getDay()
   copia.setDate(copia.getDate() - (dia - 1))
   copia.setHours(0, 0, 0, 0)
   return copia
}
function sumarDias(d: Date, n: number) {
   const copia = new Date(d)
   copia.setDate(copia.getDate() + n)
   return copia
}
function formatFechaISO(d: Date) {
   const anio = d.getFullYear()
   const mes = String(d.getMonth() + 1).padStart(2, '0')
   const dia = String(d.getDate()).padStart(2, '0')
   return `${anio}-${mes}-${dia}`
}
const MESES_ABREVIADOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function formatFechaCorta(d: Date) {
   return `${String(d.getDate()).padStart(2, '0')} ${MESES_ABREVIADOS[d.getMonth()]}`
}
function formatFechaCortaConAnio(d: Date) {
   return `${formatFechaCorta(d)} ${d.getFullYear()}`
}

const semanaInicio = ref(inicioDeSemana(new Date()))
function semanaAnterior() {
   semanaInicio.value = sumarDias(semanaInicio.value, -7)
}
function semanaSiguiente() {
   semanaInicio.value = sumarDias(semanaInicio.value, 7)
}
function irAHoy() {
   semanaInicio.value = inicioDeSemana(new Date())
}
const rangoSemanaLabel = computed(
   () => `${formatFechaCortaConAnio(semanaInicio.value)} — ${formatFechaCortaConAnio(sumarDias(semanaInicio.value, 6))}`
)

const mostrarFinSemana = ref(false)
// DIAS_SEMANA ya trae los 7 días; DIAS_FIN_SEMANA son solo los números (6 y 7) del fin de
// semana, que acá se usan para ocultarlos. Mismo patrón que /horario y /reservas/horario.
const diasVisibles = computed(() =>
   mostrarFinSemana.value ? DIAS_SEMANA : DIAS_SEMANA.filter((d) => !DIAS_FIN_SEMANA.includes(d.valor))
)
// Fecha real de cada día, indexada por `dia.valor` (1=Lunes…7=Domingo).
const fechasSemana = computed(
   () => new Map(DIAS_SEMANA.map((d) => [d.valor, sumarDias(semanaInicio.value, d.valor - 1)]))
)

/* ── Agenda del profesor en la semana ───────────────────────────────────── */
const { data: eventos, status } = await useFetch<EventoAgenda[]>(() => {
   const desde = formatFechaISO(semanaInicio.value)
   const hasta = formatFechaISO(sumarDias(semanaInicio.value, 6))
   return (
      `/api/horario/profesor?profesorId=${profesorSeleccionadoId.value ?? 0}` +
      `&semestreId=${semestreSeleccionadoId.value ?? 0}&desde=${desde}&hasta=${hasta}`
   )
})

/* ── Grilla: filas = bloques del semestre, columnas = días ───────────────
   Se usan los bloques (no una grilla de minutos) porque es como se lee un horario de clases.
   Una reserva puede no calzar con un bloque: se ubica en los bloques que alcanza a cubrir y se
   estira con `rowspan`, igual que en el reporte impreso de /reservas/horario. */
function horaAMinutos(hora: string) {
   const [h, m] = hora.split(':').map(Number)
   return (h ?? 0) * 60 + (m ?? 0)
}
function horaDeISO(horaISO: string) {
   return horaISO.slice(11, 16)
}

// Una entrada del cuadro: el evento y el rango de horas que se le muestra. El rango no siempre
// es el del evento — ver `fusionarContiguas`.
interface EntradaCelda {
   evento: EventoAgenda
   inicio: string
   fin: string
}
type Celda = { tipo: 'vacia' } | { tipo: 'oculta' } | { tipo: 'eventos'; entradas: EntradaCelda[]; span: number }

// Un tramo de filas de la grilla (del bloque `idxInicio` al `idxFin`, ambos incluidos).
interface Tramo {
   idxInicio: number
   idxFin: number
   entradas: EntradaCelda[]
}

// Primer bloque que aún no terminó cuando el evento empieza.
function idxBloqueInicio(minutos: number) {
   const idx = bloquesSemestre.value.findIndex((b) => horaAMinutos(horaDeISO(b.fin)) > minutos)
   return idx === -1 ? bloquesSemestre.value.length - 1 : idx
}
// Último bloque que ya había empezado cuando el evento termina.
function idxBloqueFin(minutos: number) {
   let idx = 0
   for (let i = 0; i < bloquesSemestre.value.length; i++) {
      if (horaAMinutos(horaDeISO(bloquesSemestre.value[i]!.inicio)) < minutos) idx = i
   }
   return idx
}

// Dos eventos son la misma actividad si solo se diferencian en la hora. El caso que importa:
// cada bloque de una clase es una sesión distinta —y por lo tanto una reserva distinta—, así
// que una clase de cuatro bloques llega acá como cuatro eventos idénticos seguidos. Se compara
// también la sala: una clase que cambia de sala entre bloques no es un solo tramo.
function mismaActividad(a: EventoAgenda, b: EventoAgenda) {
   return a.titulo === b.titulo && a.tipoReserva === b.tipoReserva && a.salaCodigo === b.salaCodigo
}

// Fusiona los tramos de la misma actividad que caen en filas consecutivas, para que salga un
// solo cuadro con el rango completo en vez de la misma clase repetida bloque a bloque. La
// contigüidad se mide en filas de la grilla (`idxFin + 1 === idxInicio`), no en horas: entre
// dos bloques puede haber un recreo, y en la grilla esas dos filas igual van pegadas.
//
// Solo se fusionan tramos de una entrada: si en el tramo hay varios eventos apilados, cuál
// continúa con cuál es ambiguo y se deja tal cual.
function fusionarContiguas(tramos: Tramo[]) {
   const fusionados: Tramo[] = []
   for (const tramo of [...tramos].sort((a, b) => a.idxInicio - b.idxInicio)) {
      const anterior = fusionados[fusionados.length - 1]
      const entradaAnterior = anterior?.entradas.length === 1 ? anterior.entradas[0]! : null
      const entradaActual = tramo.entradas.length === 1 ? tramo.entradas[0]! : null
      if (
         anterior &&
         entradaAnterior &&
         entradaActual &&
         anterior.idxFin + 1 === tramo.idxInicio &&
         mismaActividad(entradaAnterior.evento, entradaActual.evento)
      ) {
         anterior.idxFin = tramo.idxFin
         entradaAnterior.fin = entradaActual.fin
         continue
      }
      fusionados.push(tramo)
   }
   return fusionados
}

const celdasPorDia = computed(() => {
   const mapa = new Map<number, Celda[]>()
   for (const dia of DIAS_SEMANA) {
      const celdas: Celda[] = bloquesSemestre.value.map(() => ({ tipo: 'vacia' }))
      const fecha = fechasSemana.value.get(dia.valor)
      const fechaISO = fecha ? formatFechaISO(fecha) : ''
      const delDia = (eventos.value ?? []).filter((e) => e.fecha === fechaISO)

      // Un tramo por fila de inicio: los eventos que arrancan en el mismo bloque se apilan en
      // la misma celda y el rowspan se queda con el más largo de todos.
      const porFilaInicio = new Map<number, Tramo>()
      for (const evento of delDia) {
         const idxInicio = idxBloqueInicio(horaAMinutos(evento.inicio))
         if (idxInicio < 0 || idxInicio >= celdas.length) continue
         const idxFin = Math.max(idxInicio, idxBloqueFin(horaAMinutos(evento.fin)))
         const entrada: EntradaCelda = { evento, inicio: evento.inicio, fin: evento.fin }
         const tramo = porFilaInicio.get(idxInicio)
         if (tramo) {
            tramo.entradas.push(entrada)
            tramo.idxFin = Math.max(tramo.idxFin, idxFin)
         } else {
            porFilaInicio.set(idxInicio, { idxInicio, idxFin, entradas: [entrada] })
         }
      }

      for (const tramo of fusionarContiguas([...porFilaInicio.values()])) {
         celdas[tramo.idxInicio] = {
            tipo: 'eventos',
            entradas: tramo.entradas,
            span: tramo.idxFin - tramo.idxInicio + 1,
         }
         for (let i = tramo.idxInicio + 1; i <= tramo.idxFin && i < celdas.length; i++) {
            celdas[i] = { tipo: 'oculta' }
         }
      }
      mapa.set(dia.valor, celdas)
   }
   return mapa
})

function celdaDe(diaValor: number, idxBloque: number): Celda {
   return celdasPorDia.value.get(diaValor)?.[idxBloque] ?? { tipo: 'vacia' }
}
function entradasDe(diaValor: number, idxBloque: number): EntradaCelda[] {
   const celda = celdaDe(diaValor, idxBloque)
   return celda.tipo === 'eventos' ? celda.entradas : []
}
function spanDe(diaValor: number, idxBloque: number) {
   const celda = celdaDe(diaValor, idxBloque)
   return celda.tipo === 'eventos' ? celda.span : 1
}

// Clases y ayudantías ocupan el bloque completo, así que repetir su hora dentro del cuadro es
// redundante: la columna de la izquierda ya dice el horario del bloque. Los demás tipos
// (reunión, mantenimiento, examen…) pueden empezar y terminar a cualquier hora dentro del
// bloque —o cruzar varios—, así que ahí la hora sí aporta.
const TIPOS_SIN_HORA = ['Clase', 'Ayudantía']
function muestraHora(evento: EventoAgenda) {
   return !TIPOS_SIN_HORA.includes(evento.tipoReserva ?? '')
}

// Línea de hora/sala del cuadro: una clase sin sala también la muestra ("Sin sala"), en vez de
// desaparecer en silencio — así se distingue de un error de carga y queda claro que falta
// asignarle una. Las reservas normales siempre tienen sala (campo no nulo en `Reserva`), así
// que para ellas esta línea nunca cae en el caso "sin sala".
function detalleHorarioSala(entrada: EntradaCelda) {
   const partes: string[] = []
   if (muestraHora(entrada.evento)) partes.push(`${entrada.inicio}–${entrada.fin}`)
   if (entrada.evento.salaCodigo) partes.push(entrada.evento.salaCodigo)
   else if (entrada.evento.tipo === 'clase') partes.push('Sin sala')
   return partes
}

// Color del evento: el del paralelo o el del tipo de reserva. Se aplica inline porque es un
// valor arbitrario en tiempo de ejecución y Tailwind no puede generar clases para él.
function estiloEvento(evento: EventoAgenda) {
   if (!evento.color) return {}
   return { borderColor: `${evento.color}66`, backgroundColor: `${evento.color}1a` }
}

const totalEventos = computed(() => (eventos.value ?? []).length)
const totalClases = computed(() => (eventos.value ?? []).filter((e) => e.tipo === 'clase').length)

/* ── Imprimir ────────────────────────────────────────────────────────────
   Se reusa la misma tabla: en pantalla se ve la interactiva y al imprimir se ocultan los
   paneles y controles (print:hidden en el layout y en los filtros). */
function imprimirHorario() {
   window.print()
}
</script>

<template>
   <div class="space-y-6">
      <div class="print:hidden flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Horario semanal de un profesor: sus clases y sus reservas de sala.
         </p>
         <div class="flex flex-wrap items-center gap-3 sm:shrink-0">
            <USwitch v-model="mostrarFinSemana" label="Mostrar fin de semana" class="shrink-0" />
            <UButton
               icon="i-lucide-printer"
               color="neutral"
               variant="outline"
               :disabled="!profesorSeleccionado || !bloquesSemestre.length"
               @click="imprimirHorario"
            >
               Imprimir
            </UButton>
         </div>
      </div>

      <!-- Filtros -->
      <div class="print:hidden flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <USelectMenu
            v-model="semestreSeleccionadoId"
            :items="opcionesSemestre"
            value-key="value"
            placeholder="Selecciona un semestre…"
            :search-input="{ placeholder: 'Buscar semestre…' }"
            class="w-full sm:w-64"
         />
         <div class="flex items-center gap-1">
            <UButton
               icon="i-lucide-chevron-left"
               color="neutral"
               variant="outline"
               aria-label="Semana anterior"
               @click="semanaAnterior"
            />
            <UButton color="neutral" variant="outline" @click="irAHoy">Hoy</UButton>
            <UButton
               icon="i-lucide-chevron-right"
               color="neutral"
               variant="outline"
               aria-label="Semana siguiente"
               @click="semanaSiguiente"
            />
            <span class="ms-2 text-sm font-medium text-usm-text dark:text-white">
               <span class="text-usm-text-muted dark:text-slate-400">Semana:</span> {{ rangoSemanaLabel }}
            </span>
         </div>
      </div>

      <EmptyState
         v-if="!bloquesSemestre.length"
         icon="i-lucide-clock"
         message="Este semestre no tiene bloques horarios. Crea bloques para poder ver el horario."
      />

      <div v-else class="lg:grid lg:grid-cols-[1fr_280px] lg:items-start lg:gap-6">
         <!-- Horario. La clase la usa el bloque @media print del final para bajar el tamaño de
              letra solo en el papel (ver <style>). -->
         <div class="horario-profesor">
            <EmptyState
               v-if="!profesorSeleccionado"
               icon="i-lucide-mouse-pointer-click"
               message="Selecciona un profesor para ver su horario."
            />
            <template v-else>
               <!-- Encabezado (solo impresión) -->
               <div class="hidden print:mb-4 print:block">
                  <h2 class="text-lg font-bold text-usm-blue">
                     Horario de {{ profesorSeleccionado.nombre }} {{ profesorSeleccionado.apellido }}
                  </h2>
                  <p class="text-xs text-gray-700">Semana del {{ rangoSemanaLabel }}</p>
               </div>

               <!-- `overflow-hidden` es lo que recorta las esquinas de la tabla contra el radio del
                    contenedor; se mantiene al imprimir para que el marco salga redondeado en el papel. -->
               <div class="overflow-hidden rounded-2xl border border-default bg-default">
                  <table class="w-full border-collapse text-sm">
                     <thead>
                        <tr>
                           <th
                              class="w-28 border-b border-e border-default bg-muted p-2 text-left text-xs font-semibold text-usm-text dark:text-white print:bg-sky-50"
                           >
                              Bloque
                           </th>
                           <th
                              v-for="dia in diasVisibles"
                              :key="dia.valor"
                              class="border-b border-e border-default bg-muted p-2 text-center text-xs font-semibold text-usm-text last:border-e-0 dark:text-white print:bg-sky-50"
                           >
                              {{ dia.nombre }}
                              <span class="block font-normal text-usm-text-muted dark:text-slate-400">
                                 {{ formatFechaCorta(fechasSemana.get(dia.valor)!) }}
                              </span>
                           </th>
                        </tr>
                     </thead>
                     <!-- La última fila no lleva borde inferior: se solaparía con el del contenedor
                          justo en la curva de las esquinas. -->
                     <tbody class="[&>tr:last-child>td]:border-b-0">
                        <tr v-for="(bloque, idxBloque) in bloquesSemestre" :key="bloque.id">
                           <td
                              class="border-b border-e border-default bg-muted p-2 align-top text-xs text-usm-text-muted dark:text-slate-400 print:bg-sky-50"
                           >
                              <span class="font-semibold text-usm-text dark:text-white">
                                 Bloque {{ bloque.numero }}
                              </span>
                              <span class="block"> {{ horaDeISO(bloque.inicio) }}–{{ horaDeISO(bloque.fin) }} </span>
                           </td>
                           <template v-for="dia in diasVisibles" :key="`${dia.valor}-${bloque.id}`">
                              <!-- `h-px` en la celda + `h-full` en el contenedor: sin una altura
                                   declarada en el <td>, el alto en porcentaje del hijo queda sin
                                   resolver y el cuadro se queda del tamaño de su texto — una clase
                                   de cuatro bloques se veía cubriendo dos. Con la altura mínima, el
                                   navegador resuelve el 100% contra el alto real que la fila le dio
                                   a la celda (que el rowspan ya estiró). -->
                              <td
                                 v-if="celdaDe(dia.valor, idxBloque).tipo !== 'oculta'"
                                 :rowspan="spanDe(dia.valor, idxBloque)"
                                 class="h-px border-b border-e border-default p-1 align-top last:border-e-0 print:p-0"
                              >
                                 <div class="flex h-full flex-col gap-1 print:gap-0">
                                    <div
                                       v-for="entrada in entradasDe(dia.valor, idxBloque)"
                                       :key="entrada.evento.id"
                                       class="flex-1 rounded-lg border p-1.5 text-xs print:rounded-none"
                                       :style="estiloEvento(entrada.evento)"
                                    >
                                       <p class="font-semibold text-usm-text dark:text-white">
                                          {{ entrada.evento.asignatura ?? entrada.evento.titulo }}
                                       </p>
                                       <p
                                          v-if="detalleHorarioSala(entrada).length"
                                          class="text-usm-text-muted dark:text-slate-300"
                                          :class="{ 'italic opacity-75': !entrada.evento.salaCodigo }"
                                       >
                                          {{ detalleHorarioSala(entrada).join(' · ') }}
                                       </p>
                                       <p
                                          v-if="entrada.evento.tipo === 'clase'"
                                          class="text-usm-text-muted dark:text-slate-400"
                                       >
                                          {{ entrada.evento.carreraCorta }} · Paralelo
                                          {{ entrada.evento.paraleloCodigo }}
                                       </p>
                                       <p
                                          v-if="entrada.evento.tipoReserva"
                                          class="text-usm-text-muted dark:text-slate-400"
                                       >
                                          {{ entrada.evento.tipoReserva }}
                                       </p>
                                    </div>
                                 </div>
                              </td>
                           </template>
                        </tr>
                     </tbody>
                  </table>
               </div>

               <p v-if="status !== 'pending' && !totalEventos" class="mt-3 text-sm text-usm-text-muted">
                  Este profesor no tiene clases ni reservas en esta semana.
               </p>
               <p v-else-if="totalEventos" class="print:hidden mt-3 text-xs text-usm-text-muted">
                  {{ totalEventos }} actividad{{ totalEventos !== 1 ? 'es' : '' }} en la semana ({{ totalClases }} de
                  clases).
               </p>
            </template>
         </div>

         <!-- Panel de profesores -->
         <div class="print:hidden mt-6 space-y-3 lg:mt-0">
            <div class="rounded-2xl border border-default bg-default p-3">
               <p class="mb-2 text-sm font-semibold text-usm-text dark:text-white">Profesores</p>
               <UInput
                  v-model="busquedaProfesor"
                  icon="i-lucide-search"
                  placeholder="Buscar profesor…"
                  size="sm"
                  class="mb-2 w-full"
               />
               <p v-if="!profesoresFiltrados.length" class="text-sm text-usm-text-muted dark:text-slate-400">
                  No se encontraron profesores.
               </p>
               <div v-else class="max-h-96 space-y-1 overflow-y-auto pe-1">
                  <button
                     v-for="profesor in profesoresFiltrados"
                     :key="profesor.id"
                     type="button"
                     class="flex w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-start text-xs transition-colors"
                     :class="
                        profesor.id === profesorSeleccionadoId
                           ? 'border-usm-blue bg-usm-blue/10 font-semibold text-usm-blue dark:text-usm-cyan'
                           : 'border-default bg-muted text-usm-text hover:border-usm-blue/40 dark:text-slate-200'
                     "
                     @click="profesorSeleccionadoId = profesor.id"
                  >
                     <UIcon name="i-lucide-user" class="size-3 shrink-0" />
                     <span class="truncate">{{ profesor.nombre }} {{ profesor.apellido }}</span>
                  </button>
               </div>
            </div>
         </div>
      </div>
   </div>
</template>

<style>
/* Tailwind no tiene utilidad para @page — única forma de fijar tamaño/márgenes de la hoja. */
@page {
   size: letter portrait;
   /* Mitad del margen habitual (1.27cm) para ganar ancho de tabla. Por debajo de ~0.5cm varias
      impresoras recortan igual, así que este es el piso razonable. */
   margin: 0.635cm;
}

/* Dos puntos menos de letra al imprimir, para que la semana completa entre cómoda en una hoja
   vertical. Va como CSS crudo y no con utilidades `print:text-*` porque hay que pisar los
   `text-xs`/`text-sm`/`text-lg` que ya llevan la tabla y sus celdas; los selectores de dos
   niveles le ganan en especificidad a esas utilidades de una sola clase.

   Equivalencias: text-lg 13.5pt → 10.5pt · text-sm 10.5pt → 7.5pt · text-xs 9pt → 6pt. */
@media print {
   .horario-profesor h2 {
      font-size: 10.5pt;
   }
   .horario-profesor > div > p,
   .horario-profesor table {
      font-size: 7.5pt;
   }
   .horario-profesor table th,
   .horario-profesor table td,
   .horario-profesor table p,
   .horario-profesor table span {
      font-size: 6pt;
   }
}

/* El resto de los ajustes de impresión (modo claro forzado y print-color-adjust) es global:
   está en app/assets/css/main.css. */
</style>
