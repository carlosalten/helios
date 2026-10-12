<script setup lang="ts">
import type { Semestre } from '~/types/semestre'
import type { Bloque } from '~/types/bloque'
import type { Sala } from '~/types/sala'
import type { Reserva } from '~/types/reserva'
import { DIAS_SEMANA, DIAS_FIN_SEMANA } from '~/types/dia'

// Vista de solo lectura: el horario de cada sala tal como se verá en la PRIMERA semana del
// semestre seleccionado (no navega semana a semana, ni crea ni modifica reservas — eso se hace
// en /reservas/horario).

const { user } = useUserSession()
const toast = useToast()

const [
   { data: semestres },
   { data: bloquesRaw },
   { data: salas, refresh: refrescarSalas },
   { data: misSalasEncargado, refresh: refrescarMisSalas },
] = await Promise.all([
   useFetch<Semestre[]>('/api/semestres'),
   useFetch<Bloque[]>('/api/bloques'),
   useFetch<Sala[]>('/api/salas'),
   useFetch<string[]>('/api/reservas/mis-salas-encargado'),
])

/* ── Semestre ────────────────────────────────────────────────────────────── */
const { esSemestreSeleccionable, semestrePorDefecto } = useVisibilidadSemestre()
const semestreSeleccionadoId = ref<number>()
watchEffect(() => {
   if (semestreSeleccionadoId.value == null && semestres.value?.length) {
      semestreSeleccionadoId.value = semestrePorDefecto(semestres.value)?.id ?? semestres.value[0]!.id
   }
})
const opcionesSemestre = computed(() =>
   (semestres.value ?? [])
      .filter((s) => esSemestreSeleccionable(s) || s.id === semestreSeleccionadoId.value)
      .map((s) => ({ label: s.nombre, value: s.id }))
)
const semestreSeleccionado = computed(
   () => (semestres.value ?? []).find((s) => s.id === semestreSeleccionadoId.value) ?? null
)

const bloquesSemestre = computed(() =>
   (bloquesRaw.value ?? [])
      .filter((b) => b.semestreId === semestreSeleccionadoId.value)
      .sort((a, b) => a.numero - b.numero)
)

/* ── Salas: mismo alcance que /reservas/horario ─────────────────────────────
   Administrador ve todas; el resto, solo las que tiene a cargo (EncargadoSala). El backend
   aplica el mismo filtro en /api/reservas. */
const misSalasEncargadoSet = computed(() => new Set(misSalasEncargado.value ?? []))
const salasVisibles = computed(() => {
   const lista =
      user.value?.rol === 'Administrador'
         ? (salas.value ?? [])
         : (salas.value ?? []).filter((s) => misSalasEncargadoSet.value.has(s.codigo))
   return [...lista].sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
})
const busquedaSala = ref('')
const filtroTipoSala = ref<number | '__todos__'>('__todos__')
// Solo los tipos que tienen alguna sala visible, igual que /reservas/horario.
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
      const coincideBusqueda = !q || normalizarTexto(s.codigo).includes(q)
      const coincideTipo = filtroTipoSala.value === '__todos__' || s.tipoSalaId === filtroTipoSala.value
      return coincideBusqueda && coincideTipo
   })
})
const salaSeleccionada = ref<string>()
watchEffect(() => {
   if (!salasVisibles.value.some((s) => s.codigo === salaSeleccionada.value)) {
      salaSeleccionada.value = salasVisibles.value[0]?.codigo
   }
})

/* ── Primera semana del semestre ────────────────────────────────────────────
   Los 7 días desde la fecha de inicio: así cada día de la semana aparece con su primera
   ocurrencia, aunque el semestre no empiece un lunes. */
function sumarDias(d: Date, n: number) {
   const copia = new Date(d)
   copia.setDate(copia.getDate() + n)
   return copia
}
function formatFechaISO(d: Date) {
   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const MESES_ABREVIADOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function formatFechaCorta(d: Date) {
   return `${String(d.getDate()).padStart(2, '0')} ${MESES_ABREVIADOS[d.getMonth()]}`
}

const inicioSemestre = computed(() => {
   const iso = semestreSeleccionado.value?.fechaInicio.slice(0, 10)
   if (!iso) return null
   const [anio, mes, dia] = iso.split('-').map(Number)
   return new Date(anio!, mes! - 1, dia!)
})
// Fecha real de cada día, indexada por `dia.valor` (1=Lunes…7=Domingo).
const fechasSemana = computed(() => {
   const mapa = new Map<number, Date>()
   if (!inicioSemestre.value) return mapa
   for (let i = 0; i < 7; i++) {
      const fecha = sumarDias(inicioSemestre.value, i)
      mapa.set(fecha.getDay() === 0 ? 7 : fecha.getDay(), fecha)
   }
   return mapa
})
const rangoSemanaLabel = computed(() =>
   inicioSemestre.value
      ? `${formatFechaCorta(inicioSemestre.value)} — ${formatFechaCorta(sumarDias(inicioSemestre.value, 6))} ${sumarDias(inicioSemestre.value, 6).getFullYear()}`
      : ''
)

const mostrarFinSemana = ref(false)
const diasVisibles = computed(() =>
   mostrarFinSemana.value ? DIAS_SEMANA : DIAS_SEMANA.filter((d) => !DIAS_FIN_SEMANA.includes(d.valor))
)

const {
   data: reservas,
   status,
   refresh: refrescarReservas,
} = await useFetch<Reserva[]>(() => {
   if (!salaSeleccionada.value || !inicioSemestre.value) return '/api/reservas'
   const desde = formatFechaISO(inicioSemestre.value)
   const hasta = formatFechaISO(sumarDias(inicioSemestre.value, 6))
   return `/api/reservas?salaCodigo=${salaSeleccionada.value}&desde=${desde}&hasta=${hasta}`
})

/* ── Grilla: filas = bloques del semestre, columnas = días ───────────────
   Mismo armado que /horario/profesor: una reserva se ubica en los bloques que cubre y se
   estira con `rowspan`. */
function horaAMinutos(hora: string) {
   const [h, m] = hora.split(':').map(Number)
   return (h ?? 0) * 60 + (m ?? 0)
}
function horaDeISO(horaISO: string) {
   return horaISO.slice(11, 16)
}

interface EntradaCelda {
   reserva: Reserva
   inicio: string
   fin: string
}
type Celda = { tipo: 'vacia' } | { tipo: 'oculta' } | { tipo: 'reservas'; entradas: EntradaCelda[]; span: number }
interface Tramo {
   idxInicio: number
   idxFin: number
   entradas: EntradaCelda[]
}

// Mañana / tarde / vespertino — mismo criterio y colores que /reservas/horario: la mañana
// termina en el bloque marcado como último de la mañana (Bloque.esUltimoManana) y lo
// vespertino son los bloques de jornada VESPERTINA. Entre períodos se dibuja una franja de
// separación (borde superior grueso) en vez de una fila extra, que rompería los rowspan.
type Periodo = 'manana' | 'tarde' | 'vespertino'
const periodosBloque = computed<Periodo[]>(() => {
   const idxUltimoManana = bloquesSemestre.value.findIndex((b) => b.esUltimoManana)
   return bloquesSemestre.value.map((b, i) => {
      if (b.jornada === 'VESPERTINA') return 'vespertino'
      return idxUltimoManana !== -1 && i > idxUltimoManana ? 'tarde' : 'manana'
   })
})
function esInicioDePeriodo(idxBloque: number) {
   return idxBloque > 0 && periodosBloque.value[idxBloque] !== periodosBloque.value[idxBloque - 1]
}
function claseFondoPeriodo(idxBloque: number) {
   const periodo = periodosBloque.value[idxBloque]
   if (periodo === 'vespertino') return 'bg-secondary/10 dark:bg-secondary/15'
   if (periodo === 'tarde') return 'bg-muted'
   return 'bg-default'
}
const CLASE_SEPARADOR_PERIODO = 'border-t-4 border-t-usm-light dark:border-t-slate-950'

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

// Cada bloque de una clase es una reserva distinta: se fusionan las consecutivas de la misma
// actividad, salvo que cambie el profesor o que solo una parte esté suspendida (mismo criterio
// que /reservas/horario).
function mismaActividad(a: Reserva, b: Reserva) {
   return (
      a.titulo === b.titulo &&
      a.tipoReservaId === b.tipoReservaId &&
      a.personaId === b.personaId &&
      a.suspendida === b.suspendida
   )
}

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
         !esInicioDePeriodo(tramo.idxInicio) &&
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

const celdasPorDia = computed(() => {
   const mapa = new Map<number, Celda[]>()
   for (const dia of DIAS_SEMANA) {
      const celdas: Celda[] = bloquesSemestre.value.map(() => ({ tipo: 'vacia' }))
      const fecha = fechasSemana.value.get(dia.valor)
      const fechaISO = fecha ? formatFechaISO(fecha) : ''
      const delDia = (reservas.value ?? []).filter((r) => r.fecha.slice(0, 10) === fechaISO)

      const porFilaInicio = new Map<number, Tramo>()
      for (const reserva of delDia) {
         const inicio = horaDeISO(reserva.inicio)
         const fin = horaDeISO(reserva.fin)
         const idxInicio = idxBloqueInicio(horaAMinutos(inicio))
         if (idxInicio < 0 || idxInicio >= celdas.length) continue
         const idxFin = Math.max(idxInicio, idxBloqueFin(horaAMinutos(fin)))
         const entrada: EntradaCelda = { reserva, inicio, fin }
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
            tipo: 'reservas',
            entradas: tramo.entradas,
            span: tramo.idxFin - tramo.idxInicio + 1,
         }
         for (let i = tramo.idxInicio + 1; i <= tramo.idxFin && i < celdas.length; i++) celdas[i] = { tipo: 'oculta' }
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
   return celda.tipo === 'reservas' ? celda.entradas : []
}
function spanDe(diaValor: number, idxBloque: number) {
   const celda = celdaDe(diaValor, idxBloque)
   return celda.tipo === 'reservas' ? celda.span : 1
}

/* ── Contenido de cada cuadro ───────────────────────────────────────────── */
// Clases y ayudantías ocupan el bloque completo: la hora ya la dice la columna de bloques.
const TIPOS_SIN_HORA = ['Clase', 'Ayudantía']

function tituloDe(reserva: Reserva) {
   const asignatura = reserva.sesionParalelo ? asignaturaVisible(reserva.sesionParalelo.paralelo) : null
   return asignatura ? (asignatura.nombreCorto ?? asignatura.nombre) : reserva.titulo
}
function detallesDe(entrada: EntradaCelda) {
   const { reserva } = entrada
   const lineas: string[] = []
   if (!TIPOS_SIN_HORA.includes(reserva.tipoReserva.nombre)) lineas.push(`${entrada.inicio}–${entrada.fin}`)
   const paralelo = reserva.sesionParalelo?.paralelo
   if (paralelo) lineas.push(`${reserva.titulo} · ${paralelo.asignaturaPlan.plan.carrera.nombreCorto}`)
   else if (reserva.subtitulo) lineas.push(reserva.subtitulo)
   if (reserva.persona) lineas.push(`${reserva.persona.nombre} ${reserva.persona.apellido}`)
   lineas.push(reserva.tipoReserva.nombre)
   return lineas
}

// Mismo rojo que /reservas/horario para una reserva suspendida.
const COLOR_SUSPENDIDA = '#C8102E'
function estiloReserva(reserva: Reserva) {
   if (reserva.suspendida) return { borderColor: COLOR_SUSPENDIDA, backgroundColor: `${COLOR_SUSPENDIDA}1a` }
   const color = reserva.sesionParalelo?.paralelo.color ?? reserva.tipoReserva.color
   return { borderColor: `${color}66`, backgroundColor: `${color}1a` }
}

const totalReservas = computed(() => (reservas.value ?? []).length)

/* ── En vivo ─────────────────────────────────────────────────────────────
   Mismo stream que /reservas/horario. Como la vista es de solo lectura no hay formularios que
   proteger: se refresca apenas llega el aviso. Las reservas no cuelgan de un semestre
   (`semestreId` nulo); las sesiones y paralelos sí, y solo importan si son del semestre en
   pantalla (asignar sala a una sesión genera su reserva; el color del paralelo es el de la
   tarjeta). */
const { conectado: enVivo } = useHorarioTiempoReal(async (eventos) => {
   const afectaReservas = eventos.filter(
      (e) =>
         e.tipo === 'reserva' ||
         ((e.tipo === 'sesion' || e.tipo === 'paralelo') &&
            (e.semestreId === null || e.semestreId === semestreSeleccionadoId.value))
   )
   const afectaSalas = eventos.some((e) => e.tipo === 'sala')
   if (!afectaReservas.length && !afectaSalas) return

   await Promise.all([
      afectaReservas.length ? refrescarReservas() : undefined,
      afectaSalas ? Promise.all([refrescarSalas(), refrescarMisSalas()]) : undefined,
   ])

   // Solo se avisa de los cambios de otras personas: el propio autor ya vio el suyo.
   const ajenos = afectaReservas.filter((e) => e.autorEmail !== user.value?.email)
   if (!ajenos.length) return
   const autores = [...new Set(ajenos.map((e) => e.autorNombre))]
   toast.add({
      title: autores.length === 1 ? `${autores[0]} hizo cambios` : 'Varias personas hicieron cambios',
      description: 'Se actualizó el horario de salas.',
      color: 'info',
      icon: 'i-lucide-refresh-cw',
   })
}, '/horario/salas')
</script>

<template>
   <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Horario de cada sala tal como se verá en la primera semana del semestre. Solo lectura: las reservas se crean
            y modifican en Reservas → Horario de salas.
         </p>
         <div class="flex flex-col items-start gap-3 sm:shrink-0 sm:flex-row sm:items-center">
            <UTooltip
               :text="
                  enVivo
                     ? 'Los cambios de otros usuarios aparecen automáticamente'
                     : 'Sin conexión en vivo: reintentando…'
               "
            >
               <UBadge :color="enVivo ? 'success' : 'neutral'" variant="subtle" class="shrink-0">
                  <span
                     class="me-1.5 inline-block size-1.5 rounded-full"
                     :class="enVivo ? 'animate-pulse bg-current' : 'bg-current opacity-50'"
                  />
                  {{ enVivo ? 'En vivo' : 'Reconectando…' }}
               </UBadge>
            </UTooltip>
            <USwitch v-model="mostrarFinSemana" label="Mostrar fin de semana" class="shrink-0" />
         </div>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <USelectMenu
            v-model="semestreSeleccionadoId"
            :items="opcionesSemestre"
            value-key="value"
            placeholder="Selecciona un semestre…"
            :search-input="{ placeholder: 'Buscar semestre…' }"
            class="w-full sm:w-64"
         />
         <span v-if="rangoSemanaLabel" class="text-sm font-medium text-usm-text dark:text-white">
            <span class="text-usm-text-muted dark:text-slate-400">Primera semana:</span> {{ rangoSemanaLabel }}
         </span>
      </div>

      <EmptyState
         v-if="!salasVisibles.length"
         icon="i-lucide-door-open"
         message="No tienes salas asignadas. Pide a un Administrador que te agregue como encargado de una sala."
      />

      <EmptyState
         v-else-if="!bloquesSemestre.length"
         icon="i-lucide-clock"
         message="Este semestre no tiene bloques horarios. Crea bloques para poder ver el horario."
      />

      <div v-else class="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_280px] lg:items-start">
         <div class="min-w-0">
            <div class="overflow-x-auto rounded-2xl border border-default bg-default">
               <table class="w-full min-w-160 table-fixed border-collapse text-sm">
                  <thead>
                     <tr>
                        <th
                           class="w-28 border-b border-e border-usm-text-muted/25 dark:border-slate-500/40 bg-muted p-2 text-left text-xs font-semibold text-usm-text dark:text-white"
                        >
                           Bloque
                        </th>
                        <th
                           v-for="dia in diasVisibles"
                           :key="dia.valor"
                           class="border-b border-e border-usm-text-muted/25 dark:border-slate-500/40 bg-muted p-2 text-center text-xs font-semibold text-usm-text last:border-e-0 dark:text-white"
                        >
                           {{ dia.nombre }}
                           <span
                              v-if="fechasSemana.get(dia.valor)"
                              class="block font-normal text-usm-text-muted dark:text-slate-400"
                           >
                              {{ formatFechaCorta(fechasSemana.get(dia.valor)!) }}
                           </span>
                        </th>
                     </tr>
                  </thead>
                  <tbody class="[&>tr:last-child>td]:border-b-0">
                     <tr v-for="(bloque, idxBloque) in bloquesSemestre" :key="bloque.id">
                        <td
                           class="border-b border-e border-usm-text-muted/25 dark:border-slate-500/40 bg-muted p-2 align-top text-xs text-usm-text-muted dark:text-slate-400"
                           :class="esInicioDePeriodo(idxBloque) ? CLASE_SEPARADOR_PERIODO : ''"
                        >
                           <span class="font-semibold text-usm-text dark:text-white">Bloque {{ bloque.numero }}</span>
                           <span class="block">{{ horaDeISO(bloque.inicio) }}–{{ horaDeISO(bloque.fin) }}</span>
                        </td>
                        <template v-for="dia in diasVisibles" :key="`${dia.valor}-${bloque.id}`">
                           <!-- `h-px` en la celda + `h-full` en el contenedor: así el cuadro llena
                                el alto que el rowspan le dio a la celda (ver /horario/profesor). -->
                           <td
                              v-if="celdaDe(dia.valor, idxBloque).tipo !== 'oculta'"
                              :rowspan="spanDe(dia.valor, idxBloque)"
                              class="h-px border-b border-e border-usm-text-muted/25 dark:border-slate-500/40 p-1 align-top last:border-e-0"
                              :class="[
                                 claseFondoPeriodo(idxBloque),
                                 esInicioDePeriodo(idxBloque) ? CLASE_SEPARADOR_PERIODO : '',
                              ]"
                           >
                              <div class="flex h-full flex-col gap-1">
                                 <div
                                    v-for="entrada in entradasDe(dia.valor, idxBloque)"
                                    :key="entrada.reserva.id"
                                    class="flex-1 rounded-lg border p-1.5 text-xs"
                                    :style="estiloReserva(entrada.reserva)"
                                 >
                                    <p
                                       class="font-semibold text-usm-text dark:text-white"
                                       :class="{ 'line-through opacity-70': entrada.reserva.suspendida }"
                                    >
                                       {{ tituloDe(entrada.reserva) }}
                                    </p>
                                    <p
                                       v-if="entrada.reserva.suspendida"
                                       class="font-bold text-usm-text dark:text-white"
                                    >
                                       Suspendida
                                    </p>
                                    <p
                                       v-for="(linea, i) in detallesDe(entrada)"
                                       :key="i"
                                       class="text-usm-text-muted dark:text-slate-400"
                                    >
                                       {{ linea }}
                                    </p>
                                 </div>
                              </div>
                           </td>
                        </template>
                     </tr>
                  </tbody>
               </table>
            </div>

            <p v-if="status !== 'pending' && !totalReservas" class="mt-3 text-sm text-usm-text-muted">
               Esta sala no tiene reservas en la primera semana del semestre.
            </p>
            <p v-else-if="totalReservas" class="mt-3 text-xs text-usm-text-muted">
               {{ totalReservas }} reserva{{ totalReservas !== 1 ? 's' : '' }} en la primera semana.
            </p>
         </div>

         <!-- Panel de salas: en móvil va antes de la tabla, para no tener que bajar hasta el final a
              cambiar de sala. -->
         <div class="order-first lg:order-0">
            <div class="rounded-2xl border border-default bg-default p-3">
               <p class="mb-2 text-sm font-semibold text-usm-text dark:text-white">Salas</p>
               <UInput
                  v-model="busquedaSala"
                  icon="i-lucide-search"
                  placeholder="Buscar sala…"
                  size="sm"
                  class="mb-2 w-full"
               />
               <USelect
                  v-model="filtroTipoSala"
                  :items="opcionesTipoSala"
                  value-key="value"
                  size="sm"
                  class="mb-2 w-full"
               />
               <p v-if="!salasFiltradas.length" class="text-sm text-usm-text-muted dark:text-slate-400">
                  No se encontraron salas.
               </p>
               <div v-else class="max-h-96 space-y-1 overflow-y-auto pe-1">
                  <button
                     v-for="sala in salasFiltradas"
                     :key="sala.codigo"
                     type="button"
                     class="flex w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-start text-xs transition-colors"
                     :class="
                        sala.codigo === salaSeleccionada
                           ? 'border-usm-blue bg-usm-blue/10 font-semibold text-usm-blue dark:text-usm-cyan'
                           : 'border-default bg-muted text-usm-text hover:border-usm-blue/40 dark:text-slate-200'
                     "
                     @click="salaSeleccionada = sala.codigo"
                  >
                     <UIcon name="i-lucide-door-open" class="size-3 shrink-0" />
                     <span class="truncate">{{ sala.codigo }}</span>
                  </button>
               </div>
            </div>
         </div>
      </div>
   </div>
</template>
