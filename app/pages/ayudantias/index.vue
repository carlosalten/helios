<script setup lang="ts">
import type { Bloque } from '~/types/bloque'
import type { Sala } from '~/types/sala'
import type { Semestre } from '~/types/semestre'
import type { Persona } from '~/types/persona'
import type { Carrera } from '~/types/carrera'
import type { Paralelo } from '~/types/paralelo'
import type { Reserva, TipoReserva } from '~/types/reserva'
import { DIAS_SEMANA, DIAS_FIN_SEMANA } from '~/types/dia'
import { CalendarDate, type DateValue } from '@internationalized/date'
import type { DateRange } from 'reka-ui'

// Vista de laboratorios modelada sobre app/pages/reservas/horario.vue (misma grilla de 5
// minutos, misma navegación por semana, mismo patrón de edición/borrado "esta reserva" vs
// "esta y las siguientes"), pero acotada a un único propósito: agendar Ayudantías. A
// diferencia de esa página, acá no hay tipo/título libres, no hay reservas de una sola
// ocurrencia (siempre recurrentes hasta fin de semestre) y no hay drag&drop/copiar-pegar.
const toast = useToast()
const { user } = useUserSession()

const [
   { data: semestres },
   { data: bloquesRaw },
   { data: salasRaw },
   { data: personas },
   { data: tiposReserva },
   { data: misSalasEncargado },
   { data: carreras },
   { data: paralelosRaw },
] = await Promise.all([
   useFetch<Semestre[]>('/api/semestres'),
   useFetch<Bloque[]>('/api/bloques'),
   useFetch<Sala[]>('/api/salas'),
   useFetch<Persona[]>('/api/personas'),
   useFetch<TipoReserva[]>('/api/reservas/tipos'),
   useFetch<string[]>('/api/reservas/mis-salas-encargado'),
   useFetch<Carrera[]>('/api/carreras'),
   useFetch<Paralelo[]>('/api/paralelos'),
])

const { puedeCrear, puedeEditar } = usePermiso('/ayudantias')

// El id de "Ayudantía" se busca en runtime por nombre (nunca hardcodeado): el tipo ya existe
// como dato administrable en /reservas/tipos.
const tipoAyudantia = computed(() => tiposReserva.value?.find((t) => t.nombre === 'Ayudantía') ?? null)

/* ── Alcance para modificar una reserva ─────────────────────
   Mismo criterio que server/utils/alcanceReservas.ts (no se tocó ese archivo — alcance
   "acotado" confirmado con el usuario): Administrador siempre puede; cualquiera puede
   modificar sus propias reservas no-clase (toda Ayudantía creada acá tiene
   sesionParaleloId=null, así que nunca es "de clase"); Apoyo Docente además puede modificar
   cualquier reserva de una sala de la que sea encargado. */
const misSalasEncargadoSet = computed(() => new Set(misSalasEncargado.value ?? []))

function puedeModificarReserva(reserva: Reserva) {
   if (!puedeEditar.value || !user.value) return false
   if (user.value.rol === 'Administrador') return true
   if (reserva.personaId === user.value.personaId) return true
   if (user.value.rol === 'Apoyo Docente' && misSalasEncargadoSet.value.has(reserva.salaCodigo)) return true
   return false
}

// Esta vista solo administra Ayudantías: una reserva de otro tipo puede aparecer en la
// grilla (para no ocultar que el laboratorio está ocupado), pero no se abre para editar/borrar
// desde acá — eso sigue siendo trabajo de /reservas/horario.
function esAyudantia(reserva: Reserva) {
   return reserva.tipoReserva.nombre === 'Ayudantía'
}

/* ── Semestre vigente: define la plantilla horaria y hasta cuándo se repite una ayudantía
   nueva (Semestre.fechaFin). Sin selector — siempre el vigente. ── */
const semestreVigente = computed(() => semestres.value?.find((s) => s.vigente) ?? semestres.value?.[0] ?? null)

const bloquesSemestre = computed(() =>
   (bloquesRaw.value ?? [])
      .filter((b) => b.semestreId === semestreVigente.value?.id)
      .sort((a, b) => a.numero - b.numero)
)

/* ── Sala: solo laboratorios ─────────────────────────────── */
const salas = computed(() => (salasRaw.value ?? []).filter((s) => s.tipoSala.nombre === 'Laboratorio'))

const salasVisibles = computed(() => {
   if (user.value?.rol === 'Administrador') return salas.value
   return salas.value.filter((s) => misSalasEncargadoSet.value.has(s.codigo))
})

const salaSeleccionada = ref<string>()
watchEffect(() => {
   if (!salasVisibles.value.some((s) => s.codigo === salaSeleccionada.value)) {
      salaSeleccionada.value = salasVisibles.value[0]?.codigo
   }
})
const salaActual = computed(() => salasVisibles.value.find((s) => s.codigo === salaSeleccionada.value) ?? null)

const busquedaSala = ref('')
const salasFiltradas = computed(() => {
   const q = normalizarTexto(busquedaSala.value.trim())
   return salasVisibles.value.filter((s) => !q || normalizarTexto(s.codigo).includes(q))
})

/* ── Ayudante: personas con rol Ayudante, activas ───────────── */
const ayudantes = computed(() => (personas.value ?? []).filter((p) => p.activo && p.rol?.nombre === 'Ayudante'))
const itemsAyudante = computed(() => ayudantes.value.map((p) => ({ label: `${p.nombre} ${p.apellido}`, value: p.id })))

/* ── Carrera → Asignatura → Paralelo (solo paralelos del semestre vigente) ───────────────
   Reserva no guarda FK a asignatura/paralelo/carrera: título/subtítulo se calculan al crear
   y quedan como texto. Por eso la cascada solo se usa para CREAR, nunca para editar (ver
   sección "Editar ayudantía" más abajo). */
const paralelosSemestre = computed(() =>
   (paralelosRaw.value ?? []).filter((p) => p.curso.semestreId === semestreVigente.value?.id)
)

const itemsCarrera = computed(() =>
   (carreras.value ?? [])
      .map((c) => ({ label: c.nombre, value: c.codigo }))
      .sort((a, b) => a.label.localeCompare(b.label))
)

function asignaturasDeCarrera(carreraCodigo: number | undefined) {
   if (carreraCodigo == null) return []
   const vistas = new Map<number, Paralelo['asignaturaPlan']['asignatura']>()
   for (const p of paralelosSemestre.value) {
      if (p.asignaturaPlan.plan.carreraCodigo !== carreraCodigo) continue
      if (!vistas.has(p.asignaturaPlan.asignaturaId))
         vistas.set(p.asignaturaPlan.asignaturaId, p.asignaturaPlan.asignatura)
   }
   return Array.from(vistas.values()).sort((a, b) => a.codigo.localeCompare(b.codigo))
}

function paralelosDeAsignatura(carreraCodigo: number | undefined, asignaturaId: number | undefined) {
   if (carreraCodigo == null || asignaturaId == null) return []
   return paralelosSemestre.value
      .filter(
         (p) => p.asignaturaPlan.plan.carreraCodigo === carreraCodigo && p.asignaturaPlan.asignaturaId === asignaturaId
      )
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
}

/* ── Fin de semana ───────────────────────────────────────── */
const mostrarFinSemana = ref(false)
const diasVisibles = computed(() =>
   mostrarFinSemana.value ? DIAS_SEMANA : DIAS_SEMANA.filter((d) => !DIAS_FIN_SEMANA.includes(d.valor))
)

/* ── Navegación por semana (idéntico a reservas/horario.vue) ───────────────────────── */
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
function formatFechaDisplay(d: Date) {
   const [anio, mes, dia] = formatFechaISO(d).split('-')
   return `${dia}-${mes}-${anio}`
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

/* ── Franjas de 5 minutos (idéntico a reservas/horario.vue) ─────────────────────────── */
type Periodo = 'manana' | 'tarde' | 'vespertino'
interface Franja {
   indice: number
   horaInicio: string
   horaFin: string
   periodo: Periodo
}

function horaDeISO(horaISO: string) {
   return horaISO.slice(11, 16)
}
function horaAMinutos(hora: string) {
   const [h, m] = hora.split(':').map(Number)
   return h! * 60 + m!
}
function minutosAHora(min: number) {
   const h = Math.floor(min / 60)
   const m = min % 60
   return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const finManana = computed(() => {
   const b = bloquesSemestre.value.find((x) => x.esUltimoManana)
   return b ? horaDeISO(b.fin) : null
})
const inicioVespertina = computed(() => {
   const b = bloquesSemestre.value.find((x) => x.jornada === 'VESPERTINA')
   return b ? horaDeISO(b.inicio) : null
})
function periodoDe(minutos: number): Periodo {
   if (inicioVespertina.value && minutos >= horaAMinutos(inicioVespertina.value)) return 'vespertino'
   if (finManana.value && minutos >= horaAMinutos(finManana.value)) return 'tarde'
   return 'manana'
}

const franjas = computed<Franja[]>(() => {
   if (!bloquesSemestre.value.length) return []
   const horas = bloquesSemestre.value.flatMap((b) => [horaDeISO(b.inicio), horaDeISO(b.fin)])
   const inicioMin = Math.min(...horas.map(horaAMinutos))
   const finMin = Math.max(...horas.map(horaAMinutos))
   const lista: Franja[] = []
   let indice = 0
   for (let m = inicioMin; m < finMin; m += 5) {
      lista.push({ indice, horaInicio: minutosAHora(m), horaFin: minutosAHora(m + 5), periodo: periodoDe(m) })
      indice++
   }
   return lista
})
function muestraEtiqueta(franja: Franja) {
   return franja.horaInicio.endsWith(':00') || franja.horaInicio.endsWith(':30')
}
function esLimiteMediaHora(hora: string) {
   return hora.endsWith(':00') || hora.endsWith(':30')
}

/* ── Reservas de la sala en la semana visible ───────────────────────────────────────── */
const {
   data: reservas,
   status,
   refresh: refrescarReservas,
} = await useFetch<Reserva[]>(() => {
   if (!salaSeleccionada.value) return '/api/reservas'
   const desde = formatFechaISO(semanaInicio.value)
   const hasta = formatFechaISO(sumarDias(semanaInicio.value, 6))
   return `/api/reservas?salaCodigo=${salaSeleccionada.value}&desde=${desde}&hasta=${hasta}`
})

/* ── Grilla (idéntica a reservas/horario.vue: clusters + columnas para solapes) ─────── */
interface ReservaPosicionada {
   reserva: Reserva
   columna: number
   totalColumnas: number
   offsetInicioMin: number
   duracionMin: number
}
type Celda = { tipo: 'vacia' } | { tipo: 'oculta' } | { tipo: 'cluster'; span: number; reservas: ReservaPosicionada[] }

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

function asignarColumnas(cluster: Reserva[]) {
   const ordenadas = [...cluster].sort((a, b) => horaAMinutos(horaDeISO(a.inicio)) - horaAMinutos(horaDeISO(b.inicio)))
   const finesColumna: number[] = []
   const columnaDe = new Map<number, number>()
   for (const r of ordenadas) {
      const inicioMin = horaAMinutos(horaDeISO(r.inicio))
      const finMin = horaAMinutos(horaDeISO(r.fin))
      let columna = finesColumna.findIndex((f) => f <= inicioMin)
      if (columna === -1) {
         columna = finesColumna.length
         finesColumna.push(finMin)
      } else {
         finesColumna[columna] = finMin
      }
      columnaDe.set(r.id, columna)
   }
   return { columnaDe, totalColumnas: finesColumna.length }
}

const gridPorDia = computed(() => {
   const mapa = new Map<number, Celda[]>()
   for (const dia of DIAS_SEMANA) {
      const fecha = fechasSemana.value.get(dia.valor)
      const fechaISO = fecha ? formatFechaISO(fecha) : ''
      const celdas: Celda[] = franjas.value.map(() => ({ tipo: 'vacia' }))
      const reservasDia = (reservas.value ?? []).filter((r) => r.fecha.slice(0, 10) === fechaISO)
      for (const cluster of agruparEnClusters(reservasDia)) {
         const clusterInicioMin = Math.min(...cluster.map((r) => horaAMinutos(horaDeISO(r.inicio))))
         const clusterFinMin = Math.max(...cluster.map((r) => horaAMinutos(horaDeISO(r.fin))))
         const idxInicio = franjas.value.findIndex((f) => horaAMinutos(f.horaInicio) === clusterInicioMin)
         if (idxInicio === -1) continue
         const span = Math.max(1, Math.round((clusterFinMin - clusterInicioMin) / 5))
         const { columnaDe, totalColumnas } = asignarColumnas(cluster)
         const reservasPosicionadas: ReservaPosicionada[] = cluster.map((r) => ({
            reserva: r,
            columna: columnaDe.get(r.id)!,
            totalColumnas,
            offsetInicioMin: horaAMinutos(horaDeISO(r.inicio)) - clusterInicioMin,
            duracionMin: horaAMinutos(horaDeISO(r.fin)) - horaAMinutos(horaDeISO(r.inicio)),
         }))
         celdas[idxInicio] = { tipo: 'cluster', span, reservas: reservasPosicionadas }
         for (let i = idxInicio + 1; i < idxInicio + span && i < celdas.length; i++) {
            celdas[i] = { tipo: 'oculta' }
         }
      }
      mapa.set(dia.valor, celdas)
   }
   return mapa
})

function celdaDe(diaValor: number, franjaIndice: number): Celda {
   return gridPorDia.value.get(diaValor)?.[franjaIndice] ?? { tipo: 'vacia' }
}
function reservasEnCelda(diaValor: number, franjaIndice: number): ReservaPosicionada[] {
   const celda = celdaDe(diaValor, franjaIndice)
   return celda.tipo === 'cluster' ? celda.reservas : []
}
function rowspanDe(diaValor: number, franjaIndice: number) {
   const celda = celdaDe(diaValor, franjaIndice)
   return celda.tipo === 'cluster' ? celda.span : 1
}
function terminaEnMediaHora(diaValor: number, franjaIndice: number) {
   const span = rowspanDe(diaValor, franjaIndice)
   const franjaFinal = franjas.value[franjaIndice + span - 1]
   return franjaFinal ? esLimiteMediaHora(franjaFinal.horaFin) : false
}
function claseCeldaDia(diaValor: number, franja: Franja) {
   if (DIAS_FIN_SEMANA.includes(diaValor)) return 'bg-gray-50 dark:bg-slate-800/40'
   if (franja.periodo === 'vespertino') return 'bg-secondary/10 dark:bg-secondary/15'
   if (franja.periodo === 'tarde') return 'bg-muted'
   return 'bg-default'
}

const COLOR_CANCELADA = '#C8102E'
function estiloReserva(reserva: Reserva) {
   if (reserva.cancelada) return { borderColor: COLOR_CANCELADA, backgroundColor: `${COLOR_CANCELADA}33` }
   return { borderColor: reserva.tipoReserva.color, backgroundColor: `${reserva.tipoReserva.color}1A` }
}
function estiloPosicion(rp: ReservaPosicionada) {
   return {
      top: `${(rp.offsetInicioMin / 5) * 10}px`,
      height: `${(rp.duracionMin / 5) * 10}px`,
      left: `${(rp.columna / rp.totalColumnas) * 100}%`,
      width: `${(1 / rp.totalColumnas) * 100}%`,
   }
}
function estiloBadgeTipo(reserva: Reserva) {
   if (reserva.cancelada) return { backgroundColor: `${COLOR_CANCELADA}26`, color: COLOR_CANCELADA }
   return { backgroundColor: `${reserva.tipoReserva.color}26`, color: reserva.tipoReserva.color }
}
function textoBadgeTipo(reserva: Reserva) {
   return reserva.cancelada ? 'Cancelada' : reserva.tipoReserva.nombre
}

function enmascararHora(valor: string) {
   const digitos = valor.replace(/\D/g, '').slice(0, 4)
   if (digitos.length <= 2) return digitos
   return `${digitos.slice(0, 2)}:${digitos.slice(2)}`
}

/* ── Crear ayudantía (click sobre una celda vacía) ──────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({
   carreraCodigo: undefined as number | undefined,
   asignaturaId: undefined as number | undefined,
   paraleloId: undefined as number | undefined,
   personaId: 0,
   fecha: '',
   modoHorario: 'libre' as 'bloque' | 'libre',
   bloqueInicioId: undefined as number | undefined,
   bloqueTerminoId: undefined as number | undefined,
   inicio: '',
   fin: '',
})
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

const itemsAsignaturaCrear = computed(() =>
   asignaturasDeCarrera(formCrear.carreraCodigo).map((a) => ({ label: `${a.codigo} · ${a.nombre}`, value: a.id }))
)
const itemsParaleloCrear = computed(() =>
   paralelosDeAsignatura(formCrear.carreraCodigo, formCrear.asignaturaId).map((p) => ({
      label: `Paralelo ${p.codigo}`,
      value: p.id,
   }))
)
const itemsBloque = computed(() =>
   bloquesSemestre.value.map((b) => ({
      label: `Bloque ${b.numero} (${horaDeISO(b.inicio)}–${horaDeISO(b.fin)})`,
      value: b.id,
   }))
)

// Al cambiar carrera/asignatura, se limpia el paso siguiente para no dejar seleccionado un
// paralelo que ya no corresponde.
watch(
   () => formCrear.carreraCodigo,
   () => {
      formCrear.asignaturaId = undefined
      formCrear.paraleloId = undefined
   }
)
watch(
   () => formCrear.asignaturaId,
   () => {
      formCrear.paraleloId = undefined
   }
)

function abrirCrear(diaValor: number, franja: Franja) {
   if (!puedeCrear.value || !salaSeleccionada.value || !tipoAyudantia.value) return
   if (celdaDe(diaValor, franja.indice).tipo !== 'vacia') return

   const fecha = fechasSemana.value.get(diaValor)
   if (!fecha) return

   const ultimaFranja = franjas.value[franjas.value.length - 1]
   const finMaximo = ultimaFranja ? horaAMinutos(ultimaFranja.horaFin) : horaAMinutos(franja.horaFin)
   const finSugerido = Math.min(horaAMinutos(franja.horaInicio) + 30, finMaximo)

   formCrear.carreraCodigo = undefined
   formCrear.asignaturaId = undefined
   formCrear.paraleloId = undefined
   formCrear.personaId = ayudantes.value[0]?.id ?? 0
   formCrear.fecha = formatFechaISO(fecha)
   formCrear.modoHorario = 'libre'
   formCrear.bloqueInicioId = undefined
   formCrear.bloqueTerminoId = undefined
   formCrear.inicio = franja.horaInicio
   formCrear.fin = minutosAHora(finSugerido)
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

const bloqueInicioSel = computed(() => bloquesSemestre.value.find((b) => b.id === formCrear.bloqueInicioId) ?? null)
const bloqueTerminoSel = computed(() => bloquesSemestre.value.find((b) => b.id === formCrear.bloqueTerminoId) ?? null)

const puedeEnviarCrear = computed(() => {
   if (guardando.value) return false
   if (!formCrear.carreraCodigo || !formCrear.asignaturaId || !formCrear.paraleloId) return false
   if (!formCrear.personaId || !formCrear.fecha) return false
   if (formCrear.modoHorario === 'bloque') return !!bloqueInicioSel.value && !!bloqueTerminoSel.value
   return !!formCrear.inicio && !!formCrear.fin
})

async function guardar() {
   if (!puedeEnviarCrear.value || !salaSeleccionada.value || !tipoAyudantia.value || !semestreVigente.value) return
   const asignatura = asignaturasDeCarrera(formCrear.carreraCodigo).find((a) => a.id === formCrear.asignaturaId)
   const paralelo = paralelosDeAsignatura(formCrear.carreraCodigo, formCrear.asignaturaId).find(
      (p) => p.id === formCrear.paraleloId
   )
   if (!asignatura || !paralelo) return

   const inicio = formCrear.modoHorario === 'bloque' ? horaDeISO(bloqueInicioSel.value!.inicio) : formCrear.inicio
   const fin = formCrear.modoHorario === 'bloque' ? horaDeISO(bloqueTerminoSel.value!.fin) : formCrear.fin

   guardando.value = true
   errorGuardar.value = null
   try {
      const resultado = await $fetch<{ ok: true; cantidad: number }>('/api/reservas/recurrente', {
         method: 'POST',
         body: {
            salaCodigo: salaSeleccionada.value,
            titulo: `${asignatura.codigo}-${paralelo.codigo}`,
            subtitulo: asignatura.nombreCorto ?? asignatura.nombre,
            paraleloId: paralelo.id,
            fecha: formCrear.fecha,
            repetirHasta: semestreVigente.value.fechaFin.slice(0, 10),
            inicio,
            fin,
            tipoReservaId: tipoAyudantia.value.id,
            personaId: Number(formCrear.personaId),
            publica: tipoAyudantia.value.publicaPorDefecto,
         },
      })
      modalCrearMostrar.value = false
      await refrescarReservas()
      toast.add({
         title: `${resultado.cantidad} ayudantías creadas`,
         color: 'success',
         icon: 'i-lucide-check-circle',
      })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Detalle / borrar ayudantía ──────────────────────────────────────────────────────── */
const modalDetalleMostrar = ref(false)
const reservaSeleccionada = ref<Reserva | null>(null)
const borrando = ref(false)
const confirmBorrarMostrar = ref(false)
const confirmBorrarSerieMostrar = ref(false)

function abrirDetalle(reserva: Reserva) {
   if (!esAyudantia(reserva)) return
   reservaSeleccionada.value = reserva
   modalDetalleMostrar.value = true
}

function abrirConfirmBorrar(reserva: Reserva) {
   reservaSeleccionada.value = reserva
   if (reserva.serieId) {
      confirmBorrarSerieMostrar.value = true
   } else {
      confirmBorrarMostrar.value = true
   }
}

async function borrarReserva(alcance: 'solo' | 'serie' = 'solo') {
   if (!reservaSeleccionada.value) return
   borrando.value = true
   try {
      const url =
         alcance === 'serie'
            ? `/api/reservas/${reservaSeleccionada.value.id}/serie`
            : `/api/reservas/${reservaSeleccionada.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmBorrarMostrar.value = false
      confirmBorrarSerieMostrar.value = false
      modalDetalleMostrar.value = false
      await refrescarReservas()
      toast.add({ title: 'Ayudantía borrada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al borrar'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      borrando.value = false
   }
}

/* ── Editar ayudantía ─────────────────────────────────────────────────────────────────
   Reserva no guarda a qué carrera/asignatura/paralelo corresponde (solo quedan como texto
   en título/subtítulo) — no hay forma confiable de reconstruir esos tres selects al editar.
   Por eso acá solo se puede cambiar el ayudante y el horario; título/subtítulo se muestran
   como contexto de solo lectura y se reenvían sin cambios. */
const modalEditarMostrar = ref(false)
const reservaEditar = ref<Reserva | null>(null)
const formEditar = reactive({
   personaId: 0,
   modoHorario: 'libre' as 'bloque' | 'libre',
   bloqueInicioId: undefined as number | undefined,
   bloqueTerminoId: undefined as number | undefined,
   inicio: '',
   fin: '',
})
const errorEditar = ref<string | null>(null)
const confirmAlcanceEditarMostrar = ref(false)

function abrirEditar(reserva: Reserva) {
   reservaEditar.value = reserva
   formEditar.personaId = reserva.personaId ?? 0
   formEditar.inicio = horaDeISO(reserva.inicio)
   formEditar.fin = horaDeISO(reserva.fin)
   // Si el horario actual calza exacto con un par de bloques, se precarga en modo "por
   // bloque"; si no (se ingresó con hora libre), se precarga en modo "hora libre".
   const bi = bloquesSemestre.value.find((b) => horaDeISO(b.inicio) === formEditar.inicio)
   const bt = bloquesSemestre.value.find((b) => horaDeISO(b.fin) === formEditar.fin)
   if (bi && bt) {
      formEditar.modoHorario = 'bloque'
      formEditar.bloqueInicioId = bi.id
      formEditar.bloqueTerminoId = bt.id
   } else {
      formEditar.modoHorario = 'libre'
      formEditar.bloqueInicioId = undefined
      formEditar.bloqueTerminoId = undefined
   }
   errorEditar.value = null
   modalDetalleMostrar.value = false
   modalEditarMostrar.value = true
}

const bloqueInicioSelEditar = computed(
   () => bloquesSemestre.value.find((b) => b.id === formEditar.bloqueInicioId) ?? null
)
const bloqueTerminoSelEditar = computed(
   () => bloquesSemestre.value.find((b) => b.id === formEditar.bloqueTerminoId) ?? null
)

const puedeEnviarEditar = computed(() => {
   if (guardando.value || !formEditar.personaId) return false
   if (formEditar.modoHorario === 'bloque') return !!bloqueInicioSelEditar.value && !!bloqueTerminoSelEditar.value
   return !!formEditar.inicio && !!formEditar.fin
})

function guardarEditar() {
   if (!reservaEditar.value || !puedeEnviarEditar.value) return
   if (reservaEditar.value.serieId) {
      confirmAlcanceEditarMostrar.value = true
      return
   }
   ejecutarGuardarEditar('solo')
}

async function ejecutarGuardarEditar(alcance: 'solo' | 'serie') {
   if (!reservaEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const inicio =
         formEditar.modoHorario === 'bloque' ? horaDeISO(bloqueInicioSelEditar.value!.inicio) : formEditar.inicio
      const fin = formEditar.modoHorario === 'bloque' ? horaDeISO(bloqueTerminoSelEditar.value!.fin) : formEditar.fin
      const url =
         alcance === 'serie'
            ? `/api/reservas/${reservaEditar.value.id}/serie`
            : `/api/reservas/${reservaEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: {
            salaCodigo: reservaEditar.value.salaCodigo,
            titulo: reservaEditar.value.titulo,
            subtitulo: reservaEditar.value.subtitulo,
            paraleloId: reservaEditar.value.paraleloId,
            fecha: reservaEditar.value.fecha.slice(0, 10),
            inicio,
            fin,
            tipoReservaId: reservaEditar.value.tipoReservaId,
            personaId: Number(formEditar.personaId) || null,
            publica: reservaEditar.value.publica,
         },
      })
      confirmAlcanceEditarMostrar.value = false
      modalEditarMostrar.value = false
      await refrescarReservas()
      toast.add({ title: 'Ayudantía actualizada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}
</script>

<template>
   <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Horario de ayudantías por laboratorio. Haz click en una celda vacía para agendar una — queda recurrente cada
            semana hasta el fin del semestre vigente.
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
         <div class="flex flex-wrap items-center gap-3">
            <span
               v-if="salaActual"
               class="inline-flex items-center gap-1.5 rounded-full bg-usm-blue/10 px-3 py-1 text-sm font-semibold text-usm-blue dark:bg-usm-cyan/10 dark:text-usm-cyan"
            >
               <UIcon name="i-lucide-door-open" class="size-3.5" />
               {{ salaActual.codigo }}
            </span>
            <span class="text-sm font-medium text-usm-text dark:text-white">
               <span class="text-usm-text-muted dark:text-slate-400">Semana:</span> {{ rangoSemanaLabel }}
            </span>
         </div>
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
         </div>
      </div>

      <EmptyState
         v-if="!salas.length"
         icon="i-lucide-door-open"
         message="No hay laboratorios registrados (salas con tipo 'Laboratorio')."
      />
      <EmptyState
         v-else-if="!salasVisibles.length"
         icon="i-lucide-door-open"
         message="No tienes laboratorios asignados. Pide a un Administrador que te agregue como encargado de una sala."
      />
      <div v-else class="flex flex-col gap-3 lg:flex-row">
         <!-- Panel de laboratorios -->
         <div class="order-2 flex w-full flex-col rounded-2xl border border-default bg-default lg:w-72 lg:shrink-0">
            <div class="border-b border-default p-3">
               <UInput v-model="busquedaSala" icon="i-lucide-search" placeholder="Buscar laboratorio…" class="w-full" />
            </div>
            <div class="max-h-64 min-h-0 flex-1 divide-y divide-default overflow-y-auto lg:max-h-none">
               <button
                  v-for="sala in salasFiltradas"
                  :key="sala.codigo"
                  type="button"
                  class="block w-full border-s-4 px-3 py-2.5 text-left transition-colors hover:bg-elevated/50"
                  :class="
                     salaSeleccionada === sala.codigo
                        ? 'border-s-usm-blue bg-info-50 dark:border-s-usm-cyan dark:bg-usm-cyan/10'
                        : 'border-s-transparent'
                  "
                  @click="salaSeleccionada = sala.codigo"
               >
                  <p
                     class="truncate text-sm font-medium"
                     :class="
                        salaSeleccionada === sala.codigo
                           ? 'text-usm-blue dark:text-usm-cyan'
                           : 'text-usm-text dark:text-white'
                     "
                  >
                     {{ sala.codigo }}
                  </p>
                  <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">{{ sala.capacidad }} personas</p>
               </button>
               <p v-if="!salasFiltradas.length" class="p-4 text-center text-xs text-usm-text-muted dark:text-slate-400">
                  Sin resultados
               </p>
            </div>
         </div>

         <!-- Matriz -->
         <div class="order-1 min-w-0 flex-1">
            <EmptyState
               v-if="!bloquesSemestre.length"
               icon="i-lucide-clock"
               message="Este semestre no tiene bloques horarios definidos. Crea bloques para armar la plantilla de horas."
            />
            <div v-else class="overflow-x-auto rounded-2xl border border-default bg-default">
               <table class="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                     <tr>
                        <th
                           class="sticky left-0 z-20 w-16 border-b border-default border-e-2 border-e-usm-text-muted/30 bg-muted p-1 text-left text-xs font-semibold text-usm-text-muted dark:border-e-slate-500/50 dark:text-slate-400"
                        >
                           Hora
                        </th>
                        <th
                           v-for="dia in diasVisibles"
                           :key="dia.valor"
                           class="border-b border-default border-e-2 border-e-usm-text-muted/30 p-2 text-center text-xs font-semibold last:border-e-0 dark:border-e-slate-500/50"
                           :class="
                              DIAS_FIN_SEMANA.includes(dia.valor)
                                 ? 'bg-gray-100 text-usm-text-muted dark:bg-slate-800 dark:text-slate-400'
                                 : 'bg-muted text-usm-text dark:text-white'
                           "
                        >
                           <div>{{ dia.nombre }}</div>
                           <div class="font-normal text-usm-text-muted dark:text-slate-400">
                              {{ formatFechaCorta(fechasSemana.get(dia.valor)!) }}
                           </div>
                        </th>
                     </tr>
                  </thead>
                  <tbody>
                     <template v-for="franja in franjas" :key="franja.indice">
                        <tr>
                           <th
                              class="sticky left-0 z-10 h-2.5 border-e-2 border-e-usm-text-muted/30 bg-muted p-0 text-right align-top text-[10px] font-normal text-usm-text-muted dark:border-e-slate-500/50 dark:text-slate-400"
                              :class="
                                 esLimiteMediaHora(franja.horaFin)
                                    ? 'border-b border-b-usm-text-muted/25 dark:border-b-slate-500/40'
                                    : ''
                              "
                           >
                              <span v-if="muestraEtiqueta(franja)" class="block -translate-y-1.5 pe-1">{{
                                 franja.horaInicio
                              }}</span>
                           </th>
                           <template v-for="dia in diasVisibles" :key="dia.valor">
                              <td
                                 v-if="celdaDe(dia.valor, franja.indice).tipo !== 'oculta'"
                                 :rowspan="rowspanDe(dia.valor, franja.indice)"
                                 class="h-2.5 border-e-2 border-e-usm-text-muted/30 p-0 align-top transition-colors last:border-e-0 dark:border-e-slate-500/50"
                                 :class="[
                                    claseCeldaDia(dia.valor, franja),
                                    terminaEnMediaHora(dia.valor, franja.indice)
                                       ? 'border-b border-b-usm-text-muted/25 dark:border-b-slate-500/40'
                                       : '',
                                    celdaDe(dia.valor, franja.indice).tipo === 'vacia' && puedeCrear
                                       ? 'cursor-pointer hover:bg-usm-blue/10'
                                       : '',
                                 ]"
                                 @click="abrirCrear(dia.valor, franja)"
                              >
                                 <div class="relative h-full">
                                    <div
                                       v-for="rp in reservasEnCelda(dia.valor, franja.indice)"
                                       :key="rp.reserva.id"
                                       class="absolute box-border overflow-hidden rounded-md border p-1 text-[11px] leading-tight text-usm-text dark:text-slate-100"
                                       :class="esAyudantia(rp.reserva) ? 'cursor-pointer' : ''"
                                       :style="[estiloPosicion(rp), estiloReserva(rp.reserva)]"
                                       @click.stop="abrirDetalle(rp.reserva)"
                                    >
                                       <div class="flex items-start justify-between gap-1">
                                          <span
                                             class="inline-block min-w-0 truncate rounded-full px-1.5 py-0.5 text-[9.5px] leading-none font-medium"
                                             :style="estiloBadgeTipo(rp.reserva)"
                                          >
                                             {{ textoBadgeTipo(rp.reserva) }}
                                          </span>
                                          <span
                                             class="shrink-0 text-[9.5px] leading-none font-semibold whitespace-nowrap"
                                          >
                                             {{ horaDeISO(rp.reserva.inicio) }}–{{ horaDeISO(rp.reserva.fin) }}
                                          </span>
                                       </div>
                                       <span
                                          class="inline-flex min-w-0 items-center gap-1 truncate text-xs font-bold"
                                          :class="rp.reserva.cancelada ? 'line-through opacity-70' : ''"
                                       >
                                          <UIcon
                                             v-if="rp.reserva.serieId"
                                             name="i-lucide-repeat"
                                             class="size-3 shrink-0"
                                             title="Ayudantía recurrente"
                                          />
                                          <span class="truncate">{{ rp.reserva.titulo }}</span>
                                       </span>
                                       <div v-if="rp.reserva.subtitulo" class="truncate">
                                          {{ rp.reserva.subtitulo }}
                                       </div>
                                    </div>
                                 </div>
                              </td>
                           </template>
                        </tr>
                     </template>
                  </tbody>
               </table>
            </div>
         </div>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="4" />

      <!-- Modal crear ayudantía -->
      <UModal
         v-model:open="modalCrearMostrar"
         :title="`Nueva ayudantía — ${salaActual?.codigo}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm id="form-ayudantia-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Carrera" name="carreraCodigo">
                  <USelectMenu
                     v-model="formCrear.carreraCodigo"
                     :items="itemsCarrera"
                     value-key="value"
                     placeholder="Selecciona una carrera…"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Asignatura" name="asignaturaId">
                  <UAlert
                     v-if="formCrear.carreraCodigo != null && !itemsAsignaturaCrear.length"
                     icon="i-lucide-alert-triangle"
                     color="warning"
                     variant="subtle"
                     description="Esta carrera no tiene asignaturas con paralelos activos en el semestre vigente."
                  />
                  <USelectMenu
                     v-else
                     v-model="formCrear.asignaturaId"
                     :items="itemsAsignaturaCrear"
                     value-key="value"
                     :disabled="formCrear.carreraCodigo == null"
                     placeholder="Selecciona una asignatura…"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Paralelo" name="paraleloId">
                  <USelectMenu
                     v-model="formCrear.paraleloId"
                     :items="itemsParaleloCrear"
                     value-key="value"
                     :disabled="formCrear.asignaturaId == null"
                     placeholder="Selecciona un paralelo…"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Ayudante" name="personaId">
                  <UAlert
                     v-if="!itemsAyudante.length"
                     icon="i-lucide-alert-triangle"
                     color="warning"
                     variant="subtle"
                     description="No hay personas con rol Ayudante registradas."
                  />
                  <USelectMenu
                     v-else
                     v-model="formCrear.personaId"
                     :items="itemsAyudante"
                     value-key="value"
                     :search-input="{ placeholder: 'Buscar ayudante…' }"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Fecha de la primera ayudantía" name="fecha">
                  <UInput v-model="formCrear.fecha" type="date" class="w-full" />
               </UFormField>
               <UFormField
                  label="Horario"
                  description="Se repite todas las semanas a esta misma hora hasta el fin del semestre vigente."
               >
                  <UTabs
                     v-model="formCrear.modoHorario"
                     :items="[
                        { label: 'Por bloque', value: 'bloque' },
                        { label: 'Hora libre', value: 'libre' },
                     ]"
                     :content="false"
                  />
               </UFormField>
               <div v-if="formCrear.modoHorario === 'bloque'" class="grid grid-cols-2 gap-4">
                  <UFormField label="Bloque de inicio" name="bloqueInicioId">
                     <USelectMenu
                        v-model="formCrear.bloqueInicioId"
                        :items="itemsBloque"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
                  <UFormField label="Bloque de término" name="bloqueTerminoId">
                     <USelectMenu
                        v-model="formCrear.bloqueTerminoId"
                        :items="itemsBloque"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
               </div>
               <div v-else class="grid grid-cols-2 gap-4">
                  <UFormField label="Hora de inicio" name="inicio">
                     <UInput
                        :model-value="formCrear.inicio"
                        placeholder="14:30"
                        maxlength="5"
                        icon="i-lucide-clock"
                        class="w-full"
                        @update:model-value="formCrear.inicio = enmascararHora(String($event))"
                     />
                  </UFormField>
                  <UFormField label="Hora de término" name="fin">
                     <UInput
                        :model-value="formCrear.fin"
                        placeholder="15:00"
                        maxlength="5"
                        icon="i-lucide-clock"
                        class="w-full"
                        @update:model-value="formCrear.fin = enmascararHora(String($event))"
                     />
                  </UFormField>
               </div>
               <UAlert
                  v-if="errorGuardar"
                  icon="i-lucide-alert-circle"
                  color="error"
                  variant="subtle"
                  :description="errorGuardar"
               />
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
            <UButton type="submit" form="form-ayudantia-crear" :loading="guardando" :disabled="!puedeEnviarCrear">
               Guardar
            </UButton>
         </template>
      </UModal>

      <!-- Modal detalle / borrar ayudantía -->
      <UModal v-model:open="modalDetalleMostrar" title="Detalle de la ayudantía" :ui="{ footer: 'justify-end' }">
         <template #body>
            <div v-if="reservaSeleccionada" class="space-y-4 text-sm">
               <div>
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">Título</p>
                  <p class="flex items-center gap-1.5 truncate font-medium text-usm-text dark:text-white">
                     {{ reservaSeleccionada.titulo }}
                     <span
                        v-if="reservaSeleccionada.serieId"
                        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-usm-blue/10 px-2 py-0.5 text-xs font-normal text-usm-blue dark:bg-usm-cyan/10 dark:text-usm-cyan"
                     >
                        <UIcon name="i-lucide-repeat" class="size-3" />
                        Recurrente
                     </span>
                     <span
                        v-if="reservaSeleccionada.cancelada"
                        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-error/10 px-2 py-0.5 text-xs font-normal text-error"
                     >
                        <UIcon name="i-lucide-ban" class="size-3" />
                        Cancelada
                     </span>
                  </p>
                  <p v-if="reservaSeleccionada.subtitulo" class="text-usm-text-muted dark:text-slate-400">
                     {{ reservaSeleccionada.subtitulo }}
                  </p>
               </div>
               <div class="flex items-start justify-between gap-3">
                  <div class="space-y-0.5">
                     <p class="text-xs text-usm-text-muted dark:text-slate-400">Fecha</p>
                     <p class="font-medium text-usm-text dark:text-white">
                        {{ formatFechaDisplay(new Date(`${reservaSeleccionada.fecha.slice(0, 10)}T00:00:00`)) }}
                     </p>
                  </div>
                  <div class="space-y-0.5 text-right">
                     <p class="text-xs text-usm-text-muted dark:text-slate-400">Horario</p>
                     <p class="font-medium text-usm-text dark:text-white">
                        {{ horaDeISO(reservaSeleccionada.inicio) }}–{{ horaDeISO(reservaSeleccionada.fin) }}
                     </p>
                  </div>
               </div>
               <div>
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">Ayudante</p>
                  <p v-if="reservaSeleccionada.persona" class="font-medium text-usm-text dark:text-white">
                     {{ reservaSeleccionada.persona.nombre }} {{ reservaSeleccionada.persona.apellido }}
                  </p>
                  <p v-else class="text-usm-text-muted italic dark:text-slate-400">Sin ayudante asignado</p>
               </div>
            </div>
         </template>
         <template #footer>
            <UButton
               variant="outline"
               color="neutral"
               @click="
                  () => {
                     modalDetalleMostrar = false
                  }
               "
               >Cerrar</UButton
            >
            <UButton
               v-if="reservaSeleccionada && puedeModificarReserva(reservaSeleccionada)"
               color="neutral"
               variant="subtle"
               icon="i-lucide-pen"
               @click="abrirEditar(reservaSeleccionada!)"
            >
               Editar
            </UButton>
            <UButton
               v-if="reservaSeleccionada && puedeModificarReserva(reservaSeleccionada)"
               color="error"
               icon="i-lucide-calendar-x"
               @click="abrirConfirmBorrar(reservaSeleccionada!)"
            >
               Borrar
            </UButton>
         </template>
      </UModal>

      <!-- Confirmar borrado -->
      <ConfirmModal
         v-model:open="confirmBorrarMostrar"
         title="Borrar ayudantía"
         confirm-label="Borrar"
         confirm-icon="i-lucide-calendar-x"
         confirm-color="error"
         :loading="borrando"
         @confirm="borrarReserva"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Borrar la ayudantía
            <span class="font-semibold">{{ reservaSeleccionada?.titulo }}</span>
            del
            {{
               reservaSeleccionada
                  ? formatFechaDisplay(new Date(`${reservaSeleccionada.fecha.slice(0, 10)}T00:00:00`))
                  : ''
            }}?
         </p>
      </ConfirmModal>

      <!-- Borrar ayudantía recurrente: elegir alcance -->
      <UModal
         v-model:open="confirmBorrarSerieMostrar"
         title="Borrar ayudantía recurrente"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <p class="text-sm text-usm-text dark:text-slate-200">
               <span class="font-semibold">{{ reservaSeleccionada?.titulo }}</span> es parte de una serie recurrente.
               ¿Qué deseas borrar?
            </p>
         </template>
         <template #footer>
            <UButton
               variant="ghost"
               color="neutral"
               :disabled="borrando"
               @click="
                  () => {
                     confirmBorrarSerieMostrar = false
                  }
               "
               >Volver</UButton
            >
            <UButton
               color="error"
               variant="subtle"
               icon="i-lucide-calendar-x"
               :loading="borrando"
               @click="borrarReserva('solo')"
            >
               Solo esta ayudantía
            </UButton>
            <UButton color="error" icon="i-lucide-calendar-x" :loading="borrando" @click="borrarReserva('serie')">
               Esta y las siguientes
            </UButton>
         </template>
      </UModal>

      <!-- Modal editar ayudantía -->
      <UModal v-model:open="modalEditarMostrar" title="Editar ayudantía" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-ayudantia-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <div v-if="reservaEditar">
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">Título</p>
                  <p class="font-medium text-usm-text dark:text-white">{{ reservaEditar.titulo }}</p>
                  <p v-if="reservaEditar.subtitulo" class="text-sm text-usm-text-muted dark:text-slate-400">
                     {{ reservaEditar.subtitulo }}
                  </p>
               </div>
               <UFormField label="Ayudante" name="personaId">
                  <USelectMenu
                     v-model="formEditar.personaId"
                     :items="itemsAyudante"
                     value-key="value"
                     :search-input="{ placeholder: 'Buscar ayudante…' }"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Horario">
                  <UTabs
                     v-model="formEditar.modoHorario"
                     :items="[
                        { label: 'Por bloque', value: 'bloque' },
                        { label: 'Hora libre', value: 'libre' },
                     ]"
                     :content="false"
                  />
               </UFormField>
               <div v-if="formEditar.modoHorario === 'bloque'" class="grid grid-cols-2 gap-4">
                  <UFormField label="Bloque de inicio" name="bloqueInicioId">
                     <USelectMenu
                        v-model="formEditar.bloqueInicioId"
                        :items="itemsBloque"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
                  <UFormField label="Bloque de término" name="bloqueTerminoId">
                     <USelectMenu
                        v-model="formEditar.bloqueTerminoId"
                        :items="itemsBloque"
                        value-key="value"
                        class="w-full"
                     />
                  </UFormField>
               </div>
               <div v-else class="grid grid-cols-2 gap-4">
                  <UFormField label="Hora de inicio" name="inicio">
                     <UInput
                        :model-value="formEditar.inicio"
                        placeholder="14:30"
                        maxlength="5"
                        icon="i-lucide-clock"
                        class="w-full"
                        @update:model-value="formEditar.inicio = enmascararHora(String($event))"
                     />
                  </UFormField>
                  <UFormField label="Hora de término" name="fin">
                     <UInput
                        :model-value="formEditar.fin"
                        placeholder="15:00"
                        maxlength="5"
                        icon="i-lucide-clock"
                        class="w-full"
                        @update:model-value="formEditar.fin = enmascararHora(String($event))"
                     />
                  </UFormField>
               </div>
               <UAlert
                  v-if="errorEditar"
                  icon="i-lucide-alert-circle"
                  color="error"
                  variant="subtle"
                  :description="errorEditar"
               />
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
            <UButton type="submit" form="form-ayudantia-editar" :loading="guardando" :disabled="!puedeEnviarEditar">
               Guardar cambios
            </UButton>
         </template>
      </UModal>

      <!-- Editar ayudantía recurrente: elegir alcance -->
      <UModal
         v-model:open="confirmAlcanceEditarMostrar"
         title="Editar ayudantía recurrente"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <p class="text-sm text-usm-text dark:text-slate-200">
               <span class="font-semibold">{{ reservaEditar?.titulo }}</span> es parte de una serie recurrente. ¿Qué
               deseas editar?
            </p>
         </template>
         <template #footer>
            <UButton
               variant="ghost"
               color="neutral"
               :disabled="guardando"
               @click="
                  () => {
                     confirmAlcanceEditarMostrar = false
                  }
               "
               >Volver</UButton
            >
            <UButton
               color="neutral"
               variant="subtle"
               icon="i-lucide-pen"
               :loading="guardando"
               @click="ejecutarGuardarEditar('solo')"
            >
               Solo esta ayudantía
            </UButton>
            <UButton icon="i-lucide-pen" :loading="guardando" @click="ejecutarGuardarEditar('serie')">
               Esta y las siguientes
            </UButton>
         </template>
      </UModal>
   </div>
</template>
