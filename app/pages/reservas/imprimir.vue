<script setup lang="ts">
import type { Bloque } from '~/types/bloque'
import type { Sala } from '~/types/sala'
import type { Semestre } from '~/types/semestre'
import { COLORES_RESERVA, type Reserva } from '~/types/reserva'
import { DIAS_SEMANA, DIAS_FIN_SEMANA } from '~/types/dia'
import { CalendarDate, type DateValue } from '@internationalized/date'
import type { DateRange } from 'reka-ui'

const { user } = useUserSession()

const [{ data: semestres }, { data: bloquesRaw }, { data: salas }, { data: misSalasEncargado }] = await Promise.all([
   useFetch<Semestre[]>('/api/semestres'),
   useFetch<Bloque[]>('/api/bloques'),
   useFetch<Sala[]>('/api/salas'),
   useFetch<string[]>('/api/reservas/mis-salas-encargado'),
])

/* ── Semestre: solo define la plantilla horaria (bloques) del cuadro impreso — mismo
   criterio que /reservas/horario, sin selector: se usa el vigente automáticamente. ── */
const semestreSeleccionadoId = ref<number>()
watchEffect(() => {
   if (semestreSeleccionadoId.value == null && semestres.value?.length) {
      semestreSeleccionadoId.value = semestres.value.find((s) => s.vigente)?.id ?? semestres.value[0]!.id
   }
})
const bloquesSemestre = computed(() =>
   (bloquesRaw.value ?? [])
      .filter((b) => b.semestreId === semestreSeleccionadoId.value)
      .sort((a, b) => a.numero - b.numero)
)

/* ── Salas: las mismas visibles que en /reservas/horario — acotadas a las asignadas
   (EncargadoSala) para cualquier rol que no sea Administrador, que ve todas. El usuario elige
   cuáles imprimir con checkboxes. ── */
const misSalasEncargadoSet = computed(() => new Set(misSalasEncargado.value ?? []))
const salasVisibles = computed(() => {
   if (user.value?.rol === 'Administrador') return salas.value ?? []
   return (salas.value ?? []).filter((s) => misSalasEncargadoSet.value.has(s.codigo))
})

const busquedaSala = ref('')
const filtroTipoSala = ref<number | '__todos__'>('__todos__')
const opcionesTipoSala = computed(() => {
   const vistos = new Map<number, string>()
   for (const s of salasVisibles.value) {
      if (!vistos.has(s.tipoSalaId)) vistos.set(s.tipoSalaId, s.tipoSala.nombre)
   }
   return [
      { label: 'Todos los tipos', value: '__todos__' as const },
      ...Array.from(vistos, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
   ]
})
const salasFiltradas = computed(() => {
   const q = normalizarTexto(busquedaSala.value.trim())
   return salasVisibles.value.filter((s) => {
      const coincideBusqueda =
         !q || normalizarTexto(s.codigo).includes(q) || normalizarTexto(s.tipoSala.nombre).includes(q)
      const coincideTipo = filtroTipoSala.value === '__todos__' || s.tipoSalaId === filtroTipoSala.value
      return coincideBusqueda && coincideTipo
   })
})

const salasSeleccionadas = ref<Set<string>>(new Set())
function estaSeleccionada(codigo: string) {
   return salasSeleccionadas.value.has(codigo)
}
function alternarSala(codigo: string) {
   const copia = new Set(salasSeleccionadas.value)
   if (copia.has(codigo)) copia.delete(codigo)
   else copia.add(codigo)
   salasSeleccionadas.value = copia
}
function seleccionarTodas() {
   salasSeleccionadas.value = new Set([...salasSeleccionadas.value, ...salasFiltradas.value.map((s) => s.codigo)])
}
function deseleccionarTodas() {
   const filtradas = new Set(salasFiltradas.value.map((s) => s.codigo))
   salasSeleccionadas.value = new Set([...salasSeleccionadas.value].filter((c) => !filtradas.has(c)))
}
// Si el rol cambia de alcance (o una sala deja de existir), se descarta lo que ya no es visible.
watch(salasVisibles, (visibles) => {
   const codigos = new Set(visibles.map((s) => s.codigo))
   const vigentes = [...salasSeleccionadas.value].filter((c) => codigos.has(c))
   if (vigentes.length !== salasSeleccionadas.value.size) salasSeleccionadas.value = new Set(vigentes)
})

// Orden de impresión: el mismo de la lista (código), no el de selección.
const salasAImprimir = computed(() => salasVisibles.value.filter((s) => salasSeleccionadas.value.has(s.codigo)))

/* ── Fin de semana y anchos de columna del cuadro impreso — igual que /reservas/horario. ── */
const mostrarFinSemana = ref(false)
const diasVisibles = computed(() =>
   mostrarFinSemana.value ? DIAS_SEMANA : DIAS_SEMANA.filter((d) => !DIAS_FIN_SEMANA.includes(d.valor))
)
const ANCHO_COLUMNA_BLOQUE_IMPRESION = 11
const anchoColumnaDiaImpresion = computed(() => (100 - ANCHO_COLUMNA_BLOQUE_IMPRESION) / diasVisibles.value.length)

/* ── Navegación por semana — igual que /reservas/horario. ── */
function inicioDeSemana(d: Date) {
   const copia = new Date(d)
   copia.setHours(0, 0, 0, 0)
   const dow = copia.getDay()
   copia.setDate(copia.getDate() + (dow === 0 ? -6 : 1 - dow))
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

const calendarioAbierto = ref(false)
const fechaCalendario = computed<DateValue>(
   () =>
      new CalendarDate(
         semanaInicio.value.getFullYear(),
         semanaInicio.value.getMonth() + 1,
         semanaInicio.value.getDate()
      )
)
function irAFecha(valor: DateValue | DateRange | DateValue[] | null | undefined) {
   if (!valor || Array.isArray(valor) || !('day' in valor)) return
   semanaInicio.value = inicioDeSemana(new Date(valor.year, valor.month - 1, valor.day))
   calendarioAbierto.value = false
}
const rangoSemanaLabel = computed(
   () => `${formatFechaCortaConAnio(semanaInicio.value)} — ${formatFechaCortaConAnio(sumarDias(semanaInicio.value, 6))}`
)
const fechasSemana = computed(
   () => new Map(DIAS_SEMANA.map((d) => [d.valor, sumarDias(semanaInicio.value, d.valor - 1)]))
)

function horaDeISO(horaISO: string) {
   return horaISO.slice(11, 16)
}
function horaAMinutos(hora: string) {
   const [h, m] = hora.split(':').map(Number)
   return h! * 60 + m!
}
function horaConSufijo(horaISO: string) {
   return `${horaDeISO(horaISO)} hrs.`
}

/* ── Reservas de cada sala seleccionada, en la semana visible ────────────
   /api/reservas solo acepta una sala a la vez (ver server/api/reservas/index.get.ts), así que
   se piden todas en paralelo y se guardan indexadas por código de sala. */
const reservasPorSala = ref<Map<string, Reserva[]>>(new Map())
const cargandoReservas = ref(false)
async function cargarReservas() {
   const codigos = [...salasSeleccionadas.value]
   if (!codigos.length) {
      reservasPorSala.value = new Map()
      return
   }
   cargandoReservas.value = true
   try {
      const desde = formatFechaISO(semanaInicio.value)
      const hasta = formatFechaISO(sumarDias(semanaInicio.value, 6))
      const resultados = await Promise.all(
         codigos.map((codigo) => $fetch<Reserva[]>(`/api/reservas?salaCodigo=${codigo}&desde=${desde}&hasta=${hasta}`))
      )
      reservasPorSala.value = new Map(codigos.map((codigo, i) => [codigo, resultados[i]!]))
   } finally {
      cargandoReservas.value = false
   }
}
watch([salasSeleccionadas, semanaInicio], cargarReservas, { immediate: true, deep: true })

/* ── Cuadro impreso por sala — mismo criterio que /reservas/horario: una fila por bloque
   horario del semestre, agrupando los bloques contiguos de una misma actividad en un solo
   recuadro con `rowspan`. Ver ese archivo para el detalle de por qué se arma así. ── */
interface EntradaImpresion {
   reserva: Reserva
   inicio: string
   fin: string
}
type CeldaImpresion =
   { tipo: 'vacia' } | { tipo: 'oculta' } | { tipo: 'reservas'; entradas: EntradaImpresion[]; span: number }
interface TramoImpresion {
   idxInicio: number
   idxFin: number
   entradas: EntradaImpresion[]
}

function agruparEnClusters(reservasDia: Reserva[]) {
   const ordenadas = [...reservasDia].sort(
      (a, b) => horaAMinutos(horaDeISO(a.inicio)) - horaAMinutos(horaDeISO(b.inicio))
   )
   const clusters: Reserva[][] = []
   let clusterActual: Reserva[] = []
   let finClusterActual = -1
   for (const r of ordenadas) {
      const inicioMin = horaAMinutos(horaDeISO(r.inicio))
      const finMin = horaAMinutos(horaDeISO(r.fin))
      if (clusterActual.length && inicioMin < finClusterActual) {
         clusterActual.push(r)
         finClusterActual = Math.max(finClusterActual, finMin)
      } else {
         if (clusterActual.length) clusters.push(clusterActual)
         clusterActual = [r]
         finClusterActual = finMin
      }
   }
   if (clusterActual.length) clusters.push(clusterActual)
   return clusters
}

function mismaActividad(a: Reserva, b: Reserva) {
   return a.titulo === b.titulo && a.tipoReservaId === b.tipoReservaId && a.personaId === b.personaId
}

function fusionarContiguas(tramos: TramoImpresion[]) {
   const fusionados: TramoImpresion[] = []
   for (const tramo of [...tramos].sort((a, b) => a.idxInicio - b.idxInicio)) {
      const anterior = fusionados[fusionados.length - 1]
      const entradaAnterior = anterior?.entradas.length === 1 ? anterior.entradas[0]! : null
      const entradaActual = tramo.entradas.length === 1 ? tramo.entradas[0]! : null
      if (
         anterior &&
         entradaAnterior &&
         entradaActual &&
         anterior.idxFin + 1 === tramo.idxInicio &&
         mismaActividad(entradaAnterior.reserva, entradaActual.reserva)
      ) {
         anterior.idxFin = tramo.idxFin
         entradaAnterior.fin = entradaActual.fin
         continue
      }
      fusionados.push(tramo)
   }
   return fusionados
}

function idxBloqueInicio(minutos: number) {
   const idx = bloquesSemestre.value.findIndex((b) => horaAMinutos(horaDeISO(b.fin)) > minutos)
   return idx === -1 ? bloquesSemestre.value.length - 1 : idx
}
function idxBloqueFin(minutos: number) {
   let idx = 0
   for (let i = 0; i < bloquesSemestre.value.length; i++) {
      if (horaAMinutos(horaDeISO(bloquesSemestre.value[i]!.inicio)) < minutos) idx = i
   }
   return idx
}

function celdasImpresionDeSala(salaCodigo: string) {
   const reservasSala = reservasPorSala.value.get(salaCodigo) ?? []
   const mapa = new Map<number, CeldaImpresion[]>()
   for (const dia of DIAS_SEMANA) {
      const fecha = fechasSemana.value.get(dia.valor)
      const fechaISO = fecha ? formatFechaISO(fecha) : ''
      const celdas: CeldaImpresion[] = bloquesSemestre.value.map(() => ({ tipo: 'vacia' }))
      const reservasDia = reservasSala.filter((r) => r.fecha.slice(0, 10) === fechaISO && r.publica)
      const tramos = agruparEnClusters(reservasDia).map<TramoImpresion>((cluster) => {
         const clusterInicioMin = Math.min(...cluster.map((r) => horaAMinutos(horaDeISO(r.inicio))))
         const clusterFinMin = Math.max(...cluster.map((r) => horaAMinutos(horaDeISO(r.fin))))
         const idxInicio = idxBloqueInicio(clusterInicioMin)
         return {
            idxInicio,
            idxFin: Math.max(idxInicio, idxBloqueFin(clusterFinMin)),
            entradas: cluster.map((r) => ({ reserva: r, inicio: r.inicio, fin: r.fin })),
         }
      })
      for (const tramo of fusionarContiguas(tramos)) {
         celdas[tramo.idxInicio] = {
            tipo: 'reservas',
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
}
const celdasImpresionPorSala = computed(() => {
   const mapa = new Map<string, Map<number, CeldaImpresion[]>>()
   for (const sala of salasAImprimir.value) mapa.set(sala.codigo, celdasImpresionDeSala(sala.codigo))
   return mapa
})
function celdaImpresionDe(salaCodigo: string, diaValor: number, idxBloque: number): CeldaImpresion {
   return celdasImpresionPorSala.value.get(salaCodigo)?.get(diaValor)?.[idxBloque] ?? { tipo: 'vacia' }
}
function rowspanImpresionDe(salaCodigo: string, diaValor: number, idxBloque: number) {
   const celda = celdaImpresionDe(salaCodigo, diaValor, idxBloque)
   return celda.tipo === 'reservas' ? celda.span : 1
}
function entradasImpresionDe(salaCodigo: string, diaValor: number, idxBloque: number): EntradaImpresion[] {
   const celda = celdaImpresionDe(salaCodigo, diaValor, idxBloque)
   return celda.tipo === 'reservas' ? celda.entradas : []
}

// Clases y ayudantías se describen por lo que se dicta; el resto, por su tipo — igual que
// /reservas/horario.
const TIPOS_CLASE = ['Clase', 'Ayudantía']
function esClase(reserva: Reserva) {
   return TIPOS_CLASE.includes(reserva.tipoReserva.nombre)
}
function profesorDe(reserva: Reserva) {
   return reserva.persona ? `${reserva.persona.nombre} ${reserva.persona.apellido}` : null
}

// Nombre a mostrar de la asignatura: el corto si la asignatura tiene uno definido, si no el
// completo. Mismo criterio en /reservas/horario.
function nombreAsignaturaDe(reserva: Reserva) {
   const asignatura = reserva.sesionParalelo?.paralelo.asignaturaPlan.asignatura
   return asignatura ? (asignatura.nombreCorto ?? asignatura.nombre) : null
}

// Mismo criterio de color que /reservas/horario: cada paralelo lleva el suyo (o uno derivado
// de su identificador si aún no tiene) para poder seguir una asignatura de un vistazo.
function colorImpresion(reserva: Reserva) {
   if (!esClase(reserva)) return reserva.tipoReserva.color
   const paralelo = reserva.sesionParalelo?.paralelo
   if (paralelo?.color) return paralelo.color
   const clave = paralelo ? `${paralelo.asignaturaPlan.asignatura.nombre}·${paralelo.codigo}` : reserva.titulo
   let indice = 0
   for (const caracter of clave) indice = (indice * 31 + caracter.charCodeAt(0)) % COLORES_RESERVA.length
   return COLORES_RESERVA[indice]!.hex
}
function estiloCeldaImpresion(salaCodigo: string, diaValor: number, idxBloque: number) {
   const entrada = entradasImpresionDe(salaCodigo, diaValor, idxBloque)[0]
   if (!entrada) return {}
   const color = colorImpresion(entrada.reserva)
   return { borderColor: color, backgroundColor: `${color}14` }
}

function imprimirHorarios() {
   window.print()
}
</script>

<template>
   <div class="print:hidden space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Selecciona una o más salas para imprimir su horario de reservas de la semana, una sala por hoja.
         </p>
         <USwitch
            v-if="bloquesSemestre.length"
            v-model="mostrarFinSemana"
            label="Mostrar fin de semana"
            class="shrink-0"
         />
      </div>

      <!-- Controles -->
      <div class="flex flex-wrap items-center justify-between gap-2">
         <span class="text-sm font-medium text-usm-text dark:text-white">
            <span class="text-usm-text-muted dark:text-slate-400">Semana:</span> {{ rangoSemanaLabel }}
         </span>
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
            <UPopover v-model:open="calendarioAbierto">
               <UButton icon="i-lucide-calendar-search" color="neutral" variant="outline" aria-label="Ir a una fecha" />
               <template #content>
                  <UCalendar
                     :model-value="fechaCalendario"
                     locale="es-CL"
                     year-controls
                     class="p-2"
                     @update:model-value="irAFecha"
                  />
               </template>
            </UPopover>
            <UButton
               icon="i-lucide-printer"
               :disabled="!salasAImprimir.length || !bloquesSemestre.length || cargandoReservas"
               :loading="cargandoReservas"
               @click="imprimirHorarios"
            >
               Imprimir ({{ salasAImprimir.length }})
            </UButton>
         </div>
      </div>

      <EmptyState
         v-if="!salas?.length"
         icon="i-lucide-door-open"
         message="No hay salas registradas. Crea una en Salas → Gestión de salas."
      />
      <EmptyState
         v-else-if="!salasVisibles.length"
         icon="i-lucide-door-open"
         message="No tienes salas asignadas. Pide a un Administrador que te agregue como encargado de una sala."
      />
      <EmptyState
         v-else-if="!bloquesSemestre.length"
         icon="i-lucide-clock"
         message="Este semestre no tiene bloques horarios definidos. Crea bloques para armar la plantilla de horas."
      />

      <!-- Panel de selección de salas -->
      <div v-else class="rounded-2xl border border-default bg-default">
         <div class="flex flex-col gap-2 border-b border-default p-3 sm:flex-row sm:items-center">
            <UInput
               v-model="busquedaSala"
               icon="i-lucide-search"
               placeholder="Buscar sala…"
               class="w-full sm:max-w-64"
            />
            <USelect v-model="filtroTipoSala" :items="opcionesTipoSala" value-key="value" class="w-full sm:max-w-52" />
            <div class="flex shrink-0 items-center gap-2 sm:ml-auto">
               <UButton size="xs" color="neutral" variant="ghost" @click="seleccionarTodas">
                  Seleccionar {{ busquedaSala || filtroTipoSala !== '__todos__' ? 'filtradas' : 'todas' }}
               </UButton>
               <UButton size="xs" color="neutral" variant="ghost" @click="deseleccionarTodas">Quitar selección</UButton>
            </div>
         </div>
         <div class="grid grid-cols-1 gap-1 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <label
               v-for="sala in salasFiltradas"
               :key="sala.codigo"
               class="flex cursor-pointer items-center gap-3 rounded-xl border-s-4 px-3 py-2.5 transition-colors hover:bg-elevated/50"
               :class="
                  estaSeleccionada(sala.codigo)
                     ? 'border-s-usm-blue bg-info-50 dark:border-s-usm-cyan dark:bg-usm-cyan/10'
                     : 'border-s-transparent'
               "
            >
               <UCheckbox
                  :model-value="estaSeleccionada(sala.codigo)"
                  @update:model-value="alternarSala(sala.codigo)"
               />
               <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-usm-text dark:text-white">{{ sala.codigo }}</p>
                  <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                     {{ sala.tipoSala.nombre }} · {{ sala.capacidad }} personas
                  </p>
               </div>
            </label>
            <p
               v-if="!salasFiltradas.length"
               class="col-span-full p-4 text-center text-xs text-usm-text-muted dark:text-slate-400"
            >
               Sin resultados
            </p>
         </div>
      </div>
   </div>

   <!-- Versión imprimible: una sala por hoja, mismo formato que /reservas/horario. -->
   <div
      v-for="(sala, idx) in salasAImprimir"
      :key="sala.codigo"
      class="hidden print:block"
      :class="idx < salasAImprimir.length - 1 ? 'break-after-page' : ''"
   >
      <div class="mb-3">
         <h1 class="text-[10.5pt] font-bold text-gray-900">{{ sala.codigo }} · {{ sala.tipoSala.nombre }}</h1>
         <p class="text-[7.5pt] text-gray-700">Semana del {{ rangoSemanaLabel }}</p>
      </div>
      <div class="overflow-hidden rounded-2xl border border-[#d4d4d4]">
         <table class="w-full table-fixed border-separate border-spacing-0 text-[6pt]">
            <colgroup>
               <col :style="{ width: `${ANCHO_COLUMNA_BLOQUE_IMPRESION}%` }" />
               <col v-for="dia in diasVisibles" :key="dia.valor" :style="{ width: `${anchoColumnaDiaImpresion}%` }" />
            </colgroup>
            <thead>
               <tr>
                  <th
                     class="border-b border-e border-[#d4d4d4] bg-sky-50 p-1 text-left font-semibold whitespace-nowrap text-usm-blue"
                  >
                     Bloque
                  </th>
                  <th
                     v-for="dia in diasVisibles"
                     :key="dia.valor"
                     class="border-b border-e border-[#d4d4d4] bg-sky-50 p-1 text-center font-semibold text-usm-blue last:border-e-0"
                  >
                     {{ dia.nombre }}
                  </th>
               </tr>
            </thead>
            <tbody class="[&>tr:last-child>td:not([data-reserva])]:border-b-0">
               <tr v-for="(bloque, idxBloque) in bloquesSemestre" :key="bloque.id" class="break-inside-avoid">
                  <td
                     class="border-b border-e border-[#d4d4d4] bg-sky-50 p-1 align-top whitespace-nowrap text-gray-700"
                  >
                     <p class="font-semibold text-black">Bloque {{ bloque.numero }}</p>
                     <p>{{ horaDeISO(bloque.inicio) }}–{{ horaDeISO(bloque.fin) }}</p>
                  </td>
                  <template v-for="dia in diasVisibles" :key="dia.valor">
                     <td
                        v-if="celdaImpresionDe(sala.codigo, dia.valor, idxBloque).tipo !== 'oculta'"
                        :rowspan="rowspanImpresionDe(sala.codigo, dia.valor, idxBloque)"
                        class="border-[#d4d4d4] p-1 align-top"
                        :class="
                           entradasImpresionDe(sala.codigo, dia.valor, idxBloque).length
                              ? 'border'
                              : 'border-b border-e last:border-e-0'
                        "
                        :data-reserva="entradasImpresionDe(sala.codigo, dia.valor, idxBloque).length ? '' : undefined"
                        :style="estiloCeldaImpresion(sala.codigo, dia.valor, idxBloque)"
                     >
                        <div
                           v-for="entrada in entradasImpresionDe(sala.codigo, dia.valor, idxBloque)"
                           :key="entrada.reserva.id"
                           class="leading-tight not-last:mb-1 not-last:border-b not-last:border-dashed not-last:border-[#d4d4d4] not-last:pb-1"
                        >
                           <p class="font-semibold wrap-break-word text-black">{{ entrada.reserva.titulo }}</p>
                           <p
                              v-if="entrada.reserva.tipoReserva.nombre !== 'Clase'"
                              class="wrap-break-word text-gray-700"
                           >
                              {{ entrada.reserva.tipoReserva.nombre }}
                           </p>
                           <template v-if="esClase(entrada.reserva)">
                              <p v-if="entrada.reserva.sesionParalelo" class="wrap-break-word text-black">
                                 {{ nombreAsignaturaDe(entrada.reserva) }}
                              </p>
                              <p v-if="entrada.reserva.sesionParalelo" class="wrap-break-word text-gray-700">
                                 {{ entrada.reserva.sesionParalelo.paralelo.asignaturaPlan.plan.carrera.nombreCorto }}
                              </p>
                              <p v-if="profesorDe(entrada.reserva)" class="wrap-break-word text-gray-700">
                                 {{ profesorDe(entrada.reserva) }}
                              </p>
                           </template>
                           <p class="wrap-break-word text-gray-700">
                              {{ horaConSufijo(entrada.inicio) }}–{{ horaConSufijo(entrada.fin) }}
                           </p>
                        </div>
                     </td>
                  </template>
               </tr>
            </tbody>
         </table>
      </div>
   </div>
</template>

<style>
/* Tailwind no tiene utilidad para @page — única forma de fijar tamaño/márgenes de la hoja.
   Igual que /reservas/horario. */
@page {
   size: letter portrait;
   margin: 0.635cm;
}
</style>
