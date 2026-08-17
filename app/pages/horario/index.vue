<script setup lang="ts">
import type { Semestre } from '~/types/semestre'
import type { Bloque } from '~/types/bloque'
import type { Paralelo } from '~/types/paralelo'
import type { Sala } from '~/types/sala'
import type { Persona } from '~/types/persona'
import type { SesionParalelo, TipoSesion } from '~/types/sesion'
import type { Carrera } from '~/types/carrera'
import type { Curso } from '~/types/curso'
import type { ProfesorHistorialAsignatura } from '~/types/asignatura'
import { DIAS_SEMANA, DIAS_FIN_SEMANA } from '~/types/dia'
// Misma paleta fija que los tipos de reserva (/reservas/tipos): un set acotado de colores
// distinguibles entre sí, en vez de dejar elegir cualquier hex.
import { COLORES_RESERVA } from '~/types/reserva'

const toast = useToast()

// Un Jefe de Carrera ve el horario de cualquier carrera, pero solo puede editar el de la(s)
// que dirige (mismo criterio que paralelos/asignacion.vue: ver useAlcanceCarrera.ts). El resto
// de los roles con permiso de mutar /horario no tiene esta restricción adicional.
const {
   puedeCrear: puedeCrearHorarioBase,
   puedeEditar: puedeEditarHorarioBase,
   puedeBorrar: puedeBorrarHorarioBase,
} = usePermiso('/horario')
const { tieneAlcanceSobreCarrera, puedeVerCarrera } = useAlcanceCarrera()

const { data: semestres } = await useFetch<Semestre[]>('/api/semestres')

/* ── Semestre que se está editando: por defecto el vigente, pero se puede cambiar ── */
const semestreSeleccionadoId = ref<number>()
watchEffect(() => {
   if (semestreSeleccionadoId.value == null && semestres.value?.length) {
      semestreSeleccionadoId.value = semestres.value.find((s) => s.vigente)?.id ?? semestres.value[0]!.id
   }
})
const opcionesSemestre = computed(() => (semestres.value ?? []).map((s) => ({ label: s.nombre, value: s.id })))
const semestreSeleccionado = computed(
   () => (semestres.value ?? []).find((s) => s.id === semestreSeleccionadoId.value) ?? null
)

const [
   { data: bloquesRaw },
   { data: paralelosRaw, refresh: refrescarParalelosLista },
   { data: salas, refresh: refrescarSalas },
   { data: personas, refresh: refrescarPersonas },
   { data: carreras },
   { data: cursos },
   { data: sesiones, refresh: refrescarSesiones },
   { data: ocupacion, refresh: refrescarOcupacion },
] = await Promise.all([
   useFetch<Bloque[]>('/api/bloques'),
   useFetch<Paralelo[]>('/api/paralelos'),
   useFetch<Sala[]>('/api/salas/mias'),
   useFetch<Persona[]>('/api/personas'),
   useFetch<Carrera[]>('/api/carreras'),
   useFetch<Curso[]>('/api/cursos'),
   useFetch<SesionParalelo[]>(() => `/api/sesiones?semestreId=${semestreSeleccionadoId.value ?? 0}`),
   // Ocupación de salas y profesores de todo el semestre (todas las carreras, no solo la
   // seleccionada) para poder avisar cuando la sala o el profesor de una sesión ya están
   // tomados en ese día/bloque por otro curso.
   useFetch<SesionParalelo[]>(() => `/api/sesiones/ocupacion?semestreId=${semestreSeleccionadoId.value ?? 0}`),
])

async function refrescarTodo() {
   await Promise.all([refrescarSesiones(), refrescarOcupacion()])
}

/* ── Tiempo real ─────────────────────────────────────────────
   Varias personas editan el horario a la vez. Cuando alguien cambia algo, el servidor
   avisa por SSE y aquí se recarga lo que corresponda: la matriz queda al día y los topes
   (sala, profesor) o el exceso de capacidad que el cambio ajeno haya generado aparecen
   solos, porque se calculan sobre esos mismos datos.

   Los cambios de sesiones y paralelos se filtran por el semestre en pantalla, pero no por
   el curso abierto: sala y profesor son recursos compartidos, así que un cambio en otra
   carrera puede generar un tope en el curso que se está viendo. Las salas y los profesores
   son globales (`semestreId: null`) y le importan a cualquier semestre. */
const { user } = useUserSession()

// Preferencia de /cuenta/preferencias: si se destacan los topes de paralelo espejo y con qué
// color. Se filtra en `conflictosSala`/`conflictosProfesor` (más abajo), así que apagarla hace
// que esas sesiones se vean como si no tuvieran tope — no solo que cambien de color.
const mostrarTopesEspejo = computed(() => user.value?.mostrarTopesEspejo ?? true)
const colorTopesEspejo = computed(() => user.value?.colorTopesEspejo ?? '#06B6D4')

const { conectado: enVivo } = useHorarioTiempoReal(async (eventos) => {
   // Las reservas de sala sueltas (/reservas/horario) no alteran la matriz de clases: se
   // ignoran para no refrescar ni avisar por un cambio que acá no se ve.
   const relevantes = eventos.filter(
      (e) => e.tipo !== 'reserva' && (e.semestreId === null || e.semestreId === semestreSeleccionadoId.value)
   )
   if (!relevantes.length) return

   const tipos = new Set(relevantes.map((e) => e.tipo))
   const refrescos = [refrescarTodo()]
   // Cada panel lateral se alimenta de su propio fetch.
   if (tipos.has('paralelo')) refrescos.push(refrescarParalelosLista())
   if (tipos.has('sala')) refrescos.push(refrescarSalas())
   if (tipos.has('profesor')) refrescos.push(refrescarPersonas())
   await Promise.all(refrescos)

   // Solo se avisa de los cambios de otras personas: el propio autor ya vio el suyo.
   const ajenos = relevantes.filter((e) => e.autorEmail !== user.value?.email)
   if (!ajenos.length) return

   const autores = [...new Set(ajenos.map((e) => e.autorNombre))]
   const tocados = [...new Set(ajenos.map((e) => e.descripcion))]
   toast.add({
      title: autores.length === 1 ? `${autores[0]} hizo cambios` : 'Varias personas hicieron cambios',
      description: `${tocados.join(', ')}.`,
      color: 'info',
      icon: 'i-lucide-refresh-cw',
   })
})

// Dos sesiones son "del mismo paralelo" si comparten asignatura y código de paralelo: es la
// misma clase física dictada en más de un curso (ver server/utils/sesionesEspejo.ts), no dos
// clases distintas. Se compara por código y no por paraleloId justamente porque son filas
// `Paralelo` distintas, una por curso. Mismo criterio que usa el informe de bloques por
// profesor (server/api/horario/profesores.get.ts) para no contar dos veces esos bloques.
function esMismoParalelo(a: SesionParalelo, b: SesionParalelo) {
   return (
      a.paralelo.asignaturaPlan.asignatura.id === b.paralelo.asignaturaPlan.asignatura.id &&
      a.paralelo.codigo === b.paralelo.codigo
   )
}

// Una asignatura marcada exenta en /configuracion (por plan, ver AsignaturaPlan.exentaTope)
// nunca genera ni recibe una advertencia de tope: ni se avisa de ella, ni de otra sesión que
// choque con ella.
function exentaDeTope(sesion: SesionParalelo) {
   return sesion.paralelo.asignaturaPlan.exentaTope
}

// Otras sesiones (de cualquier carrera) que ocupan la misma sala en el mismo día y bloque. Si
// la persona apagó "Destacar paralelos en más de un curso" (/cuenta/preferencias), las que son
// del mismo paralelo se descartan acá mismo: la sesión queda como si no tuviera tope, no solo
// sin el color — no hay badge ni popover que la distinga.
function conflictosSala(sesion: SesionParalelo) {
   if (!sesion.salaCodigo || sesion.bloqueId === null || exentaDeTope(sesion)) return []
   const ocupantes = (ocupacion.value ?? []).filter(
      (o) =>
         o.id !== sesion.id &&
         o.salaCodigo === sesion.salaCodigo &&
         o.diaSemana === sesion.diaSemana &&
         o.bloqueId === sesion.bloqueId &&
         !exentaDeTope(o)
   )
   return mostrarTopesEspejo.value ? ocupantes : ocupantes.filter((o) => !esMismoParalelo(sesion, o))
}

// Otras sesiones (de cualquier carrera) donde el mismo profesor ya hace clases en ese mismo
// día y bloque. Mismo filtro que `conflictosSala` cuando la preferencia está apagada.
function conflictosProfesor(sesion: SesionParalelo) {
   if (!sesion.profesorId || sesion.bloqueId === null || exentaDeTope(sesion)) return []
   const ocupantes = (ocupacion.value ?? []).filter(
      (o) =>
         o.id !== sesion.id &&
         o.profesorId === sesion.profesorId &&
         o.diaSemana === sesion.diaSemana &&
         o.bloqueId === sesion.bloqueId &&
         !exentaDeTope(o)
   )
   return mostrarTopesEspejo.value ? ocupantes : ocupantes.filter((o) => !esMismoParalelo(sesion, o))
}

function conflictos(sesion: SesionParalelo) {
   return [...conflictosSala(sesion), ...conflictosProfesor(sesion)]
}

function tieneTope(sesion: SesionParalelo) {
   return conflictos(sesion).length > 0
}

// Un tope contra el mismo paralelo en otro curso es esperable: la sala y el profesor están
// tomados una sola vez porque es una sola clase. Se destaca con el color elegido en
// /cuenta/preferencias (celeste por defecto) para que se vea que ahí hay más de un curso, pero
// sin la alarma del amarillo. El amarillo (warning) queda para el choque real: paralelos
// distintos peleando por la misma sala o el mismo profesor. Si una sesión tiene los dos casos a
// la vez, manda el choque real.
function soloMismoParalelo(sesion: SesionParalelo, lista: SesionParalelo[]) {
   return lista.length > 0 && lista.every((otra) => esMismoParalelo(sesion, otra))
}

function topeEsEspejo(sesion: SesionParalelo) {
   return soloMismoParalelo(sesion, conflictos(sesion))
}

// Color, icono y encabezado de cada popover de tope (el de sala y el de profesor se evalúan por
// separado: una sesión puede compartir sala con su espejo y a la vez chocar de profesor). El
// color del espejo va por estilo inline (`estiloTextoTope`), no por clase: es arbitrario, elegido
// en /cuenta/preferencias, y Tailwind no genera clases para un color en tiempo de ejecución.
function claseTope(sesion: SesionParalelo, lista: SesionParalelo[]) {
   return soloMismoParalelo(sesion, lista) ? '' : 'text-usm-yellow-700 dark:text-usm-yellow-400'
}

function estiloTextoTope(sesion: SesionParalelo, lista: SesionParalelo[]) {
   return soloMismoParalelo(sesion, lista) ? { color: colorTopesEspejo.value } : {}
}

function iconoTope(sesion: SesionParalelo, lista: SesionParalelo[]) {
   return soloMismoParalelo(sesion, lista) ? 'i-lucide-copy' : 'i-lucide-triangle-alert'
}

function excedeCapacidad(sesion: SesionParalelo) {
   return !!sesion.sala && sesion.paralelo.cupo > sesion.sala.capacidad
}

function estiloColor(hex: string) {
   return { backgroundColor: `${hex}1a`, borderColor: `${hex}4d` }
}

// Color de fondo/borde de la sesión: primero el tope de paralelo espejo (color de
// /cuenta/preferencias), después el color propio del paralelo (si tiene uno y no hay tope, que
// ya se marca en amarillo por clase independientemente del color elegido). Estilo inline porque
// Tailwind no puede generar clases para un color arbitrario definido en tiempo de ejecución.
function estiloSesion(sesion: SesionParalelo) {
   if (topeEsEspejo(sesion)) return estiloColor(colorTopesEspejo.value)
   const color = sesion.paralelo.color
   if (!color || tieneTope(sesion)) return {}
   return estiloColor(color)
}

function imprimirHorario() {
   window.print()
}

const bloques = computed(() =>
   (bloquesRaw.value ?? [])
      .filter((b) => b.semestreId === semestreSeleccionadoId.value)
      .sort((a, b) => a.numero - b.numero)
)
const profesores = computed(() => personas.value ?? [])

const busquedaSala = ref('')
const salasFiltradas = computed(() =>
   (salas.value ?? []).filter((s) => normalizarTexto(s.codigo).includes(normalizarTexto(busquedaSala.value)))
)

const busquedaProfesor = ref('')
const profesoresFiltrados = computed(() =>
   profesores.value.filter((p) =>
      normalizarTexto(`${p.nombre} ${p.apellido}`).includes(normalizarTexto(busquedaProfesor.value))
   )
)

/* ── Carga de cada profesor en el semestre ───────────────────
   Se cuenta con las mismas reglas que el informe /horario/profesores
   (server/api/horario/profesores.get.ts): combinaciones únicas de asignatura + código de
   paralelo + día + bloque. Deduplicar por código de paralelo (y no por su id) es lo que hace
   que un mismo paralelo dictado en varios cursos — ver server/utils/sesionesEspejo.ts — sume
   una sola vez en vez de multiplicarse.

   `ocupacion` ya trae todas las sesiones del semestre de todas las carreras (no solo la
   seleccionada) y se refresca en vivo, así que el conteo no necesita otro fetch. A diferencia
   del informe, acá no se filtra por plan: es la carga total del profesor en el semestre. */
const bloquesPorProfesor = computed(() => {
   const porProfesor = new Map<number, Set<string>>()
   for (const sesion of ocupacion.value ?? []) {
      if (!sesion.profesorId || sesion.bloqueId === null) continue
      const clave = `${sesion.paralelo.asignaturaPlan.asignatura.id}-${sesion.paralelo.codigo}-${sesion.diaSemana}-${sesion.bloqueId}`
      const bloques = porProfesor.get(sesion.profesorId) ?? new Set<string>()
      bloques.add(clave)
      porProfesor.set(sesion.profesorId, bloques)
   }
   return porProfesor
})

function bloquesDeProfesor(profesorId: number) {
   return bloquesPorProfesor.value.get(profesorId)?.size ?? 0
}

// Umbrales de sobrecarga: una jornada parcial con carga de jornada completa, o una jornada
// completa por sobre su carga docente esperada.
const UMBRAL_BLOQUES_PARCIAL = 22
const UMBRAL_BLOQUES_COMPLETA = 20

// Clases del contador: `error` (danger) para la parcial sobrecargada, `warning` para la
// completa. Sin excedente no se destaca, para no teñir toda la lista.
function claseBloquesProfesor(profesor: Persona) {
   const bloques = bloquesDeProfesor(profesor.id)
   if (profesor.jornadaLaboral === 'PARCIAL' && bloques > UMBRAL_BLOQUES_PARCIAL) {
      return 'font-semibold text-error'
   }
   if (profesor.jornadaLaboral === 'COMPLETA' && bloques > UMBRAL_BLOQUES_COMPLETA) {
      return 'font-semibold text-warning'
   }
   return 'text-usm-text-muted dark:text-slate-400'
}

// Paneles laterales colapsables (todos abiertos por defecto, ver :default-value). "Profesores
// anteriores" va justo sobre "Profesores": se llena al hacer click en una sesión de clases de
// la matriz (ver `sesionSeleccionadaId` y el watch de `historialProfesores` más abajo).
const panelesLaterales = [
   { label: 'Paralelos', icon: 'i-lucide-users-round', slot: 'paralelos' },
   { label: 'Salas', icon: 'i-lucide-door-open', slot: 'salas' },
   { label: 'Profesores anteriores', icon: 'i-lucide-history', slot: 'profesoresAnteriores' },
   { label: 'Profesores', icon: 'i-lucide-user', slot: 'profesores' },
]

/* ── Selección de carrera / curso ───────────────────────────
   Cada carrera puede tener varios cursos (1er año, 2do año, ...) dentro de
   su plan vigente; el horario se arma y navega curso por curso. */
const carreraSeleccionada = ref<number>()

// Igual que puedeModificarPlanActual en paralelos/asignacion.vue: como toda la página gira en
// torno a UNA carrera a la vez, basta un solo chequeo por acción.
const puedeModificarCarreraActual = computed(
   () => !!carreraSeleccionada.value && tieneAlcanceSobreCarrera(carreraSeleccionada.value)
)
const puedeCrearHorario = computed(() => puedeCrearHorarioBase.value && puedeModificarCarreraActual.value)
const puedeEditarHorario = computed(() => puedeEditarHorarioBase.value && puedeModificarCarreraActual.value)
const puedeBorrarHorario = computed(() => puedeBorrarHorarioBase.value && puedeModificarCarreraActual.value)

// Solo se ofrecen las carreras que tienen cursos en el semestre seleccionado: elegir una sin
// cursos dejaría la matriz vacía sin explicar por qué. El filtro es el mismo que el de
// `cursosDeCarrera` (plan vigente + semestre), así que lo que se ofrece es exactamente lo que
// después se puede ver. La etiqueta lleva el número de plan porque es el que define la malla.
// También se descartan las carreras fuera del alcance de la persona (puedeVerCarrera) — mismo
// criterio que ya aplica el backend en GET /api/sesiones (resolverCarrerasAsignadas).
const opcionesCarrera = computed(() => {
   const porCarrera = new Map<number, { nombre: string; planes: Set<number> }>()
   for (const curso of cursos.value ?? []) {
      if (!curso.plan.vigente || curso.semestreId !== semestreSeleccionadoId.value) continue
      if (!puedeVerCarrera(curso.plan.carreraCodigo)) continue
      const entrada = porCarrera.get(curso.plan.carreraCodigo)
      if (entrada) entrada.planes.add(curso.plan.numero)
      else
         porCarrera.set(curso.plan.carreraCodigo, {
            nombre: curso.plan.carrera.nombre,
            planes: new Set([curso.plan.numero]),
         })
   }
   // Nada impide que una carrera tenga más de un plan vigente con cursos en el semestre; en ese
   // caso se listan todos sus números en vez de esconder uno.
   return [...porCarrera.entries()]
      .map(([codigo, { nombre, planes }]) => ({
         label: `${nombre} (Plan: ${[...planes].sort((a, b) => a - b).join(', ')})`,
         value: codigo,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
})

// Al cambiar de semestre la carrera elegida puede quedarse sin cursos: se salta a la primera
// disponible, igual que hace `cursoSeleccionado` más abajo.
watch(
   opcionesCarrera,
   (opciones) => {
      if (opciones.length && !opciones.some((o) => o.value === carreraSeleccionada.value)) {
         carreraSeleccionada.value = opciones[0]!.value
      }
   },
   { immediate: true }
)

const cursosDeCarrera = computed(() =>
   (cursos.value ?? []).filter(
      (c) =>
         c.plan.carreraCodigo === carreraSeleccionada.value &&
         c.plan.vigente &&
         c.semestreId === semestreSeleccionadoId.value
   )
)
const opcionesCursoTabs = computed(() => cursosDeCarrera.value.map((c) => ({ label: c.nombre, value: c.id })))

const cursoSeleccionado = ref<number>()
watch(
   cursosDeCarrera,
   (lista) => {
      if (!lista.some((c) => c.id === cursoSeleccionado.value)) {
         cursoSeleccionado.value = lista[0]?.id
      }
   },
   { immediate: true }
)
const cursoActual = computed(() => cursosDeCarrera.value.find((c) => c.id === cursoSeleccionado.value) ?? null)

// El curso ya está acotado al semestre seleccionado (ver `cursosDeCarrera`), así que basta con su id.
const paralelos = computed(() => (paralelosRaw.value ?? []).filter((p) => p.cursoId === cursoSeleccionado.value))
const sesionesDelCurso = computed(() =>
   (sesiones.value ?? []).filter((s) => s.paralelo.cursoId === cursoSeleccionado.value)
)

/* ── Panel "Profesores anteriores": quién ha dictado la asignatura de la sesión elegida ───
   Se guarda el id (no la sesión completa) para que la selección se recalcule sola contra la
   lista viva de `sesionesDelCurso` — si la sesión se mueve o se borra, `sesionSeleccionada`
   se actualiza o se vacía sin código aparte. */
const sesionSeleccionadaId = ref<number | null>(null)
const sesionSeleccionada = computed(
   () => sesionesDelCurso.value.find((s) => s.id === sesionSeleccionadaId.value) ?? null
)

function seleccionarSesion(sesion: SesionParalelo) {
   sesionSeleccionadaId.value = sesionSeleccionadaId.value === sesion.id ? null : sesion.id
}

// Si la sesión seleccionada deja de existir en el curso actual (se borró, se movió a otro
// curso, o se cambió de curso/carrera/semestre), se limpia la selección — y con ella,
// vía el watch de abajo, el historial que estaba mostrando.
watch(sesionesDelCurso, (lista) => {
   if (sesionSeleccionadaId.value !== null && !lista.some((s) => s.id === sesionSeleccionadaId.value)) {
      sesionSeleccionadaId.value = null
   }
})

const historialProfesores = ref<ProfesorHistorialAsignatura[]>([])
const cargandoHistorial = ref(false)

watch(sesionSeleccionadaId, async (id) => {
   if (id === null) {
      historialProfesores.value = []
      return
   }
   const sesion = sesionesDelCurso.value.find((s) => s.id === id)
   if (!sesion) return
   cargandoHistorial.value = true
   try {
      historialProfesores.value = await $fetch<ProfesorHistorialAsignatura[]>(
         `/api/asignaturas/${sesion.paralelo.asignaturaPlan.asignatura.id}/profesores-historial`,
         { query: { excluirSemestreId: semestreSeleccionadoId.value } }
      )
   } catch {
      historialProfesores.value = []
   } finally {
      cargandoHistorial.value = false
   }
})

function formatHora(hora: string) {
   return hora.slice(11, 16)
}

// Algunas carreras no planifican sábado/domingo: se pueden ocultar esas columnas.
const mostrarFinSemana = ref(false)
const diasVisibles = computed(() =>
   mostrarFinSemana.value ? DIAS_SEMANA : DIAS_SEMANA.filter((d) => !DIAS_FIN_SEMANA.includes(d.valor))
)

/* ── Consultas de la matriz ──────────────────────────────── */
function sesionesEnCelda(diaSemana: number, bloqueId: number) {
   return sesionesDelCurso.value.filter((s) => s.diaSemana === diaSemana && s.bloqueId === bloqueId)
}

/* ── Vista imprimible ────────────────────────────────────────────────────
   El horario de un curso es una plantilla semanal (sin fechas): a diferencia de
   /reservas/horario, cada sesión ya vive en un único (día, bloque) exacto, así que no hace
   falta agrupar por solapamiento — solo fusionar, en un mismo día, los bloques CONSECUTIVOS
   que son la misma clase (un paralelo de teoría/práctica que ocupa varios bloques seguidos),
   igual que en el reporte impreso de /reservas/horario: un solo recuadro con `rowspan` en vez
   de la misma sesión repetida bloque a bloque. */
function mismaActividadImpresion(a: SesionParalelo, b: SesionParalelo) {
   return (
      a.paraleloId === b.paraleloId &&
      a.tipo === b.tipo &&
      a.salaCodigo === b.salaCodigo &&
      a.profesorId === b.profesorId
   )
}

interface TramoImpresionCurso {
   idxInicio: number
   idxFin: number
   sesiones: SesionParalelo[]
}

// Solo se fusionan tramos de una sesión: si en el bloque de inicio hay más de una (paralelos
// distintos coincidiendo), cuál continúa con cuál es ambiguo y se deja tal cual.
function fusionarContiguasImpresion(tramos: TramoImpresionCurso[]) {
   const fusionados: TramoImpresionCurso[] = []
   for (const tramo of tramos) {
      const anterior = fusionados[fusionados.length - 1]
      if (
         anterior &&
         anterior.sesiones.length === 1 &&
         tramo.sesiones.length === 1 &&
         anterior.idxFin + 1 === tramo.idxInicio &&
         mismaActividadImpresion(anterior.sesiones[0]!, tramo.sesiones[0]!)
      ) {
         anterior.idxFin = tramo.idxFin
         continue
      }
      fusionados.push(tramo)
   }
   return fusionados
}

type CeldaImpresionCurso =
   { tipo: 'vacia' } | { tipo: 'oculta' } | { tipo: 'sesiones'; sesiones: SesionParalelo[]; span: number }

const celdasImpresionPorDia = computed(() => {
   const mapa = new Map<number, CeldaImpresionCurso[]>()
   for (const dia of diasVisibles.value) {
      const celdas: CeldaImpresionCurso[] = bloques.value.map(() => ({ tipo: 'vacia' }))
      const tramos: TramoImpresionCurso[] = []
      bloques.value.forEach((bloque, idx) => {
         const sesionesCelda = sesionesEnCelda(dia.valor, bloque.id!)
         if (sesionesCelda.length) tramos.push({ idxInicio: idx, idxFin: idx, sesiones: sesionesCelda })
      })
      for (const tramo of fusionarContiguasImpresion(tramos)) {
         celdas[tramo.idxInicio] = {
            tipo: 'sesiones',
            sesiones: tramo.sesiones,
            span: tramo.idxFin - tramo.idxInicio + 1,
         }
         for (let i = tramo.idxInicio + 1; i <= tramo.idxFin; i++) {
            celdas[i] = { tipo: 'oculta' }
         }
      }
      mapa.set(dia.valor, celdas)
   }
   return mapa
})

function celdaImpresionDe(diaValor: number, idxBloque: number): CeldaImpresionCurso {
   return celdasImpresionPorDia.value.get(diaValor)?.[idxBloque] ?? { tipo: 'vacia' }
}
function rowspanImpresionDe(diaValor: number, idxBloque: number) {
   const celda = celdaImpresionDe(diaValor, idxBloque)
   return celda.tipo === 'sesiones' ? celda.span : 1
}
function sesionesImpresionDe(diaValor: number, idxBloque: number): SesionParalelo[] {
   const celda = celdaImpresionDe(diaValor, idxBloque)
   return celda.tipo === 'sesiones' ? celda.sesiones : []
}

// En pantalla el tope manda sobre el color del paralelo (para no perder la alerta), pero en el
// reporte impreso siempre se usa el color asignado al paralelo —o uno por tipo si no tiene
// uno— porque es un documento de referencia, no de edición. Si hay más de una sesión apilada
// en la celda (paralelos distintos coincidiendo) se usa el color de la primera.
function estiloCeldaImpresion(diaValor: number, idxBloque: number) {
   const sesion = sesionesImpresionDe(diaValor, idxBloque)[0]
   if (!sesion) return {}
   const color = sesion.paralelo.color ?? (sesion.tipo === 'TEORIA' ? '#0055a5' : '#008452')
   return { borderColor: color, backgroundColor: `${color}1a` }
}

function estaProtegido(diaSemana: number, bloque: Bloque) {
   return bloque.diasProtegidos.includes(diaSemana)
}

function usados(paraleloId: number, tipo: TipoSesion) {
   return sesionesDelCurso.value.filter((s) => s.paraleloId === paraleloId && s.tipo === tipo).length
}

function claseCelda(diaSemana: number, bloque: Bloque) {
   if (estaProtegido(diaSemana, bloque)) return 'bg-gray-200/70 dark:bg-slate-700/40'
   if (DIAS_FIN_SEMANA.includes(diaSemana)) return 'bg-gray-50 dark:bg-slate-800/40'
   if (bloque.jornada === 'VESPERTINA') return 'bg-usm-purple/5 dark:bg-usm-purple/15'
   return 'bg-default'
}

/* ── Drag and drop ───────────────────────────────────────── */
type Arrastre =
   | { kind: 'paralelo'; paraleloId: number; tipo: TipoSesion }
   | { kind: 'sesion'; sesionId: number }
   | { kind: 'sala'; salaCodigo: string }
   | { kind: 'profesor'; profesorId: number }

const arrastre = ref<Arrastre | null>(null)

function iniciarArrastre(e: DragEvent, payload: Arrastre) {
   arrastre.value = payload
   e.dataTransfer?.setData('text/plain', payload.kind)
   if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function terminarArrastre() {
   arrastre.value = null
   celdaSobre.value = null
}

function permiteDropCelda(diaSemana: number, bloque: Bloque) {
   const kind = arrastre.value?.kind
   if (estaProtegido(diaSemana, bloque)) return false
   if (kind === 'paralelo') return puedeCrearHorario.value
   if (kind === 'sesion') return puedeEditarHorario.value
   return false
}

// Solo se resalta la celda que está bajo el cursor (no todas las celdas válidas a la
// vez): resaltarlas todas apenas empieza el arrastre haría que decenas de celdas
// transicionen su color al mismo tiempo, lo que se percibe como un parpadeo general
// de la matriz.
const celdaSobre = ref<{ diaSemana: number; bloqueId: number } | null>(null)

function onDragOverCelda(e: DragEvent, diaSemana: number, bloque: Bloque) {
   if (!permiteDropCelda(diaSemana, bloque)) return
   e.preventDefault()
   if (bloque.id != null && (celdaSobre.value?.diaSemana !== diaSemana || celdaSobre.value?.bloqueId !== bloque.id)) {
      celdaSobre.value = { diaSemana, bloqueId: bloque.id }
   }
}

async function onDropCelda(e: DragEvent, diaSemana: number, bloque: Bloque) {
   if (!permiteDropCelda(diaSemana, bloque)) return
   e.preventDefault()
   celdaSobre.value = null
   const a = arrastre.value
   arrastre.value = null
   if (bloque.id == null) return
   if (a?.kind === 'paralelo') await crearSesion(a.paraleloId, diaSemana, bloque.id, a.tipo)
   else if (a?.kind === 'sesion') await moverSesion(a.sesionId, diaSemana, bloque.id)
}

const permiteDropSesion = computed(
   () => (arrastre.value?.kind === 'sala' || arrastre.value?.kind === 'profesor') && puedeEditarHorario.value
)

function onDragOverSesion(e: DragEvent) {
   if (permiteDropSesion.value) e.preventDefault()
}

async function onDropSesion(e: DragEvent, sesion: SesionParalelo) {
   if (!permiteDropSesion.value) return
   e.preventDefault()
   e.stopPropagation()
   const a = arrastre.value
   arrastre.value = null
   if (a?.kind === 'sala') await asignarSesion(sesion.id, { salaCodigo: a.salaCodigo })
   else if (a?.kind === 'profesor') await asignarSesion(sesion.id, { profesorId: a.profesorId })
}

// Soltar una sala o un profesor sobre la ficha de un paralelo (en el panel lateral) asigna
// esa sala/profesor a TODAS las sesiones ya agendadas de ese paralelo, no solo a una celda.
function onDragOverParalelo(e: DragEvent) {
   if (permiteDropSesion.value) e.preventDefault()
}

async function onDropParalelo(e: DragEvent, paraleloId: number) {
   if (!permiteDropSesion.value) return
   e.preventDefault()
   e.stopPropagation()
   const a = arrastre.value
   arrastre.value = null
   if (a?.kind === 'sala') await asignarSesionesDeParalelo(paraleloId, { salaCodigo: a.salaCodigo })
   else if (a?.kind === 'profesor') await asignarSesionesDeParalelo(paraleloId, { profesorId: a.profesorId })
}

/* ── Acciones ────────────────────────────────────────────── */
// Va en el cliente (no se calcula en el servidor) para que "hoy" sea el día del usuario, igual
// que /api/dashboard: mover, asignar o borrar una sesión solo debe tocar las reservas de sala
// desde este día en adelante — las que ya ocurrieron quedan como registro histórico.
function hoyISO() {
   const d = new Date()
   const mes = String(d.getMonth() + 1).padStart(2, '0')
   const dia = String(d.getDate()).padStart(2, '0')
   return `${d.getFullYear()}-${mes}-${dia}`
}

async function crearSesion(paraleloId: number, diaSemana: number, bloqueId: number, tipo: TipoSesion) {
   try {
      await $fetch('/api/sesiones', {
         method: 'POST',
         body: { paraleloId, diaSemana, bloqueId, tipo },
      })
      await refrescarTodo()
   } catch (err: unknown) {
      const mensaje = (err as { data?: { message?: string } }).data?.message ?? 'No se pudo agregar la sesión'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   }
}

async function moverSesion(id: number, diaSemana: number, bloqueId: number) {
   try {
      await $fetch(`/api/sesiones/${id}/mover`, {
         method: 'PATCH',
         query: { hoy: hoyISO() },
         body: { diaSemana, bloqueId },
      })
      await refrescarTodo()
   } catch (err: unknown) {
      const mensaje = (err as { data?: { message?: string } }).data?.message ?? 'No se pudo mover la sesión'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   }
}

// `null` desasigna (el endpoint distingue null de campo ausente).
async function asignarSesion(id: number, body: { salaCodigo?: string | null; profesorId?: number | null }) {
   try {
      await $fetch(`/api/sesiones/${id}`, { method: 'PATCH', query: { hoy: hoyISO() }, body })
      await refrescarTodo()
   } catch (err: unknown) {
      const mensaje = (err as { data?: { message?: string } }).data?.message ?? 'No se pudo asignar'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   }
}

// Arrastrar otra sala encima solo la reemplaza; esta es la única forma de dejar la sesión sin
// sala. Al quedarse sin sala, la sesión también pierde su reserva (ver reservasSesion.ts).
async function quitarSala(sesion: SesionParalelo) {
   if (!puedeEditarHorario.value) return
   await asignarSesion(sesion.id, { salaCodigo: null })
   toast.add({ title: 'Sesión sin sala', color: 'success', icon: 'i-lucide-door-open' })
}

// Igual que con la sala: arrastrar otro profesor solo lo reemplaza. La sesión conserva su
// reserva, pero queda sin responsable (ver Reserva.personaId, nullable).
async function quitarProfesor(sesion: SesionParalelo) {
   if (!puedeEditarHorario.value) return
   await asignarSesion(sesion.id, { profesorId: null })
   toast.add({ title: 'Sesión sin profesor', color: 'success', icon: 'i-lucide-user' })
}

async function asignarSesionesDeParalelo(paraleloId: number, body: { salaCodigo?: string; profesorId?: number }) {
   const sesionesDelParalelo = sesionesDelCurso.value.filter((s) => s.paraleloId === paraleloId)
   if (!sesionesDelParalelo.length) return
   try {
      const query = { hoy: hoyISO() }
      await Promise.all(
         sesionesDelParalelo.map((s) => $fetch(`/api/sesiones/${s.id}`, { method: 'PATCH', query, body }))
      )
      await refrescarTodo()
   } catch (err: unknown) {
      const mensaje = (err as { data?: { message?: string } }).data?.message ?? 'No se pudo asignar'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   }
}

async function eliminarSesion(id: number) {
   if (!puedeBorrarHorario.value) return
   try {
      await $fetch(`/api/sesiones/${id}`, { method: 'DELETE', query: { hoy: hoyISO() } })
      await refrescarTodo()
   } catch (err: unknown) {
      const mensaje = (err as { data?: { message?: string } }).data?.message ?? 'No se pudo eliminar'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   }
}

/* ── Editar código de un paralelo desde el panel lateral ─────────────────── */
const modalCodigoMostrar = ref(false)
const paraleloEditandoCodigo = ref<Paralelo | null>(null)
const nuevoCodigo = ref('')
const guardandoCodigo = ref(false)
const errorCodigo = ref<string | null>(null)

function abrirEditarCodigo(paralelo: Paralelo) {
   if (!puedeEditarHorario.value) return
   paraleloEditandoCodigo.value = paralelo
   nuevoCodigo.value = paralelo.codigo
   errorCodigo.value = null
   modalCodigoMostrar.value = true
}

async function guardarCodigo() {
   if (!paraleloEditandoCodigo.value) return
   guardandoCodigo.value = true
   errorCodigo.value = null
   try {
      await $fetch(`/api/paralelos/${paraleloEditandoCodigo.value.id}`, {
         method: 'PATCH',
         body: {
            codigo: nuevoCodigo.value,
            cupo: paraleloEditandoCodigo.value.cupo,
            asignaturaPlanId: paraleloEditandoCodigo.value.asignaturaPlanId,
            cursoId: paraleloEditandoCodigo.value.cursoId,
            color: paraleloEditandoCodigo.value.color,
         },
      })
      modalCodigoMostrar.value = false
      await Promise.all([refrescarParalelosLista(), refrescarTodo()])
   } catch (err: unknown) {
      errorCodigo.value = (err as { data?: { message?: string } }).data?.message ?? 'No se pudo actualizar el código'
   } finally {
      guardandoCodigo.value = false
   }
}

async function actualizarColorParalelo(paralelo: Paralelo, color: string | null) {
   if (!puedeEditarHorario.value) return
   try {
      await $fetch(`/api/paralelos/${paralelo.id}`, {
         method: 'PATCH',
         body: {
            codigo: paralelo.codigo,
            cupo: paralelo.cupo,
            asignaturaPlanId: paralelo.asignaturaPlanId,
            cursoId: paralelo.cursoId,
            color,
         },
      })
      // El color viaja embebido en el paralelo de cada sesión: hay que refrescar ambos
      // fetches para que la matriz y el panel lateral queden consistentes.
      await Promise.all([refrescarParalelosLista(), refrescarTodo()])
   } catch (err: unknown) {
      const mensaje = (err as { data?: { message?: string } }).data?.message ?? 'No se pudo actualizar el color'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   }
}

// La paleta se abre en un popover por paralelo: se guarda cuál está abierto (no un booleano
// por fila) para que abrir uno cierre el anterior.
const paletaAbiertaId = ref<number | null>(null)

function alternarPaleta(paraleloId: number, abierta: boolean) {
   paletaAbiertaId.value = abierta ? paraleloId : null
}

async function elegirColorParalelo(paralelo: Paralelo, color: string | null) {
   paletaAbiertaId.value = null
   await actualizarColorParalelo(paralelo, color)
}
</script>

<template>
   <div class="space-y-6 print:hidden">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
         <div>
            <p class="text-sm text-usm-text-muted dark:text-slate-400">
               Arrastra un paralelo (teoría o práctica) a una celda para agendar. Arrastra una sesión ya ubicada a otra
               celda para moverla, o una sala o profesor sobre ella para asignarlos.
            </p>
         </div>
         <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:shrink-0">
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
            <USelect
               v-model="semestreSeleccionadoId"
               :items="opcionesSemestre"
               value-key="value"
               placeholder="Selecciona un semestre…"
               class="w-full sm:w-56"
            />
            <USwitch
               v-if="semestreSeleccionado && bloques.length"
               v-model="mostrarFinSemana"
               label="Mostrar fin de semana"
            />
            <UButton
               icon="i-lucide-printer"
               color="neutral"
               variant="outline"
               aria-label="Imprimir horario del curso"
               :disabled="!cursoActual || !bloques.length"
               @click="imprimirHorario"
            >
               Imprimir
            </UButton>
         </div>
      </div>

      <EmptyState v-if="!carreras?.length" icon="i-lucide-graduation-cap" message="No hay carreras registradas." />

      <template v-else>
         <div v-if="opcionesCarrera.length" class="flex flex-col gap-3">
            <!-- Ancho pensado para el nombre de carrera más largo + "(Plan: N)" sin truncar. -->
            <USelect
               v-model="carreraSeleccionada"
               :items="opcionesCarrera"
               value-key="value"
               class="max-w-full sm:w-120 sm:shrink-0"
            />
            <div v-if="cursosDeCarrera.length" class="min-w-0 overflow-x-auto">
               <UTabs
                  v-model="cursoSeleccionado"
                  :items="opcionesCursoTabs"
                  :content="false"
                  size="sm"
                  :ui="{ root: 'items-start', list: 'w-max' }"
               />
            </div>
         </div>

         <EmptyState
            v-if="!semestreSeleccionado"
            icon="i-lucide-calendar-x"
            message="No hay semestres registrados. Crea uno en la sección Semestres para armar el horario."
         />

         <EmptyState
            v-else-if="!bloques.length"
            icon="i-lucide-clock"
            message="Este semestre no tiene bloques horarios. Crea bloques para armar el horario."
         />

         <EmptyState
            v-else-if="!opcionesCarrera.length"
            icon="i-lucide-graduation-cap"
            message="Ninguna carrera tiene cursos de su plan vigente en este semestre. Crea uno en la sección Cursos para poder agendar."
         />

         <EmptyState
            v-else-if="!cursosDeCarrera.length"
            icon="i-lucide-users-round"
            message="El plan vigente de esta carrera no tiene cursos en este semestre. Crea uno en la sección Cursos para poder agendar."
         />

         <div v-else class="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            <!-- Matriz: en escritorio estira a la misma altura que el panel lateral (columna
                 más alta de la fila de grilla — `align-items: stretch`, el valor por defecto,
                 ya no se lo pisa con `items-start`) y scrollea internamente si su contenido no
                 alcanza. `lg:min-h-0` es necesario porque, si no, el `min-height: auto` implícito
                 de todo ítem de grilla lo obliga a crecer con su contenido en vez de acotarse. -->
            <div
               class="max-h-[70vh] overflow-auto rounded-2xl border border-default bg-default lg:h-full lg:max-h-none lg:min-h-0"
            >
               <table class="w-full border-collapse text-sm">
                  <thead>
                     <tr>
                        <th
                           class="sticky top-0 left-0 z-30 w-32 border-b border-e border-default bg-muted p-2 text-left text-xs font-semibold text-usm-text-muted dark:text-slate-400"
                        >
                           Bloque
                        </th>
                        <th
                           v-for="dia in diasVisibles"
                           :key="dia.valor"
                           class="sticky top-0 z-20 border-b border-e border-default p-2 text-center text-xs font-semibold last:border-e-0"
                           :class="
                              DIAS_FIN_SEMANA.includes(dia.valor)
                                 ? 'bg-gray-100 text-usm-text-muted dark:bg-slate-800 dark:text-slate-400'
                                 : 'bg-muted text-usm-text dark:text-white'
                           "
                        >
                           {{ dia.nombre }}
                        </th>
                     </tr>
                  </thead>
                  <tbody>
                     <template v-for="(bloque, index) in bloques" :key="bloque.id">
                        <!-- Espacio entre bloques de la mañana y de la tarde -->
                        <tr v-if="index > 0 && bloques[index - 1]?.esUltimoManana">
                           <td
                              :colspan="diasVisibles.length + 1"
                              class="h-3 border-0 bg-usm-light p-0 dark:bg-slate-950"
                           ></td>
                        </tr>
                        <!-- Espacio entre bloques diurnos y vespertinos -->
                        <tr
                           v-if="
                              index > 0 && bloque.jornada === 'VESPERTINA' && bloques[index - 1]?.jornada === 'DIURNA'
                           "
                        >
                           <td
                              :colspan="diasVisibles.length + 1"
                              class="h-3 border-0 bg-usm-light p-0 dark:bg-slate-950"
                           ></td>
                        </tr>
                        <tr>
                           <!-- Etiqueta del bloque -->
                           <th
                              class="sticky left-0 z-10 border-b border-e border-default bg-muted p-2 text-left align-top"
                           >
                              <div class="font-semibold text-usm-text dark:text-white">N° {{ bloque.numero }}</div>
                              <div class="text-xs text-usm-text-muted dark:text-slate-400">
                                 {{ formatHora(bloque.inicio) }}–{{ formatHora(bloque.fin) }}
                              </div>
                              <UBadge
                                 v-if="bloque.jornada === 'VESPERTINA'"
                                 color="secondary"
                                 variant="subtle"
                                 size="xs"
                                 class="mt-1"
                              >
                                 Vespertino
                              </UBadge>
                           </th>

                           <!-- Celdas por día -->
                           <td
                              v-for="dia in diasVisibles"
                              :key="dia.valor"
                              class="border-b border-e border-default p-1 align-top transition-colors last:border-e-0"
                              :class="[
                                 claseCelda(dia.valor, bloque),
                                 celdaSobre?.diaSemana === dia.valor && celdaSobre?.bloqueId === bloque.id
                                    ? 'outline-2 -outline-offset-2 outline-usm-blue/40'
                                    : '',
                              ]"
                              @dragover="onDragOverCelda($event, dia.valor, bloque)"
                              @drop="onDropCelda($event, dia.valor, bloque)"
                           >
                              <div class="min-h-12 space-y-1">
                                 <div
                                    v-if="estaProtegido(dia.valor, bloque)"
                                    class="flex h-12 items-center justify-center text-usm-text-muted dark:text-slate-500"
                                 >
                                    <UIcon name="i-lucide-lock" class="size-4" />
                                 </div>

                                 <!-- Dos paralelos que coinciden en el mismo día y bloque se muestran uno al
                                    lado del otro (columnas de igual ancho), no uno arriba del otro. -->
                                 <div class="flex items-start gap-1">
                                    <div
                                       v-for="sesion in sesionesEnCelda(dia.valor, bloque.id!)"
                                       :key="sesion.id"
                                       :draggable="puedeEditarHorario"
                                       class="group relative min-w-0 flex-1 cursor-pointer rounded-lg border p-1.5 text-xs transition-colors"
                                       :class="[
                                          puedeEditarHorario ? 'active:cursor-grabbing' : '',
                                          sesionSeleccionadaId === sesion.id
                                             ? 'ring-2 ring-usm-blue dark:ring-usm-cyan'
                                             : '',
                                          topeEsEspejo(sesion)
                                             ? ''
                                             : tieneTope(sesion)
                                               ? 'border-usm-yellow-300 bg-usm-yellow-50 dark:border-usm-yellow-800 dark:bg-usm-yellow-950'
                                               : sesion.tipo === 'TEORIA'
                                                 ? 'border-usm-blue/30 bg-usm-blue/10'
                                                 : 'border-usm-green/30 bg-usm-green/10',
                                          permiteDropSesion ? 'ring-1 ring-usm-blue/40' : '',
                                       ]"
                                       :style="estiloSesion(sesion)"
                                       @click="seleccionarSesion(sesion)"
                                       @dragstart="iniciarArrastre($event, { kind: 'sesion', sesionId: sesion.id })"
                                       @dragend="terminarArrastre"
                                       @dragover="onDragOverSesion"
                                       @drop="onDropSesion($event, sesion)"
                                    >
                                       <div class="flex items-center justify-between gap-1">
                                          <span class="font-semibold text-usm-text dark:text-white">
                                             {{ sesion.paralelo.asignaturaPlan.asignatura.codigo }} ·
                                             {{ sesion.paralelo.codigo }}
                                          </span>
                                          <div class="flex items-center gap-1">
                                             <UBadge
                                                :color="sesion.tipo === 'TEORIA' ? 'primary' : 'success'"
                                                variant="subtle"
                                                size="xs"
                                             >
                                                {{ sesion.tipo === 'TEORIA' ? 'T' : 'P' }}
                                             </UBadge>
                                             <button
                                                v-if="puedeBorrarHorario"
                                                class="opacity-0 transition-opacity group-hover:opacity-100 text-usm-red hover:text-usm-red-700"
                                                aria-label="Quitar sesión"
                                                @click.stop="eliminarSesion(sesion.id)"
                                             >
                                                <UIcon name="i-lucide-x" class="size-3.5" />
                                             </button>
                                          </div>
                                       </div>
                                       <div>{{ sesion.paralelo.asignaturaPlan.asignatura.nombre }}</div>
                                       <div class="mt-1 flex items-center gap-1">
                                          <UPopover v-if="conflictosSala(sesion).length" class="min-w-0 flex-1">
                                             <div
                                                class="flex cursor-pointer items-center gap-1 truncate"
                                                :class="claseTope(sesion, conflictosSala(sesion))"
                                                :style="estiloTextoTope(sesion, conflictosSala(sesion))"
                                                @click.stop
                                             >
                                                <UIcon
                                                   :name="iconoTope(sesion, conflictosSala(sesion))"
                                                   class="size-3 shrink-0"
                                                />
                                                <span class="truncate">{{ sesion.sala?.codigo }}</span>
                                             </div>
                                             <template #content>
                                                <div class="max-w-64 space-y-2 p-3">
                                                   <p class="text-xs font-semibold text-usm-text dark:text-white">
                                                      {{
                                                         soloMismoParalelo(sesion, conflictosSala(sesion))
                                                            ? `Sala ${sesion.sala?.codigo}: mismo paralelo dictado también en`
                                                            : `Sala ${sesion.sala?.codigo} también ocupada por:`
                                                      }}
                                                   </p>
                                                   <div
                                                      v-for="conflicto in conflictosSala(sesion)"
                                                      :key="conflicto.id"
                                                      class="text-xs"
                                                   >
                                                      <p class="font-medium text-usm-text dark:text-white">
                                                         {{ conflicto.paralelo.asignaturaPlan.plan.carrera.nombre }}
                                                      </p>
                                                      <p class="text-usm-text-muted dark:text-slate-400">
                                                         {{ conflicto.paralelo.asignaturaPlan.asignatura.nombre }} ·
                                                         {{ conflicto.paralelo.curso.nombre }} · Paralelo
                                                         {{ conflicto.paralelo.codigo }}
                                                      </p>
                                                   </div>
                                                </div>
                                             </template>
                                          </UPopover>
                                          <div
                                             v-else
                                             class="flex min-w-0 flex-1 items-center gap-1 truncate"
                                             :class="
                                                sesion.sala
                                                   ? 'text-usm-text-muted dark:text-slate-300'
                                                   : 'text-usm-text-muted/60 dark:text-slate-500'
                                             "
                                          >
                                             <UIcon name="i-lucide-door-open" class="size-3 shrink-0" />
                                             <span class="truncate">{{ sesion.sala?.codigo ?? 'Sin sala' }}</span>
                                          </div>

                                          <UTooltip
                                             v-if="sesion.sala"
                                             text="El cupo del paralelo excede la capacidad de la sala"
                                             :disabled="!excedeCapacidad(sesion)"
                                          >
                                             <span
                                                class="shrink-0 text-[11px]"
                                                :class="
                                                   excedeCapacidad(sesion)
                                                      ? 'font-semibold text-usm-yellow-700 dark:text-usm-yellow-400'
                                                      : 'text-usm-text-muted dark:text-slate-400'
                                                "
                                             >
                                                {{ sesion.paralelo.cupo }}/{{ sesion.sala.capacidad }}
                                             </span>
                                          </UTooltip>

                                          <UTooltip v-if="sesion.sala && puedeEditarHorario" text="Dejar sin sala">
                                             <button
                                                class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-usm-red hover:text-usm-red-700"
                                                aria-label="Dejar sin sala"
                                                @click.stop="quitarSala(sesion)"
                                             >
                                                <UIcon name="i-lucide-door-closed" class="size-3.5" />
                                             </button>
                                          </UTooltip>
                                       </div>
                                       <div class="flex items-center gap-1">
                                          <UPopover v-if="conflictosProfesor(sesion).length" class="min-w-0 flex-1">
                                             <div
                                                class="flex cursor-pointer items-center gap-1 truncate"
                                                :class="claseTope(sesion, conflictosProfesor(sesion))"
                                                :style="estiloTextoTope(sesion, conflictosProfesor(sesion))"
                                                @click.stop
                                             >
                                                <UIcon
                                                   :name="iconoTope(sesion, conflictosProfesor(sesion))"
                                                   class="size-3 shrink-0"
                                                />
                                                <span class="truncate">
                                                   {{ sesion.profesor?.nombre }} {{ sesion.profesor?.apellido }}
                                                </span>
                                             </div>
                                             <template #content>
                                                <div class="max-w-64 space-y-2 p-3">
                                                   <p class="text-xs font-semibold text-usm-text dark:text-white">
                                                      {{
                                                         soloMismoParalelo(sesion, conflictosProfesor(sesion))
                                                            ? `${sesion.profesor?.nombre} ${sesion.profesor?.apellido} dicta el mismo paralelo en`
                                                            : `${sesion.profesor?.nombre} ${sesion.profesor?.apellido} también hace clases en:`
                                                      }}
                                                   </p>
                                                   <div
                                                      v-for="conflicto in conflictosProfesor(sesion)"
                                                      :key="conflicto.id"
                                                      class="text-xs"
                                                   >
                                                      <p class="font-medium text-usm-text dark:text-white">
                                                         {{ conflicto.paralelo.asignaturaPlan.plan.carrera.nombre }}
                                                      </p>
                                                      <p class="text-usm-text-muted dark:text-slate-400">
                                                         {{ conflicto.paralelo.asignaturaPlan.asignatura.nombre }} ·
                                                         {{ conflicto.paralelo.curso.nombre }} · Paralelo
                                                         {{ conflicto.paralelo.codigo }}
                                                      </p>
                                                   </div>
                                                </div>
                                             </template>
                                          </UPopover>
                                          <div
                                             v-else
                                             class="flex min-w-0 flex-1 items-center gap-1 truncate"
                                             :class="
                                                sesion.profesor
                                                   ? 'text-usm-text-muted dark:text-slate-300'
                                                   : 'text-usm-text-muted/60 dark:text-slate-500'
                                             "
                                          >
                                             <UIcon name="i-lucide-user" class="size-3 shrink-0" />
                                             <span class="truncate">
                                                {{
                                                   sesion.profesor
                                                      ? `${sesion.profesor.nombre} ${sesion.profesor.apellido}`
                                                      : 'Sin profesor'
                                                }}
                                             </span>
                                          </div>

                                          <UTooltip
                                             v-if="sesion.profesor && puedeEditarHorario"
                                             text="Dejar sin profesor"
                                          >
                                             <button
                                                class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-usm-red hover:text-usm-red-700"
                                                aria-label="Dejar sin profesor"
                                                @click.stop="quitarProfesor(sesion)"
                                             >
                                                <UIcon name="i-lucide-user-x" class="size-3.5" />
                                             </button>
                                          </UTooltip>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           </td>
                        </tr>
                     </template>
                  </tbody>
               </table>
            </div>

            <!-- Paneles laterales -->
            <div class="mt-6 lg:mt-0">
               <UAccordion
                  :items="panelesLaterales"
                  type="multiple"
                  :default-value="['0', '1', '2', '3']"
                  :ui="{
                     root: 'rounded-2xl border border-default bg-default divide-y divide-default',
                     trigger: 'px-4',
                  }"
               >
                  <!-- Paralelos -->
                  <template #paralelos>
                     <div class="px-4 pb-4">
                        <div v-if="!paralelos.length" class="text-sm text-usm-text-muted dark:text-slate-400">
                           No hay paralelos para este curso en este semestre.
                        </div>
                        <div v-else class="max-h-96 space-y-3 overflow-y-auto pe-1">
                           <div
                              v-for="paralelo in paralelos"
                              :key="paralelo.id"
                              class="rounded-xl border border-default p-2.5 transition-colors"
                              :class="permiteDropSesion ? 'ring-1 ring-usm-blue/40' : ''"
                              @dragover="onDragOverParalelo"
                              @drop="onDropParalelo($event, paralelo.id)"
                           >
                              <div class="mb-2 flex items-start justify-between gap-2">
                                 <div class="min-w-0">
                                    <p class="text-sm font-medium text-usm-text dark:text-white">
                                       {{ paralelo.asignaturaPlan.asignatura.nombre }}
                                    </p>
                                    <p class="text-xs text-usm-text-muted dark:text-slate-400">
                                       {{ paralelo.asignaturaPlan.asignatura.codigo }} · Paralelo
                                       <UTooltip :text="puedeEditarHorario ? 'Editar código' : paralelo.codigo">
                                          <button
                                             type="button"
                                             class="underline decoration-dotted underline-offset-2"
                                             :class="
                                                puedeEditarHorario
                                                   ? 'cursor-pointer hover:text-usm-blue dark:hover:text-usm-cyan'
                                                   : ''
                                             "
                                             @click="abrirEditarCodigo(paralelo)"
                                          >
                                             {{ paralelo.codigo }}
                                          </button>
                                       </UTooltip>
                                    </p>
                                 </div>
                                 <div class="flex shrink-0 items-center gap-1">
                                    <UPopover
                                       v-if="puedeEditarHorario"
                                       :open="paletaAbiertaId === paralelo.id"
                                       @update:open="alternarPaleta(paralelo.id, $event)"
                                    >
                                       <button
                                          type="button"
                                          class="size-6 cursor-pointer rounded-full border border-default"
                                          :style="{ backgroundColor: paralelo.color ?? '#94a3b8' }"
                                          title="Color de los bloques de este paralelo"
                                          aria-label="Color de los bloques de este paralelo"
                                       />
                                       <template #content>
                                          <div class="grid max-w-56 grid-cols-6 gap-2 p-3">
                                             <button
                                                v-for="c in COLORES_RESERVA"
                                                :key="c.hex"
                                                type="button"
                                                class="size-6 rounded-full border-2 transition-transform"
                                                :class="
                                                   paralelo.color === c.hex
                                                      ? 'scale-110 border-usm-text dark:border-white'
                                                      : 'border-transparent hover:scale-110'
                                                "
                                                :style="{ backgroundColor: c.hex }"
                                                :aria-label="c.nombre"
                                                :title="c.nombre"
                                                @click="elegirColorParalelo(paralelo, c.hex)"
                                             />
                                          </div>
                                       </template>
                                    </UPopover>
                                    <span
                                       v-else
                                       class="size-6 rounded-full border border-default"
                                       :style="{ backgroundColor: paralelo.color ?? '#94a3b8' }"
                                       title="Color de los bloques de este paralelo"
                                    />
                                    <UTooltip v-if="paralelo.color && puedeEditarHorario" text="Quitar color">
                                       <UButton
                                          icon="i-lucide-x"
                                          size="xs"
                                          variant="ghost"
                                          color="neutral"
                                          aria-label="Quitar color"
                                          @click="elegirColorParalelo(paralelo, null)"
                                       />
                                    </UTooltip>
                                 </div>
                              </div>
                              <div class="flex flex-wrap gap-2">
                                 <div
                                    v-if="paralelo.asignaturaPlan.asignatura.bloquesTeoria > 0"
                                    :draggable="
                                       puedeCrearHorario &&
                                       usados(paralelo.id, 'TEORIA') < paralelo.asignaturaPlan.asignatura.bloquesTeoria
                                    "
                                    class="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors"
                                    :class="
                                       puedeCrearHorario &&
                                       usados(paralelo.id, 'TEORIA') < paralelo.asignaturaPlan.asignatura.bloquesTeoria
                                          ? 'cursor-grab active:cursor-grabbing border-usm-blue/40 bg-usm-blue/10 text-usm-blue dark:text-usm-cyan'
                                          : 'cursor-not-allowed border-default bg-muted text-usm-text-muted/60 dark:text-slate-600'
                                    "
                                    @dragstart="
                                       iniciarArrastre($event, {
                                          kind: 'paralelo',
                                          paraleloId: paralelo.id,
                                          tipo: 'TEORIA',
                                       })
                                    "
                                    @dragend="terminarArrastre"
                                 >
                                    <UIcon name="i-lucide-grip-vertical" class="size-3" />
                                    Teoría {{ usados(paralelo.id, 'TEORIA') }}/{{
                                       paralelo.asignaturaPlan.asignatura.bloquesTeoria
                                    }}
                                 </div>
                                 <div
                                    v-if="paralelo.asignaturaPlan.asignatura.bloquesPractica > 0"
                                    :draggable="
                                       puedeCrearHorario &&
                                       usados(paralelo.id, 'PRACTICA') <
                                          paralelo.asignaturaPlan.asignatura.bloquesPractica
                                    "
                                    class="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors"
                                    :class="
                                       puedeCrearHorario &&
                                       usados(paralelo.id, 'PRACTICA') <
                                          paralelo.asignaturaPlan.asignatura.bloquesPractica
                                          ? 'cursor-grab active:cursor-grabbing border-usm-green/40 bg-usm-green/10 text-usm-green'
                                          : 'cursor-not-allowed border-default bg-muted text-usm-text-muted/60 dark:text-slate-600'
                                    "
                                    @dragstart="
                                       iniciarArrastre($event, {
                                          kind: 'paralelo',
                                          paraleloId: paralelo.id,
                                          tipo: 'PRACTICA',
                                       })
                                    "
                                    @dragend="terminarArrastre"
                                 >
                                    <UIcon name="i-lucide-grip-vertical" class="size-3" />
                                    Práctica {{ usados(paralelo.id, 'PRACTICA') }}/{{
                                       paralelo.asignaturaPlan.asignatura.bloquesPractica
                                    }}
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </template>

                  <!-- Salas -->
                  <template #salas>
                     <div class="px-4 pb-4">
                        <div v-if="!salas?.length" class="text-sm text-usm-text-muted dark:text-slate-400">
                           No tienes salas asignadas. Pídele a un Administrador que te agregue como encargado en Salas →
                           Asignación.
                        </div>
                        <template v-else>
                           <UInput
                              v-model="busquedaSala"
                              icon="i-lucide-search"
                              placeholder="Buscar sala…"
                              size="sm"
                              class="mb-2 w-full"
                           />
                           <p v-if="!salasFiltradas.length" class="text-sm text-usm-text-muted dark:text-slate-400">
                              No se encontraron salas.
                           </p>
                           <div v-else class="max-h-64 overflow-y-auto pe-1">
                              <div class="flex flex-wrap gap-2">
                                 <div
                                    v-for="sala in salasFiltradas"
                                    :key="sala.codigo"
                                    :draggable="puedeEditarHorario"
                                    class="flex items-center gap-1 rounded-lg border border-default bg-muted px-2 py-1 text-xs text-usm-text transition-colors dark:text-slate-200"
                                    :class="puedeEditarHorario ? 'cursor-grab active:cursor-grabbing' : ''"
                                    @dragstart="iniciarArrastre($event, { kind: 'sala', salaCodigo: sala.codigo })"
                                    @dragend="terminarArrastre"
                                 >
                                    <UIcon name="i-lucide-door-open" class="size-3" />
                                    {{ sala.codigo }}
                                    <span class="text-usm-text-muted dark:text-slate-400">({{ sala.capacidad }})</span>
                                 </div>
                              </div>
                           </div>
                        </template>
                     </div>
                  </template>

                  <!-- Profesores anteriores: se llena al hacer click en una sesión de clases. -->
                  <template #profesoresAnteriores>
                     <div class="px-4 pb-4">
                        <div v-if="!sesionSeleccionada" class="text-sm text-usm-text-muted dark:text-slate-400">
                           Haz click en una sesión de clases de la matriz para ver quién más ha dictado esa asignatura.
                        </div>
                        <template v-else>
                           <p class="mb-2 truncate text-xs font-medium text-usm-text dark:text-white">
                              {{ sesionSeleccionada.paralelo.asignaturaPlan.asignatura.codigo }} ·
                              {{ sesionSeleccionada.paralelo.asignaturaPlan.asignatura.nombre }}
                           </p>
                           <div v-if="cargandoHistorial" class="text-sm text-usm-text-muted dark:text-slate-400">
                              Cargando…
                           </div>
                           <p
                              v-else-if="!historialProfesores.length"
                              class="text-sm text-usm-text-muted dark:text-slate-400"
                           >
                              Nadie más ha dictado esta asignatura en otros semestres.
                           </p>
                           <div v-else class="max-h-64 space-y-2 overflow-y-auto pe-1">
                              <div
                                 v-for="profesor in historialProfesores"
                                 :key="profesor.id"
                                 class="flex items-center justify-between gap-2 rounded-lg border border-default bg-muted px-2.5 py-1.5 text-xs text-usm-text dark:text-slate-200"
                              >
                                 <p class="font-medium">{{ profesor.nombre }} {{ profesor.apellido }}</p>
                                 <UBadge variant="subtle" color="neutral" class="shrink-0">
                                    {{ profesor.vecesDictada }} {{ profesor.vecesDictada === 1 ? 'vez' : 'veces' }}
                                 </UBadge>
                              </div>
                           </div>
                        </template>
                     </div>
                  </template>

                  <!-- Profesores -->
                  <template #profesores>
                     <div class="px-4 pb-4">
                        <div v-if="!profesores.length" class="text-sm text-usm-text-muted dark:text-slate-400">
                           No hay profesores.
                        </div>
                        <template v-else>
                           <UInput
                              v-model="busquedaProfesor"
                              icon="i-lucide-search"
                              placeholder="Buscar profesor…"
                              size="sm"
                              class="mb-2 w-full"
                           />
                           <p
                              v-if="!profesoresFiltrados.length"
                              class="text-sm text-usm-text-muted dark:text-slate-400"
                           >
                              No se encontraron profesores.
                           </p>
                           <div v-else class="max-h-64 overflow-y-auto pe-1">
                              <div class="flex flex-wrap gap-2">
                                 <div
                                    v-for="profesor in profesoresFiltrados"
                                    :key="profesor.id"
                                    :draggable="puedeEditarHorario"
                                    class="flex items-center gap-1 rounded-lg border border-default bg-muted px-2 py-1 text-xs text-usm-text transition-colors dark:text-slate-200"
                                    :class="puedeEditarHorario ? 'cursor-grab active:cursor-grabbing' : ''"
                                    @dragstart="iniciarArrastre($event, { kind: 'profesor', profesorId: profesor.id })"
                                    @dragend="terminarArrastre"
                                 >
                                    <UIcon name="i-lucide-user" class="size-3" />
                                    {{ profesor.nombre }} {{ profesor.apellido }}
                                    <span :class="claseBloquesProfesor(profesor)">
                                       ({{ bloquesDeProfesor(profesor.id) }})
                                    </span>
                                 </div>
                              </div>
                           </div>
                        </template>
                     </div>
                  </template>
               </UAccordion>
            </div>
         </div>
      </template>

      <UModal
         v-model:open="modalCodigoMostrar"
         :title="`Editar código del paralelo ${paraleloEditandoCodigo?.codigo}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm id="form-paralelo-codigo" :state="{ codigo: nuevoCodigo }" class="space-y-4" @submit="guardarCodigo">
               <UFormField label="Código" name="codigo" :error="errorCodigo ?? undefined">
                  <UInput v-model="nuevoCodigo" class="w-full" />
               </UFormField>
            </UForm>
         </template>
         <template #footer>
            <UButton
               variant="ghost"
               color="neutral"
               @click="
                  () => {
                     modalCodigoMostrar = false
                  }
               "
               >Cancelar</UButton
            >
            <UButton type="submit" form="form-paralelo-codigo" :loading="guardandoCodigo">Guardar cambios</UButton>
         </template>
      </UModal>
   </div>

   <!-- Versión imprimible: solo visible al imprimir (ver .print:hidden arriba). El horario de
        un curso es una plantilla semanal fija (sin fechas), así que a diferencia de
        /reservas/horario no hace falta agrupar por rowspan: una sesión ya vive en un solo
        (día, bloque) exacto, igual que en la matriz de pantalla. -->
   <div v-if="cursoActual" class="hidden print:block">
      <div class="mb-3">
         <h1 class="text-[10.5pt] font-bold text-gray-900">
            {{ cursoActual.plan.carrera.nombre }} — {{ cursoActual.nombre }}
         </h1>
         <p class="text-[7.5pt] text-gray-700">
            Plan N° {{ cursoActual.plan.numero }} · Semestre {{ cursoActual.semestre.nombre }}
         </p>
      </div>
      <!-- `overflow-hidden` recorta las esquinas de la tabla contra el radio del contenedor,
           que es quien dibuja el marco: por eso las celdas solo llevan sus bordes interiores
           (`border-b`/`border-e`). Se mantiene `border-separate` para que el recuadro de color
           de cada sesión conserve su borde completo — con `border-collapse` el borde de la
           celda de arriba/izquierda le ganaría y el recuadro saldría gris por dos de sus
           lados. Por eso las celdas con sesión llevan `border` (los cuatro lados) en vez de los
           bordes interiores de la grilla, y quedan fuera de la regla que recorta el último
           borde de cada fila/columna: si no, el recuadro perdía su lado derecho en la última
           columna —y el inferior en la última fila— y solo se veía el marco gris de la matriz. -->
      <div class="overflow-hidden rounded-2xl border border-[#d4d4d4]">
         <table class="w-full border-separate border-spacing-0 text-[6pt]">
            <thead>
               <tr>
                  <th class="border-b border-e border-[#d4d4d4] bg-sky-50 p-1 text-left font-semibold text-usm-blue">
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
            <!-- La última fila no lleva borde inferior: se solaparía con el del contenedor
                 justo en la curva de las esquinas. Se exceptúan las celdas con sesión
                 (`data-sesion`), que necesitan su recuadro de color cerrado por los 4 lados. -->
            <tbody class="[&>tr:last-child>td:not([data-sesion])]:border-b-0">
               <template v-for="(bloque, index) in bloques" :key="bloque.id">
                  <!-- Mismos espacios de jornada que en pantalla (mañana/tarde, diurna/vespertina). -->
                  <tr v-if="index > 0 && bloques[index - 1]?.esUltimoManana">
                     <td :colspan="diasVisibles.length + 1" class="h-2 border-0 bg-usm-light p-0"></td>
                  </tr>
                  <tr v-if="index > 0 && bloque.jornada === 'VESPERTINA' && bloques[index - 1]?.jornada === 'DIURNA'">
                     <td :colspan="diasVisibles.length + 1" class="h-2 border-0 bg-usm-light p-0"></td>
                  </tr>
                  <tr class="break-inside-avoid">
                     <td class="border-b border-e border-[#d4d4d4] bg-sky-50 p-1 align-top text-gray-700">
                        <p class="font-semibold text-black">Bloque {{ bloque.numero }}</p>
                        <p>{{ formatHora(bloque.inicio) }}–{{ formatHora(bloque.fin) }}</p>
                     </td>
                     <template v-for="dia in diasVisibles" :key="dia.valor">
                        <td
                           v-if="celdaImpresionDe(dia.valor, index).tipo !== 'oculta'"
                           :rowspan="rowspanImpresionDe(dia.valor, index)"
                           class="border-[#d4d4d4] p-1 align-top"
                           :class="
                              sesionesImpresionDe(dia.valor, index).length
                                 ? 'border'
                                 : 'border-b border-e last:border-e-0'
                           "
                           :data-sesion="sesionesImpresionDe(dia.valor, index).length ? '' : undefined"
                           :style="estiloCeldaImpresion(dia.valor, index)"
                        >
                           <div
                              v-for="sesion in sesionesImpresionDe(dia.valor, index)"
                              :key="sesion.id"
                              class="leading-tight not-last:mb-1 not-last:border-b not-last:border-dashed not-last:border-[#d4d4d4] not-last:pb-1"
                           >
                              <p class="truncate font-semibold text-black">
                                 {{ sesion.paralelo.asignaturaPlan.asignatura.codigo }} ·
                                 {{ sesion.paralelo.codigo }} ({{ sesion.tipo === 'TEORIA' ? 'T' : 'P' }})
                              </p>
                              <p class="truncate text-gray-700">
                                 {{ sesion.paralelo.asignaturaPlan.asignatura.nombre }}
                              </p>
                              <p class="truncate text-gray-700">{{ sesion.sala?.codigo ?? 'Sin sala' }}</p>
                              <p class="truncate text-gray-700">
                                 {{
                                    sesion.profesor
                                       ? `${sesion.profesor.nombre} ${sesion.profesor.apellido}`
                                       : 'Sin profesor'
                                 }}
                              </p>
                           </div>
                        </td>
                     </template>
                  </tr>
               </template>
            </tbody>
         </table>
      </div>
   </div>
</template>

<style>
/* Tailwind no tiene utilidad para @page — única forma de fijar tamaño/márgenes de la hoja.
   Mismos valores que el reporte impreso de /reservas/horario, para que los horarios de sala y
   de curso salgan con el mismo formato de papel. */
@page {
   size: letter portrait;
   margin: 0.635cm;
}

/* El resto de los ajustes de impresión (modo claro forzado y print-color-adjust) es global:
   está en app/assets/css/main.css. */
</style>
