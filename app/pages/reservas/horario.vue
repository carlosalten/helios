<script setup lang="ts">
import type { Bloque } from '~/types/bloque'
import type { Sala } from '~/types/sala'
import type { Semestre } from '~/types/semestre'
import type { Persona } from '~/types/persona'
import { COLORES_RESERVA, type Reserva, type TipoReserva } from '~/types/reserva'
import { DIAS_SEMANA, DIAS_FIN_SEMANA } from '~/types/dia'
import { CalendarDate, type DateValue } from '@internationalized/date'
import type { DateRange } from 'reka-ui'

const toast = useToast()
const { user } = useUserSession()

const [
   { data: semestres },
   { data: bloquesRaw },
   { data: salas },
   { data: personas },
   { data: tiposReserva },
   { data: misSalasEncargado },
] = await Promise.all([
   useFetch<Semestre[]>('/api/semestres'),
   useFetch<Bloque[]>('/api/bloques'),
   useFetch<Sala[]>('/api/salas'),
   useFetch<Persona[]>('/api/personas'),
   useFetch<TipoReserva[]>('/api/reservas/tipos'),
   useFetch<string[]>('/api/reservas/mis-salas-encargado'),
])

const { puedeCrear, puedeEditar } = usePermiso('/reservas/horario')

// Alcance para MODIFICAR (editar/mover/cortar/borrar) una reserva ya existente — mismas
// reglas que server/utils/alcanceReservas.ts, para que la UI no ofrezca acciones que el
// backend igual va a rechazar:
//  - Administrador: todas.
//  - Jefe de Carrera: todas también, sin importar a nombre de quién estén ni si son de clase.
//  - Cualquier otra persona: las propias, salvo que sean de una clase (sesionParaleloId no nulo).
//  - Apoyo Docente: además, cualquier reserva en una sala de la que sea encargado.
const misSalasEncargadoSet = computed(() => new Set(misSalasEncargado.value ?? []))

function puedeModificarReserva(reserva: Reserva) {
   // Una tarjeta que fusiona 2+ bloques de una misma clase (ver `esClaseFusionada` más abajo)
   // lleva el id de solo el primer bloque: editarla/moverla/cancelarla/borrarla desde acá
   // tocaría solo esa porción y dejaría el resto de la clase atrás, sin que se note en
   // pantalla. Para mover una clase completa se sigue usando /horario. "Copiar" (que no muta
   // el original) no pasa por esta función, así que sigue disponible.
   if (esClaseFusionada(reserva)) return false
   if (!puedeEditar.value || !user.value) return false
   if (user.value.rol === 'Administrador' || user.value.rol === 'Jefe de Carrera') return true

   const esClase = reserva.sesionParaleloId != null
   if (!esClase && reserva.personaId === user.value.personaId) return true

   if (user.value.rol === 'Apoyo Docente' && misSalasEncargadoSet.value.has(reserva.salaCodigo)) return true

   return false
}

// Editar (a diferencia de cancelar/borrar/mover) queda excluido para Ayudantía: ese tipo tiene
// su propio formulario dedicado en /ayudantias (carrera → asignatura → paralelo → ayudante),
// más completo que el genérico de acá — se gestiona desde ahí, no desde este modal.
function puedeEditarReserva(reserva: Reserva) {
   return puedeModificarReserva(reserva) && reserva.tipoReserva.nombre !== 'Ayudantía'
}

/* ── Semestre: solo define la plantilla horaria (rango de horas y separadores de
   almuerzo/vespertino) — las reservas en sí no dependen de un semestre y se muestran
   siempre, sin importar cuál esté vigente. Se usa el vigente automáticamente, sin
   selector: el usuario no necesita pensar en semestres para reservar una sala. ── */
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

/* ── Sala ────────────────────────────────────────────────── */
// El panel de salas se acota a las asignadas (EncargadoSala) para cualquier rol que no sea
// Administrador, que ve todas — mismo criterio que /reservas/resumen (server/api/reservas/
// resumen.get.ts). Si antes esta lista sale vacía sin ser el problema real, revisa primero que
// /api/salas no esté devolviendo 403 para el rol (ver server/api/salas/index.get.ts): un 403 ahí
// deja `salas` vacío antes de que este filtro tenga algo que filtrar.
const salasVisibles = computed(() => {
   if (user.value?.rol === 'Administrador') return salas.value ?? []
   return (salas.value ?? []).filter((s) => misSalasEncargadoSet.value.has(s.codigo))
})

const salaSeleccionada = ref<string>()
watchEffect(() => {
   if (!salasVisibles.value.some((s) => s.codigo === salaSeleccionada.value)) {
      salaSeleccionada.value = salasVisibles.value[0]?.codigo
   }
})
const salaActual = computed(() => salasVisibles.value.find((s) => s.codigo === salaSeleccionada.value) ?? null)

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

/* ── Fin de semana ───────────────────────────────────────── */
const mostrarFinSemana = ref(false)
const diasVisibles = computed(() =>
   mostrarFinSemana.value ? DIAS_SEMANA : DIAS_SEMANA.filter((d) => !DIAS_FIN_SEMANA.includes(d.valor))
)

// Anchos de columna de la tabla imprimible: con layout automático, el navegador reparte el
// ancho según el contenido y puede angostar la columna "Bloque" hasta hacerla wrappear, a la vez
// que el resto de la tabla termina más ancha que la hoja y la última columna (viernes) queda
// cortada al imprimir. Con `table-fixed` + anchos explícitos por `<colgroup>` la tabla siempre
// mide exactamente el 100% del contenedor, así que ninguna columna puede salirse de la página.
const ANCHO_COLUMNA_BLOQUE_IMPRESION = 11
const anchoColumnaDiaImpresion = computed(() => (100 - ANCHO_COLUMNA_BLOQUE_IMPRESION) / diasVisibles.value.length)

/* ── Navegación por semana ───────────────────────────────── */
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
// Encabezado de columna de día: "28 jul" en vez de "28-07", más fácil de leer de un vistazo.
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

/* ── Ir a una fecha (calendario) ─────────────────────────────────────────
   Para saltar rápido a una semana que está meses adelante o atrás, sin tener que
   apretar "semana siguiente/anterior" muchas veces. */
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
   // El calendario se usa en modo de fecha única (sin `range` ni `multiple`), pero el tipo del
   // evento de reka-ui cubre los tres modos — se descarta cualquier otra forma en runtime.
   if (!valor || Array.isArray(valor) || !('day' in valor)) return
   semanaInicio.value = inicioDeSemana(new Date(valor.year, valor.month - 1, valor.day))
   calendarioAbierto.value = false
}
const rangoSemanaLabel = computed(
   () => `${formatFechaCortaConAnio(semanaInicio.value)} — ${formatFechaCortaConAnio(sumarDias(semanaInicio.value, 6))}`
)
// Fecha real (Date) de cada día de la semana visible, indexada por `dia.valor` (1=Lunes…7=Domingo).
const fechasSemana = computed(
   () => new Map(DIAS_SEMANA.map((d) => [d.valor, sumarDias(semanaInicio.value, d.valor - 1)]))
)

/* ── Franjas de 5 minutos ────────────────────────────────────────────────
   Las reservas que no son de clases no calzan necesariamente con los bloques horarios,
   así que la matriz se arma en franjas de 5 minutos (constraint `reserva_granularidad_5min`
   en BD) que cubren desde el primer bloque hasta el último del semestre seleccionado. En
   vez de una separación visual (espacio en blanco) entre mañana/tarde/vespertino, cada
   franja lleva un color de fondo distinto según el período al que pertenece. */
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
// Solo se etiquetan las franjas en punto o media hora, para no saturar la columna de horas.
function muestraEtiqueta(franja: Franja) {
   return franja.horaInicio.endsWith(':00') || franja.horaInicio.endsWith(':30')
}
// Línea guía cada 30 minutos, para que la grilla de 5 minutos se pueda leer a simple vista.
function esLimiteMediaHora(hora: string) {
   return hora.endsWith(':00') || hora.endsWith(':30')
}

/* ── Reservas de la sala en la semana visible ───────────────────────────── */
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

/* ── Grilla: qué hay (o no) en cada (día, franja) ────────────────────────
   La constraint `reserva_sin_solapamiento` impide que dos reservas se solapen para una
   misma sala+fecha, así que en teoría esto nunca debería ocurrir para la sala mostrada —
   pero la grilla igual se arma para tolerarlo: las reservas que se solapan en el tiempo se
   agrupan en un mismo "cluster" y se reparten en columnas (una al lado de la otra) en vez de
   taparse. El cluster ocupa varias franjas consecutivas: se guarda en la franja de inicio
   con su `rowspan` (el máximo entre todas sus reservas), y se marcan como 'oculta' las
   franjas que cubre (para no emitir <td> ahí — el rowspan nativo del navegador hace el
   resto, igual que en la matriz de /horario). Dentro del <td>, cada reserva se posiciona con
   `top`/`height`/`left`/`width` relativos al cluster. */
interface ReservaPosicionada {
   reserva: Reserva
   columna: number
   totalColumnas: number
   offsetInicioMin: number
   duracionMin: number
}
type Celda = { tipo: 'vacia' } | { tipo: 'oculta' } | { tipo: 'cluster'; span: number; reservas: ReservaPosicionada[] }

// Número de bloque de cada hora de inicio, para detectar bloques contiguos de una misma clase
// (ver `fusionarClasesContiguas`) — mismo criterio que server/api/pantallas/publico/[codigo]
// (fusionarBloquesContiguos): la contigüidad es por NÚMERO de bloque, no por hora, así que un
// recreo entre dos bloques consecutivos no corta la fusión.
const bloqueNumeroPorHoraInicio = computed(
   () => new Map(bloquesSemestre.value.map((b) => [horaDeISO(b.inicio), b.numero]))
)
function bloqueNumeroDe(horaISO: string) {
   return bloqueNumeroPorHoraInicio.value.get(horaDeISO(horaISO)) ?? null
}

// Una clase de varias horas (ej. 3 bloques de teoría seguidos) llega como una Reserva por
// bloque — ver server/utils/reservasSesion.ts. Acá se fusionan los bloques contiguos de un
// mismo paralelo en una sola tarjeta que abarca desde el inicio del primero hasta el fin del
// último, para no mostrar una clase de 3 horas como 3 cuadros separados. Solo aplica a
// reservas de clase (`sesionParalelo`): Ayudantías y demás tipos de reserva pasan tal cual.
// Además de fusionar, registra en `idsFusionados` el id de toda tarjeta resultante de 2+
// bloques — `esClaseFusionada` usa ese registro para bloquear editar/mover/cancelar/borrar
// sobre esa tarjeta (ver el comentario en `puedeModificarReserva`).
function fusionarClasesContiguas(reservasDia: Reserva[], idsFusionados: Set<number>): Reserva[] {
   const porParalelo = new Map<number, Reserva[]>()
   const resto: Reserva[] = []
   for (const r of reservasDia) {
      const paraleloId = r.sesionParalelo?.paralelo.id
      if (paraleloId == null) {
         resto.push(r)
         continue
      }
      const grupo = porParalelo.get(paraleloId) ?? []
      grupo.push(r)
      porParalelo.set(paraleloId, grupo)
   }

   function cerrarGrupo(actual: Reserva, cantidad: number) {
      if (cantidad > 1) idsFusionados.add(actual.id)
      return actual
   }

   const fusionadas = [...resto]
   for (const grupo of porParalelo.values()) {
      const ordenado = [...grupo].sort((a, b) => horaAMinutos(horaDeISO(a.inicio)) - horaAMinutos(horaDeISO(b.inicio)))
      let actual: Reserva | null = null
      let bloqueAnterior: number | null = null
      let cantidad = 0
      for (const r of ordenado) {
         const bloqueActual = bloqueNumeroDe(r.inicio)
         const esContiguo =
            actual && bloqueAnterior != null && bloqueActual != null && bloqueActual === bloqueAnterior + 1
         if (esContiguo && actual!.cancelada === r.cancelada) {
            actual = { ...actual!, fin: r.fin }
            cantidad++
         } else {
            if (actual) fusionadas.push(cerrarGrupo(actual, cantidad))
            actual = r
            cantidad = 1
         }
         bloqueAnterior = bloqueActual
      }
      if (actual) fusionadas.push(cerrarGrupo(actual, cantidad))
   }
   return fusionadas
}

// Fusiona las reservas de cada día de la semana visible en un solo paso — `gridPorDia` consume
// `porDia`, y `esClaseFusionada` consulta `idsFusionados` para gatear la interactividad de las
// tarjetas fusionadas (ver `puedeModificarReserva`).
const fusionDia = computed(() => {
   const porDia = new Map<number, Reserva[]>()
   const idsFusionados = new Set<number>()
   for (const dia of DIAS_SEMANA) {
      const fecha = fechasSemana.value.get(dia.valor)
      const fechaISO = fecha ? formatFechaISO(fecha) : ''
      const reservasDia = (reservas.value ?? []).filter((r) => r.fecha.slice(0, 10) === fechaISO)
      porDia.set(dia.valor, fusionarClasesContiguas(reservasDia, idsFusionados))
   }
   return { porDia, idsFusionados }
})
function esClaseFusionada(reserva: Reserva) {
   return fusionDia.value.idsFusionados.has(reserva.id)
}

// Agrupa reservas de un día en clusters de solapamiento transitivo: A se solapa con B y B con
// C aunque A y C no se toquen directamente, las tres van en el mismo cluster.
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

// Asigna una columna a cada reserva del cluster (algoritmo greedy tipo "salas de reunión"):
// a cada reserva se le da la primera columna que ya quedó libre a esa hora, o una nueva.
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
      const celdas: Celda[] = franjas.value.map(() => ({ tipo: 'vacia' }))
      const reservasDia = fusionDia.value.porDia.get(dia.valor) ?? []
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
// La línea de media hora va al fondo del bloque renderizado (que puede cubrir varias franjas
// de 5 minutos por el rowspan de una reserva), no de la franja individual.
function terminaEnMediaHora(diaValor: number, franjaIndice: number) {
   const span = rowspanDe(diaValor, franjaIndice)
   const franjaFinal = franjas.value[franjaIndice + span - 1]
   return franjaFinal ? esLimiteMediaHora(franjaFinal.horaFin) : false
}

// Mismo orden de precedencia que /horario: el fin de semana manda sobre el color de
// período (mañana/tarde/vespertino), que solo se ve en días de semana.
function claseCeldaDia(diaValor: number, franja: Franja) {
   if (DIAS_FIN_SEMANA.includes(diaValor)) return 'bg-gray-50 dark:bg-slate-800/40'
   if (franja.periodo === 'vespertino') return 'bg-secondary/10 dark:bg-secondary/15'
   if (franja.periodo === 'tarde') return 'bg-muted'
   return 'bg-default'
}

// Mismo rojo que usa el resto de la app para lo destructivo/urgente (--color-usm-red). Una
// reserva cancelada lo usa siempre, sin importar el color de su tipo: tiene que distinguirse
// de un vistazo, no leerse como "una reserva más".
const COLOR_CANCELADA = '#C8102E'

// Cada reserva toma el color de su tipo: borde sólido en el color y un fondo con el mismo
// tono a baja opacidad (alpha "1A" ≈ 10%, agregado directo al hex de 6 dígitos). Cancelada:
// fondo más marcado (alpha "33" ≈ 20%) para que resalte incluso en un cuadro muy angosto.
function estiloReserva(reserva: Reserva) {
   if (reserva.cancelada) return { borderColor: COLOR_CANCELADA, backgroundColor: `${COLOR_CANCELADA}33` }
   return { borderColor: reserva.tipoReserva.color, backgroundColor: `${reserva.tipoReserva.color}1A` }
}
// Posición del cuadro dentro de su cluster: si se solapa con otras reservas, cada una toma
// una fracción del ancho (una columna) en vez de taparse; la altura sigue calzando con las
// filas de 10px de la grilla de 5 minutos.
function estiloPosicion(rp: ReservaPosicionada) {
   return {
      top: `${(rp.offsetInicioMin / 5) * 10}px`,
      height: `${(rp.duracionMin / 5) * 10}px`,
      left: `${(rp.columna / rp.totalColumnas) * 100}%`,
      width: `${(1 / rp.totalColumnas) * 100}%`,
   }
}
// Badge del tipo dentro del cuadro: mismo color del tipo, pero como texto sobre un fondo más
// tenue (alpha "26" ≈ 15%) para que se lea sobre el fondo ya teñido del cuadro. Cancelada:
// reemplaza el badge de tipo por uno "Cancelada" en rojo, siempre.
function estiloBadgeTipo(reserva: Reserva) {
   if (reserva.cancelada) return { backgroundColor: `${COLOR_CANCELADA}26`, color: COLOR_CANCELADA }
   return { backgroundColor: `${reserva.tipoReserva.color}26`, color: reserva.tipoReserva.color }
}
function textoBadgeTipo(reserva: Reserva) {
   return reserva.cancelada ? 'Cancelada' : reserva.tipoReserva.nombre
}
function horaConSufijo(horaISO: string) {
   return `${horaDeISO(horaISO)} hrs.`
}

function enmascararHora(valor: string) {
   const digitos = valor.replace(/\D/g, '').slice(0, 4)
   if (digitos.length <= 2) return digitos
   return `${digitos.slice(0, 2)}:${digitos.slice(2)}`
}

/* ── Crear reserva (click sobre una celda vacía) ─────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({
   titulo: '',
   fecha: '',
   inicio: '',
   fin: '',
   tipoReservaId: 0,
   personaId: 0,
   recurrente: false,
   repetirHasta: '',
   publica: true,
})
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

const personaPropia = computed(() => (personas.value ?? []).find((p) => p.email === user.value?.email) ?? null)

// Cada tipo de reserva trae su propio valor por defecto para "Reserva pública" (ver
// TipoReserva.publicaPorDefecto) — se usa para prellenar el formulario de reserva nueva, no en
// edición (una reserva ya creada conserva el valor que tiene, aunque se le cambie el tipo).
function publicaPorDefectoDe(tipoReservaId: number) {
   return tiposReserva.value?.find((t) => t.id === tipoReservaId)?.publicaPorDefecto ?? true
}

// Ayudantía tiene su propia sección dedicada (/ayudantias), con su propio flujo de creación
// (carrera → asignatura → paralelo → ayudante, siempre recurrente) — no se ofrece como tipo al
// crear una reserva genérica acá, para no duplicar ese flujo con uno más simple e inconsistente.
const itemsTipoReservaCrear = computed(() =>
   (tiposReserva.value ?? []).filter((t) => t.nombre !== 'Ayudantía').map((t) => ({ label: t.nombre, value: t.id }))
)
watch(
   () => formCrear.tipoReservaId,
   (tipoReservaId) => {
      formCrear.publica = publicaPorDefectoDe(tipoReservaId)
   }
)

function abrirCrear(diaValor: number, franja: Franja) {
   if (!puedeCrear.value || !salaSeleccionada.value) return
   if (celdaDe(diaValor, franja.indice).tipo !== 'vacia') return

   const fecha = fechasSemana.value.get(diaValor)
   if (!fecha) return

   const ultimaFranja = franjas.value[franjas.value.length - 1]
   const finMaximo = ultimaFranja ? horaAMinutos(ultimaFranja.horaFin) : horaAMinutos(franja.horaFin)
   const finSugerido = Math.min(horaAMinutos(franja.horaInicio) + 30, finMaximo)

   formCrear.titulo = ''
   formCrear.fecha = formatFechaISO(fecha)
   formCrear.inicio = franja.horaInicio
   formCrear.fin = minutosAHora(finSugerido)
   formCrear.tipoReservaId = itemsTipoReservaCrear.value[0]?.value ?? 0
   formCrear.personaId = personaPropia.value?.id ?? personas.value?.[0]?.id ?? 0
   formCrear.recurrente = false
   formCrear.repetirHasta = ''
   formCrear.publica = publicaPorDefectoDe(formCrear.tipoReservaId)
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      if (formCrear.recurrente) {
         const resultado = await $fetch<{ ok: true; cantidad: number }>('/api/reservas/recurrente', {
            method: 'POST',
            body: {
               salaCodigo: salaSeleccionada.value,
               titulo: formCrear.titulo,
               fecha: formCrear.fecha,
               repetirHasta: formCrear.repetirHasta,
               inicio: formCrear.inicio,
               fin: formCrear.fin,
               tipoReservaId: Number(formCrear.tipoReservaId),
               personaId: Number(formCrear.personaId),
               publica: formCrear.publica,
            },
         })
         modalCrearMostrar.value = false
         await refrescarReservas()
         toast.add({
            title: `${resultado.cantidad} reservas creadas`,
            color: 'success',
            icon: 'i-lucide-check-circle',
         })
      } else {
         await $fetch('/api/reservas', {
            method: 'POST',
            body: {
               salaCodigo: salaSeleccionada.value,
               titulo: formCrear.titulo,
               fecha: formCrear.fecha,
               inicio: formCrear.inicio,
               fin: formCrear.fin,
               tipoReservaId: Number(formCrear.tipoReservaId),
               personaId: Number(formCrear.personaId),
               publica: formCrear.publica,
            },
         })
         modalCrearMostrar.value = false
         await refrescarReservas()
         toast.add({ title: 'Reserva creada', color: 'success', icon: 'i-lucide-check-circle' })
      }
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Detalle / borrar reserva (click sobre una reserva existente) ────────── */
const modalDetalleMostrar = ref(false)
const reservaSeleccionada = ref<Reserva | null>(null)
const borrando = ref(false)
const confirmBorrarMostrar = ref(false)
const confirmBorrarSerieMostrar = ref(false)

function abrirDetalle(reserva: Reserva) {
   reservaSeleccionada.value = reserva
   modalDetalleMostrar.value = true
}

/* ── Cancelar / reactivar reserva ─────────────────────────────────────────
   A diferencia de borrar, no elimina la fila: solo alterna `cancelada`. Solo afecta esta
   ocurrencia puntual — cancelar una reserva recurrente no toca el resto de la serie. */
const cancelando = ref(false)

async function alternarCancelada(reserva: Reserva) {
   cancelando.value = true
   try {
      await $fetch(`/api/reservas/${reserva.id}/cancelar`, { method: 'PATCH' })
      await refrescarReservas()
      toast.add({
         title: reserva.cancelada ? 'Reserva reactivada' : 'Reserva cancelada',
         color: 'success',
         icon: 'i-lucide-check-circle',
      })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al actualizar la reserva'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      cancelando.value = false
   }
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
      toast.add({ title: 'Reserva borrada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al borrar'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      borrando.value = false
   }
}

/* ── Editar reserva ───────────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const reservaEditar = ref<Reserva | null>(null)
const formEditar = reactive({
   titulo: '',
   fecha: '',
   inicio: '',
   fin: '',
   tipoReservaId: 0,
   personaId: 0,
   publica: true,
})
const errorEditar = ref<string | null>(null)
const confirmAlcanceEditarMostrar = ref(false)

// Igual que itemsTipoReservaCrear, pero si la reserva que se está editando ya es de tipo
// Ayudantía (creada antes de existir /ayudantias, o desde el propio /ayudantias), se mantiene
// en la lista para que el selector no quede sin label — mismo criterio que `opcionesCambiarRol`
// en /personas/gestion.
const itemsTipoReservaEditar = computed(() =>
   (tiposReserva.value ?? [])
      .filter((t) => t.nombre !== 'Ayudantía' || t.id === reservaEditar.value?.tipoReservaId)
      .map((t) => ({ label: t.nombre, value: t.id }))
)

function abrirEditar(reserva: Reserva) {
   reservaEditar.value = reserva
   formEditar.titulo = reserva.titulo
   formEditar.fecha = reserva.fecha.slice(0, 10)
   formEditar.inicio = horaDeISO(reserva.inicio)
   formEditar.fin = horaDeISO(reserva.fin)
   formEditar.tipoReservaId = reserva.tipoReservaId
   // 0 = "sin responsable" en el formulario; al guardar se vuelve a convertir en null.
   formEditar.personaId = reserva.personaId ?? 0
   formEditar.publica = reserva.publica
   errorEditar.value = null
   modalDetalleMostrar.value = false
   modalEditarMostrar.value = true
}

// Si la reserva es parte de una serie recurrente, primero se pregunta el alcance del cambio
// (`confirmAlcanceEditarMostrar`); si no, se guarda directo.
function guardarEditar() {
   if (!reservaEditar.value) return
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
      const url =
         alcance === 'serie'
            ? `/api/reservas/${reservaEditar.value.id}/serie`
            : `/api/reservas/${reservaEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: {
            salaCodigo: reservaEditar.value.salaCodigo,
            titulo: formEditar.titulo,
            fecha: formEditar.fecha,
            inicio: formEditar.inicio,
            fin: formEditar.fin,
            tipoReservaId: Number(formEditar.tipoReservaId),
            personaId: Number(formEditar.personaId) || null,
            publica: formEditar.publica,
         },
      })
      confirmAlcanceEditarMostrar.value = false
      modalEditarMostrar.value = false
      await refrescarReservas()
      toast.add({ title: 'Reserva actualizada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Drag and drop: mover una reserva de día/hora ────────────────────────
   Arrastra el bloque de la reserva; al soltarla sobre otra celda, conserva su duración y
   solo cambia fecha/hora de inicio (y de término, calculada a partir de la duración). */
const arrastre = ref<{ reservaId: number; duracionMin: number } | null>(null)
const celdaSobre = ref<{ diaValor: number; franjaIndice: number } | null>(null)

function iniciarArrastre(e: DragEvent, reserva: Reserva) {
   if (!puedeModificarReserva(reserva)) return
   // Sin esto, algunos navegadores (Firefox en particular) ni siquiera inician el arrastre
   // nativo — mismo patrón que /horario.
   e.dataTransfer?.setData('text/plain', String(reserva.id))
   if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
   const duracionMin = horaAMinutos(horaDeISO(reserva.fin)) - horaAMinutos(horaDeISO(reserva.inicio))
   arrastre.value = { reservaId: reserva.id, duracionMin }
}
function terminarArrastre() {
   arrastre.value = null
   celdaSobre.value = null
}

function permiteSoltar() {
   // El horario solapado está permitido, así que se puede soltar sobre cualquier celda (vacía
   // u ocupada); solo se valida que la reserva quepa dentro de los bloques del día en `onDropCelda`.
   return arrastre.value !== null
}

function onDragOverCelda(diaValor: number, franja: Franja, e: DragEvent) {
   if (!permiteSoltar()) return
   e.preventDefault()
   celdaSobre.value = { diaValor, franjaIndice: franja.indice }
}

async function onDropCelda(diaValor: number, franja: Franja, e: DragEvent) {
   e.preventDefault()
   const actual = arrastre.value
   // El chequeo debe ir antes de limpiar `arrastre`: `permiteSoltar` lee `arrastre.value`.
   const permitido = permiteSoltar()
   terminarArrastre()
   if (!actual || !permitido) return

   const reserva = (reservas.value ?? []).find((r) => r.id === actual.reservaId)
   const fecha = fechasSemana.value.get(diaValor)
   if (!reserva || !fecha) return

   const inicioMin = horaAMinutos(franja.horaInicio)
   const finMin = inicioMin + actual.duracionMin
   const finMaximo = horaAMinutos(franjas.value[franjas.value.length - 1]!.horaFin)
   if (finMin > finMaximo) {
      toast.add({ title: 'La reserva no cabe en ese horario', color: 'error', icon: 'i-lucide-alert-circle' })
      return
   }

   try {
      await $fetch(`/api/reservas/${reserva.id}`, {
         method: 'PATCH',
         body: {
            salaCodigo: reserva.salaCodigo,
            titulo: reserva.titulo,
            fecha: formatFechaISO(fecha),
            inicio: franja.horaInicio,
            fin: minutosAHora(finMin),
            tipoReservaId: reserva.tipoReservaId,
            personaId: reserva.personaId,
            publica: reserva.publica,
         },
      })
      await refrescarReservas()
   } catch (e2: unknown) {
      const mensaje = (e2 as { data?: { message?: string } }).data?.message ?? 'No se pudo mover la reserva'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   }
}

/* ── Copiar / cortar / pegar reserva (click derecho) ─────────────────────
   Un solo UContextMenu envuelve toda la matriz (con el <table> como único trigger) para no
   instanciar un menú por celda; `contextoMenu` guarda sobre qué se hizo click derecho (una
   reserva o una celda vacía) para decidir qué ofrece el menú. El handler va en el <td> —
   nunca con `.stop` en el bloque de la reserva — porque el evento nativo `contextmenu` tiene
   que seguir subiendo hasta el <table> para que el trigger de reka-ui lo intercepte y haga
   `preventDefault()`; si no llega, el navegador muestra su propio menú en vez del nuestro. Por
   eso se usa `event.target` para detectar si el click fue sobre el bloque de una reserva
   (marcado con `data-reserva-id`) en vez de un handler separado con `.stop` en ese bloque. */
type ContextoMenu = { tipo: 'reserva'; reserva: Reserva } | { tipo: 'vacia'; diaValor: number; franja: Franja } | null

const contextoMenu = ref<ContextoMenu>(null)
// modo 'copiar' pega una reserva nueva (POST); 'cortar' mueve la original a la celda pegada
// (PATCH) y limpia el portapapeles después de pegar.
const clipboardReserva = ref<{ reserva: Reserva; modo: 'copiar' | 'cortar' } | null>(null)

function onContextMenuCelda(diaValor: number, franja: Franja, event: MouseEvent) {
   const idReserva = (event.target as HTMLElement).closest('[data-reserva-id]')?.getAttribute('data-reserva-id')
   if (idReserva) {
      const reserva = (reservas.value ?? []).find((r) => r.id === Number(idReserva))
      contextoMenu.value = reserva ? { tipo: 'reserva', reserva } : null
      return
   }
   contextoMenu.value = celdaDe(diaValor, franja.indice).tipo === 'vacia' ? { tipo: 'vacia', diaValor, franja } : null
}

function copiarReserva(reserva: Reserva) {
   clipboardReserva.value = { reserva, modo: 'copiar' }
   toast.add({ title: 'Reserva copiada', icon: 'i-lucide-copy' })
}

function cortarReserva(reserva: Reserva) {
   clipboardReserva.value = { reserva, modo: 'cortar' }
   toast.add({ title: 'Reserva cortada', icon: 'i-lucide-scissors' })
}

async function pegarReserva(diaValor: number, franja: Franja) {
   const clip = clipboardReserva.value
   if (!clip || !salaSeleccionada.value) return
   const original = clip.reserva
   const fecha = fechasSemana.value.get(diaValor)
   if (!fecha) return

   const duracionMin = horaAMinutos(horaDeISO(original.fin)) - horaAMinutos(horaDeISO(original.inicio))
   const inicioMin = horaAMinutos(franja.horaInicio)
   const finMin = inicioMin + duracionMin
   const finMaximo = horaAMinutos(franjas.value[franjas.value.length - 1]!.horaFin)
   if (finMin > finMaximo) {
      toast.add({ title: 'La reserva no cabe en ese horario', color: 'error', icon: 'i-lucide-alert-circle' })
      return
   }

   const body = {
      salaCodigo: salaSeleccionada.value,
      titulo: original.titulo,
      fecha: formatFechaISO(fecha),
      inicio: franja.horaInicio,
      fin: minutosAHora(finMin),
      tipoReservaId: original.tipoReservaId,
      personaId: original.personaId,
      publica: original.publica,
   }

   try {
      if (clip.modo === 'cortar') {
         await $fetch(`/api/reservas/${original.id}`, { method: 'PATCH', body })
         clipboardReserva.value = null
      } else {
         await $fetch('/api/reservas', { method: 'POST', body })
      }
      await refrescarReservas()
      toast.add({
         title: clip.modo === 'cortar' ? 'Reserva movida' : 'Reserva pegada',
         color: 'success',
         icon: 'i-lucide-check-circle',
      })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'No se pudo pegar la reserva'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   }
}

const itemsMenuContextual = computed(() => {
   const c = contextoMenu.value
   if (!c) return []
   if (c.tipo === 'reserva') {
      const reserva = c.reserva
      const puedeModificar = puedeModificarReserva(reserva)
      const gestion = []
      if (puedeEditarReserva(reserva)) {
         gestion.push({ label: 'Editar reserva', icon: 'i-lucide-pen', onSelect: () => abrirEditar(reserva) })
      }
      if (puedeModificar) {
         gestion.push({
            label: reserva.cancelada ? 'Reactivar reserva' : 'Cancelar reserva',
            icon: reserva.cancelada ? 'i-lucide-rotate-ccw' : 'i-lucide-ban',
            onSelect: () => alternarCancelada(reserva),
         })
         gestion.push({
            label: 'Borrar reserva',
            icon: 'i-lucide-trash-2',
            onSelect: () => abrirConfirmBorrar(reserva),
         })
      }
      const portapapeles = []
      if (puedeCrear.value) {
         portapapeles.push({ label: 'Copiar reserva', icon: 'i-lucide-copy', onSelect: () => copiarReserva(reserva) })
      }
      if (puedeModificar) {
         portapapeles.push({
            label: 'Cortar reserva',
            icon: 'i-lucide-scissors',
            onSelect: () => cortarReserva(reserva),
         })
      }
      return [portapapeles, gestion].filter((grupo) => grupo.length > 0)
   }
   const clip = clipboardReserva.value
   if (!clip) return []
   if (clip.modo === 'copiar' ? !puedeCrear.value : !puedeModificarReserva(clip.reserva)) return []
   const { diaValor, franja } = c
   return [{ label: 'Pegar reserva', icon: 'i-lucide-clipboard-paste', onSelect: () => pegarReserva(diaValor, franja) }]
})

/* ── Imprimir horario ─────────────────────────────────────────────────────
   La matriz interactiva (grilla de 5 minutos, columnas absolutas) no está pensada para papel:
   se arma una tabla aparte, solo visible en impresión (`hidden print:block`), con una fila
   por bloque horario del semestre de la semana visible (no por franja de 5 minutos) — así las
   líneas horizontales calzan con los bloques reales. Si una reserva ocupa más de un bloque, no
   se repiten sus datos en cada fila: se agrupa igual que en pantalla (`agruparEnClusters`,
   mismo criterio de solapamiento) y se dibuja una sola vez con `rowspan`, extendiendo el
   recuadro sobre los bloques que cubre. */

// Una entrada del cuadro impreso: la reserva y el rango de horas que se le imprime. El rango no
// siempre es el de la reserva — ver `fusionarContiguas`.
interface EntradaImpresion {
   reserva: Reserva
   inicio: string
   fin: string
}
type CeldaImpresion =
   { tipo: 'vacia' } | { tipo: 'oculta' } | { tipo: 'reservas'; entradas: EntradaImpresion[]; span: number }

// Un tramo de filas de la tabla impresa (del bloque `idxInicio` al `idxFin`, ambos incluidos).
interface TramoImpresion {
   idxInicio: number
   idxFin: number
   entradas: EntradaImpresion[]
}

// Dos reservas son la misma actividad si solo se diferencian en la hora. El caso que importa:
// cada bloque de una clase es una sesión distinta y por lo tanto una reserva distinta, así que
// una clase de cuatro bloques llega acá como cuatro reservas idénticas seguidas.
function mismaActividad(a: Reserva, b: Reserva) {
   return (
      a.titulo === b.titulo &&
      a.tipoReservaId === b.tipoReservaId &&
      a.personaId === b.personaId &&
      // Si solo un bloque de una clase de varias horas se cancela, no puede fundirse con el
      // resto en un solo recuadro: se perdería justo el dato de cuál bloque es el cancelado.
      a.cancelada === b.cancelada
   )
}

// Fusiona los tramos de la misma actividad que caen en filas consecutivas, para que en el papel
// salga un solo recuadro con el rango completo en vez de la misma clase repetida bloque a
// bloque. La contigüidad se mide en filas de la tabla (`idxFin + 1 === idxInicio`), no en horas:
// entre dos bloques puede haber un recreo, y en la hoja esas dos filas igual van pegadas.
//
// Solo se fusionan tramos de una entrada: si en el tramo hay reservas solapadas, cuál continúa
// con cuál es ambiguo y se deja tal cual (caso raro en el horario de una sola sala).
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

// Primer bloque cuyo fin es posterior al inicio de la reserva/cluster (donde "empieza" a
// mostrarse en la grilla impresa).
function idxBloqueInicio(minutos: number) {
   const idx = bloquesSemestre.value.findIndex((b) => horaAMinutos(horaDeISO(b.fin)) > minutos)
   return idx === -1 ? bloquesSemestre.value.length - 1 : idx
}
// Último bloque cuyo inicio es anterior al fin de la reserva/cluster (donde "termina").
function idxBloqueFin(minutos: number) {
   let idx = 0
   for (let i = 0; i < bloquesSemestre.value.length; i++) {
      if (horaAMinutos(horaDeISO(bloquesSemestre.value[i]!.inicio)) < minutos) idx = i
   }
   return idx
}

const celdasImpresionPorDia = computed(() => {
   const mapa = new Map<number, CeldaImpresion[]>()
   for (const dia of DIAS_SEMANA) {
      const fecha = fechasSemana.value.get(dia.valor)
      const fechaISO = fecha ? formatFechaISO(fecha) : ''
      const celdas: CeldaImpresion[] = bloquesSemestre.value.map(() => ({ tipo: 'vacia' }))
      // `publica` en false: se ve en pantalla igual que cualquier otra (arriba, en
      // `gridPorDia`), pero queda fuera del reporte en papel (y de la pantalla pública).
      const reservasDia = (reservas.value ?? []).filter((r) => r.fecha.slice(0, 10) === fechaISO && r.publica)
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
})

function celdaImpresionDe(diaValor: number, idxBloque: number): CeldaImpresion {
   return celdasImpresionPorDia.value.get(diaValor)?.[idxBloque] ?? { tipo: 'vacia' }
}
function rowspanImpresionDe(diaValor: number, idxBloque: number) {
   const celda = celdaImpresionDe(diaValor, idxBloque)
   return celda.tipo === 'reservas' ? celda.span : 1
}
function entradasImpresionDe(diaValor: number, idxBloque: number): EntradaImpresion[] {
   const celda = celdaImpresionDe(diaValor, idxBloque)
   return celda.tipo === 'reservas' ? celda.entradas : []
}

// Clases y ayudantías se describen por lo que se dicta (asignatura, carrera, profesor); el
// resto de las reservas, por su tipo. Mismo criterio que /horario/profesor: se mira el nombre
// del tipo de reserva, no `sesionParalelo` — una ayudantía es una reserva hecha a mano, sin
// sesión asociada, pero se lee igual que una clase.
const TIPOS_CLASE = ['Clase', 'Ayudantía']
function esClase(reserva: Reserva) {
   return TIPOS_CLASE.includes(reserva.tipoReserva.nombre)
}
function profesorDe(reserva: Reserva) {
   return reserva.persona ? `${reserva.persona.nombre} ${reserva.persona.apellido}` : null
}

// Nombre a mostrar de la asignatura de una reserva de sesión de clases: el corto si la
// asignatura tiene uno definido, si no el completo. Mismo criterio en /reservas/imprimir.
function nombreAsignaturaDe(reserva: Reserva) {
   const asignatura = reserva.sesionParalelo?.paralelo.asignaturaPlan.asignatura
   return asignatura ? (asignatura.nombreCorto ?? asignatura.nombre) : null
}

// Color impreso de una reserva. Las clases NO usan el color de su tipo: todas serían del mismo
// azul y la hoja quedaría de un solo tono. Cada paralelo lleva el suyo —el que se le asignó en
// /horario— para poder seguir una asignatura de un vistazo. Si todavía no tiene color asignado
// se toma uno de la misma paleta a partir de su identificador: no es aleatorio, el mismo
// paralelo sale siempre del mismo color, así el reporte no cambia entre impresiones.
function colorImpresion(reserva: Reserva) {
   if (reserva.cancelada) return COLOR_CANCELADA
   if (!esClase(reserva)) return reserva.tipoReserva.color
   const paralelo = reserva.sesionParalelo?.paralelo
   if (paralelo?.color) return paralelo.color
   const clave = paralelo ? `${paralelo.asignaturaPlan.asignatura.nombre}·${paralelo.codigo}` : reserva.titulo
   let indice = 0
   for (const caracter of clave) indice = (indice * 31 + caracter.charCodeAt(0)) % COLORES_RESERVA.length
   return COLORES_RESERVA[indice]!.hex
}

// El borde/color va en el propio <td> (no en un div interno): un <td rowspan> ocupa por
// definición todo el alto de las filas que combina, así que el borde queda garantizado a
// cubrir exactamente ese espacio. Un div interno con `height: 100%` para lograr lo mismo no es
// confiable en el motor de impresión de todos los navegadores. Colores claros para no gastar
// tinta: mismo tono que en pantalla pero con menos opacidad de fondo (si hay más de una
// reserva solapada en la celda, se usa el color de la primera — caso raro en la vista impresa
// de una sola sala).
function estiloCeldaImpresion(diaValor: number, idxBloque: number) {
   const entrada = entradasImpresionDe(diaValor, idxBloque)[0]
   if (!entrada) return {}
   const color = colorImpresion(entrada.reserva)
   return { borderColor: color, backgroundColor: `${color}14` }
}

function imprimirHorario() {
   window.print()
}

/* ── Tiempo real ─────────────────────────────────────────────
   Varias personas reservan salas a la vez: cuando alguien cambia algo, el servidor avisa por
   SSE y la semana en pantalla se recarga sola.

   Interesan dos tipos de evento: 'reserva' (lo que se edita en esta misma página) y 'sesion',
   porque asignarle sala a una clase genera o borra su reserva recurrente sin pasar por acá
   (ver server/utils/reservasSesion.ts). El resto —paralelos, salas, profesores— no cambia lo
   que muestra esta grilla.

   Va al final del script a propósito: depende de los refs de los modales y del arrastre, que
   se declaran más arriba, y `watch` evalúa su fuente apenas se registra.

   No se refresca con un modal abierto ni con una reserva arrastrándose: recargar bajo el cursor
   movería los bloques o dejaría el formulario apuntando a una reserva que ya cambió. El
   refresco queda pendiente y se aplica al cerrar. */
const editandoAlgo = computed(
   () => modalCrearMostrar.value || modalEditarMostrar.value || modalDetalleMostrar.value || arrastre.value !== null
)
const refrescoPendiente = ref(false)

const { conectado: enVivo } = useHorarioTiempoReal(async (eventos) => {
   const relevantes = eventos.filter((e) => e.tipo === 'reserva' || e.tipo === 'sesion')
   if (!relevantes.length) return

   if (editandoAlgo.value) {
      refrescoPendiente.value = true
      return
   }
   await refrescarReservas()

   // Solo se avisa de los cambios de otras personas: el propio autor ya vio el suyo.
   const ajenos = relevantes.filter((e) => e.autorEmail !== user.value?.email)
   if (!ajenos.length) return

   const autores = [...new Set(ajenos.map((e) => e.autorNombre))]
   toast.add({
      title: autores.length === 1 ? `${autores[0]} hizo cambios` : 'Varias personas hicieron cambios',
      description: 'Se actualizaron las reservas.',
      color: 'info',
      icon: 'i-lucide-refresh-cw',
   })
}, '/reservas/horario')

// Al cerrar el modal (o soltar el arrastre) se aplica el refresco que haya quedado pendiente.
watch(editandoAlgo, async (ocupado) => {
   if (!ocupado && refrescoPendiente.value) {
      refrescoPendiente.value = false
      await refrescarReservas()
   }
})
</script>

<template>
   <div class="print:hidden space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Horario de reservas de cada sala. Haz click en una celda vacía para agendar una reserva.
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
            <USwitch
               v-if="bloquesSemestre.length"
               v-model="mostrarFinSemana"
               label="Mostrar fin de semana"
               class="shrink-0"
            />
         </div>
      </div>

      <!-- Controles -->
      <div class="flex flex-wrap items-center justify-between gap-2">
         <div class="flex flex-wrap items-center gap-3">
            <span
               v-if="salaActual"
               class="inline-flex items-center gap-1.5 rounded-full bg-usm-blue/10 px-3 py-1 text-sm font-semibold text-usm-blue dark:bg-usm-cyan/10 dark:text-usm-cyan"
            >
               <UIcon name="i-lucide-door-open" class="size-3.5" />
               {{ salaActual.codigo }} · {{ salaActual.tipoSala.nombre }}
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
            <UButton
               icon="i-lucide-printer"
               color="neutral"
               variant="outline"
               aria-label="Imprimir horario"
               :disabled="!salaActual || !bloquesSemestre.length"
               @click="imprimirHorario"
            >
               Imprimir
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
      <div v-else class="flex flex-col gap-3 lg:flex-row">
         <!-- Panel de salas -->
         <div class="order-2 flex w-full flex-col rounded-2xl border border-default bg-default lg:w-72 lg:shrink-0">
            <div class="space-y-2 border-b border-default p-3">
               <UInput v-model="busquedaSala" icon="i-lucide-search" placeholder="Buscar sala…" class="w-full" />
               <USelect v-model="filtroTipoSala" :items="opcionesTipoSala" value-key="value" class="w-full" />
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
                  <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                     {{ sala.tipoSala.nombre }} · {{ sala.capacidad }} personas
                  </p>
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
               <UContextMenu :items="itemsMenuContextual">
                  <table class="w-full border-separate border-spacing-0 text-sm">
                     <thead>
                        <tr>
                           <th
                              class="sticky left-0 z-2 w-16 border-b border-default border-e-2 border-e-usm-text-muted/30 bg-muted p-1 text-left text-xs font-semibold text-usm-text-muted dark:border-e-slate-500/50 dark:text-slate-400"
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
                                 class="sticky left-0 z-1 h-2.5 border-e-2 border-e-usm-text-muted/30 bg-muted p-0 text-right align-top text-[10px] font-normal text-usm-text-muted dark:border-e-slate-500/50 dark:text-slate-400"
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
                                       celdaSobre?.diaValor === dia.valor && celdaSobre?.franjaIndice === franja.indice
                                          ? 'outline-2 -outline-offset-2 outline-usm-blue/40'
                                          : '',
                                    ]"
                                    @click="abrirCrear(dia.valor, franja)"
                                    @dragover="onDragOverCelda(dia.valor, franja, $event)"
                                    @drop="onDropCelda(dia.valor, franja, $event)"
                                    @contextmenu="onContextMenuCelda(dia.valor, franja, $event)"
                                 >
                                    <div class="relative h-full">
                                       <div
                                          v-for="rp in reservasEnCelda(dia.valor, franja.indice)"
                                          :key="rp.reserva.id"
                                          :data-reserva-id="rp.reserva.id"
                                          :draggable="puedeModificarReserva(rp.reserva)"
                                          class="absolute box-border overflow-hidden rounded-md border p-1 text-[11px] leading-tight text-usm-text dark:text-slate-100"
                                          :class="
                                             puedeModificarReserva(rp.reserva)
                                                ? 'cursor-grab active:cursor-grabbing'
                                                : ''
                                          "
                                          :style="[estiloPosicion(rp), estiloReserva(rp.reserva)]"
                                          @click.stop="abrirDetalle(rp.reserva)"
                                          @dragstart="iniciarArrastre($event, rp.reserva)"
                                          @dragend="terminarArrastre"
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
                                             class="flex min-w-0 items-start gap-1 text-xs font-bold"
                                             :class="rp.reserva.cancelada ? 'line-through opacity-70' : ''"
                                          >
                                             <UIcon
                                                v-if="rp.reserva.serieId"
                                                name="i-lucide-repeat"
                                                class="mt-0.5 size-3 shrink-0"
                                                title="Reserva recurrente"
                                             />
                                             <UIcon
                                                v-if="!rp.reserva.publica"
                                                name="i-lucide-eye-off"
                                                class="mt-0.5 size-3 shrink-0"
                                                title="No se incluye en la vista impresa ni en la pantalla pública"
                                             />
                                             <span class="wrap-break-word whitespace-normal">{{
                                                rp.reserva.titulo
                                             }}</span>
                                          </span>
                                          <template v-if="rp.reserva.sesionParalelo">
                                             <div class="truncate">{{ nombreAsignaturaDe(rp.reserva) }}</div>
                                             <div class="truncate">
                                                {{
                                                   rp.reserva.sesionParalelo.paralelo.asignaturaPlan.plan.carrera
                                                      .nombreCorto
                                                }}
                                             </div>
                                          </template>
                                          <!-- Quién figura como responsable, en cualquier tipo de reserva (clases,
                                               ayudantías, reuniones, eventos…) — si tiene uno asignado. -->
                                          <div v-if="rp.reserva.persona" class="truncate">
                                             {{ rp.reserva.persona.nombre }} {{ rp.reserva.persona.apellido }}
                                          </div>
                                       </div>
                                    </div>
                                 </td>
                              </template>
                           </tr>
                        </template>
                     </tbody>
                  </table>
               </UContextMenu>
            </div>
         </div>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="4" />

      <!-- Modal crear reserva -->
      <UModal
         v-model:open="modalCrearMostrar"
         :title="`Nueva reserva — ${salaActual?.codigo}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm id="form-reserva-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Título" name="titulo" :error="errorGuardar ?? undefined">
                  <UInput
                     v-model="formCrear.titulo"
                     maxlength="50"
                     placeholder="Reunión de coordinación…"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Fecha" name="fecha">
                  <UInput v-model="formCrear.fecha" type="date" class="w-full" />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
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
               <UFormField label="Tipo de reserva" name="tipoReservaId">
                  <USelect
                     v-model="formCrear.tipoReservaId"
                     :items="itemsTipoReservaCrear"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Reservado por" name="personaId">
                  <USelectMenu
                     v-model="formCrear.personaId"
                     :items="(personas ?? []).map((p) => ({ label: `${p.nombre} ${p.apellido}`, value: p.id }))"
                     value-key="value"
                     :search-input="{ placeholder: 'Buscar persona…' }"
                     class="w-full"
                  />
               </UFormField>
               <USwitch v-model="formCrear.recurrente" label="Reserva recurrente (se repite cada semana)" />
               <UFormField
                  v-if="formCrear.recurrente"
                  label="Repetir hasta"
                  name="repetirHasta"
                  description="Se crea una reserva cada semana, el mismo día y horario, hasta esta fecha (inclusive)."
               >
                  <UInput v-model="formCrear.repetirHasta" type="date" :min="formCrear.fecha" class="w-full" />
               </UFormField>
               <USwitch
                  v-model="formCrear.publica"
                  label="Reserva pública"
                  description="Desactívalo para que la reserva tome la sala igual, pero no aparezca en el reporte en papel ni en la pantalla pública."
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
            <UButton type="submit" form="form-reserva-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal detalle / borrar reserva -->
      <UModal v-model:open="modalDetalleMostrar" title="Detalle de la reserva" :ui="{ footer: 'justify-end' }">
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
                        v-if="!reservaSeleccionada.publica"
                        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-normal text-usm-text-muted dark:text-slate-400"
                     >
                        <UIcon name="i-lucide-eye-off" class="size-3" />
                        No es pública
                     </span>
                     <span
                        v-if="reservaSeleccionada.cancelada"
                        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-error/10 px-2 py-0.5 text-xs font-normal text-error"
                     >
                        <UIcon name="i-lucide-ban" class="size-3" />
                        Cancelada
                     </span>
                  </p>
               </div>
               <div v-if="reservaSeleccionada.sesionParalelo">
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">Asignatura</p>
                  <p class="font-medium text-usm-text dark:text-white">
                     {{ nombreAsignaturaDe(reservaSeleccionada) }}
                  </p>
                  <p class="text-usm-text-muted dark:text-slate-400">
                     {{ reservaSeleccionada.sesionParalelo.paralelo.asignaturaPlan.plan.carrera.nombre }} — Plan N°
                     {{ reservaSeleccionada.sesionParalelo.paralelo.asignaturaPlan.plan.numero }}
                  </p>
               </div>
               <div class="flex items-start justify-between gap-3">
                  <div class="space-y-0.5">
                     <p class="text-xs text-usm-text-muted dark:text-slate-400">Tipo</p>
                     <p class="flex items-center gap-1.5 font-medium text-usm-text dark:text-white">
                        <span
                           class="size-2.5 shrink-0 rounded-full"
                           :style="{ backgroundColor: reservaSeleccionada.tipoReserva.color }"
                        />
                        {{ reservaSeleccionada.tipoReserva.nombre }}
                     </p>
                  </div>
                  <div class="space-y-0.5 text-right">
                     <p class="text-xs text-usm-text-muted dark:text-slate-400">Sala</p>
                     <p class="font-medium text-usm-text dark:text-white">{{ reservaSeleccionada.sala.codigo }}</p>
                  </div>
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
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">Reservado por</p>
                  <p v-if="reservaSeleccionada.persona" class="font-medium text-usm-text dark:text-white">
                     {{ reservaSeleccionada.persona.nombre }} {{ reservaSeleccionada.persona.apellido }}
                  </p>
                  <p v-else class="text-usm-text-muted italic dark:text-slate-400">Sin responsable asignado</p>
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
               v-if="reservaSeleccionada && puedeEditarReserva(reservaSeleccionada)"
               color="neutral"
               variant="subtle"
               icon="i-lucide-pen"
               @click="abrirEditar(reservaSeleccionada!)"
            >
               Editar
            </UButton>
            <UButton
               v-if="reservaSeleccionada && puedeModificarReserva(reservaSeleccionada)"
               color="warning"
               variant="subtle"
               :icon="reservaSeleccionada.cancelada ? 'i-lucide-rotate-ccw' : 'i-lucide-ban'"
               :loading="cancelando"
               @click="alternarCancelada(reservaSeleccionada!)"
            >
               {{ reservaSeleccionada.cancelada ? 'Reactivar reserva' : 'Cancelar reserva' }}
            </UButton>
            <UButton
               v-if="reservaSeleccionada && puedeModificarReserva(reservaSeleccionada)"
               color="error"
               icon="i-lucide-calendar-x"
               @click="abrirConfirmBorrar(reservaSeleccionada!)"
            >
               Borrar reserva
            </UButton>
         </template>
      </UModal>

      <!-- Confirmar borrado de reserva -->
      <ConfirmModal
         v-model:open="confirmBorrarMostrar"
         title="Borrar reserva"
         confirm-label="Borrar reserva"
         confirm-icon="i-lucide-calendar-x"
         confirm-color="error"
         :loading="borrando"
         @confirm="borrarReserva"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Borrar la reserva
            <span class="font-semibold">{{ reservaSeleccionada?.titulo }}</span>
            del
            {{
               reservaSeleccionada
                  ? formatFechaDisplay(new Date(`${reservaSeleccionada.fecha.slice(0, 10)}T00:00:00`))
                  : ''
            }}?
         </p>
      </ConfirmModal>

      <!-- Borrar reserva recurrente: elegir alcance -->
      <UModal
         v-model:open="confirmBorrarSerieMostrar"
         title="Borrar reserva recurrente"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <p class="text-sm text-usm-text dark:text-slate-200">
               <span class="font-semibold">{{ reservaSeleccionada?.titulo }}</span> es parte de una serie de reservas
               recurrentes. ¿Qué deseas borrar?
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
               Solo esta reserva
            </UButton>
            <UButton color="error" icon="i-lucide-calendar-x" :loading="borrando" @click="borrarReserva('serie')">
               Esta y las siguientes
            </UButton>
         </template>
      </UModal>

      <!-- Modal editar reserva -->
      <UModal
         v-model:open="modalEditarMostrar"
         :title="`Editar reserva — ${reservaEditar?.sala.codigo}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm id="form-reserva-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Título" name="titulo" :error="errorEditar ?? undefined">
                  <UInput
                     v-model="formEditar.titulo"
                     maxlength="50"
                     placeholder="Reunión de coordinación…"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Fecha" name="fecha">
                  <UInput v-model="formEditar.fecha" type="date" class="w-full" />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
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
               <UFormField label="Tipo de reserva" name="tipoReservaId">
                  <USelect
                     v-model="formEditar.tipoReservaId"
                     :items="itemsTipoReservaEditar"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UFormField label="Reservado por" name="personaId">
                  <USelectMenu
                     v-model="formEditar.personaId"
                     :items="(personas ?? []).map((p) => ({ label: `${p.nombre} ${p.apellido}`, value: p.id }))"
                     value-key="value"
                     :search-input="{ placeholder: 'Buscar persona…' }"
                     class="w-full"
                  />
               </UFormField>
               <USwitch
                  v-model="formEditar.publica"
                  label="Reserva pública"
                  description="Desactívalo para que la reserva tome la sala igual, pero no aparezca en el reporte en papel ni en la pantalla pública."
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
            <UButton type="submit" form="form-reserva-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Editar reserva recurrente: elegir alcance -->
      <UModal
         v-model:open="confirmAlcanceEditarMostrar"
         title="Editar reserva recurrente"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <p class="text-sm text-usm-text dark:text-slate-200">
               <span class="font-semibold">{{ reservaEditar?.titulo }}</span> es parte de una serie de reservas
               recurrentes. ¿Qué deseas editar?
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
               Solo esta reserva
            </UButton>
            <UButton icon="i-lucide-pen" :loading="guardando" @click="ejecutarGuardarEditar('serie')">
               Esta y las siguientes
            </UButton>
         </template>
      </UModal>
   </div>

   <!-- Versión imprimible: solo visible al imprimir (ver .print:hidden arriba). Una fila por
        bloque horario del semestre, para que las líneas horizontales calcen con los bloques
        reales y quepa en una hoja carta. -->
   <div v-if="salaActual" class="hidden print:block">
      <div class="mb-3">
         <h1 class="text-[10.5pt] font-bold text-gray-900">
            {{ salaActual.codigo }} · {{ salaActual.tipoSala.nombre }}
         </h1>
         <p class="text-[7.5pt] text-gray-700">Semana del {{ rangoSemanaLabel }}</p>
      </div>
      <!-- `overflow-hidden` recorta las esquinas de la tabla contra el radio del contenedor, que es
           quien dibuja el marco: por eso las celdas solo llevan sus bordes interiores (`border-b`
           y `border-e`). Se mantiene `border-separate` para que el recuadro de color de cada
           reserva conserve su borde completo — con `border-collapse` el borde de la celda de
           arriba/izquierda le ganaría y el recuadro saldría gris por dos de sus lados. Por eso las
           celdas con reserva llevan `border` (los cuatro lados) en vez de los bordes interiores de
           la grilla, y quedan fuera de las reglas que recortan el último borde de cada fila y
           columna: si no, el recuadro perdía su lado derecho en la última columna —y el inferior
           en la última fila— y solo se veía el marco gris de la matriz. -->
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
            <!-- La última fila no lleva borde inferior: se solaparía con el del contenedor justo
                 en la curva de las esquinas. Se exceptúan las celdas con reserva (`data-reserva`),
                 que necesitan su recuadro de color cerrado por los cuatro lados. -->
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
                        v-if="celdaImpresionDe(dia.valor, idxBloque).tipo !== 'oculta'"
                        :rowspan="rowspanImpresionDe(dia.valor, idxBloque)"
                        class="border-[#d4d4d4] p-1 align-top"
                        :class="
                           entradasImpresionDe(dia.valor, idxBloque).length
                              ? 'border'
                              : 'border-b border-e last:border-e-0'
                        "
                        :data-reserva="entradasImpresionDe(dia.valor, idxBloque).length ? '' : undefined"
                        :style="estiloCeldaImpresion(dia.valor, idxBloque)"
                     >
                        <div
                           v-for="entrada in entradasImpresionDe(dia.valor, idxBloque)"
                           :key="entrada.reserva.id"
                           class="leading-tight not-last:mb-1 not-last:border-b not-last:border-dashed not-last:border-[#d4d4d4] not-last:pb-1"
                        >
                           <p v-if="entrada.reserva.cancelada" class="font-bold wrap-break-word text-black">
                              CANCELADA
                           </p>
                           <p
                              class="font-semibold wrap-break-word text-black"
                              :class="entrada.reserva.cancelada ? 'line-through' : ''"
                           >
                              {{ entrada.reserva.titulo }}
                           </p>
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
/* Tailwind no tiene utilidad para @page — única forma de fijar tamaño/márgenes de la hoja. */
@page {
   size: letter portrait;
   /* Mitad del margen habitual (1.27cm) para ganar ancho de tabla. Por debajo de ~0.5cm varias
      impresoras recortan igual, así que este es el piso razonable. */
   margin: 0.635cm;
}

/* El resto de los ajustes de impresión (modo claro forzado y print-color-adjust) es global:
   está en app/assets/css/main.css. */
</style>
