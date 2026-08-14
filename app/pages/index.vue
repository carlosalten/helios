<script setup lang="ts">
import type { Dashboard, ModoDashboard } from '~/types/dashboard'
import { DIAS_SEMANA } from '~/types/dia'

const { user } = useUserSession()

// La fecha va calculada en el cliente (no en el servidor) para que "hoy" sea el día del
// usuario. Se fija una sola vez al montar: no tiene sentido que el dashboard cambie de día
// solo, y así el fetch no se repite.
function formatFechaISO(d: Date) {
   const anio = d.getFullYear()
   const mes = String(d.getMonth() + 1).padStart(2, '0')
   const dia = String(d.getDate()).padStart(2, '0')
   return `${anio}-${mes}-${dia}`
}
const hoyISO = formatFechaISO(new Date())

// La hora también sale del reloj del usuario, por lo mismo que la fecha: el servidor la usa
// para descartar las clases de hoy que ya terminaron.
function formatHora(d: Date) {
   return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const ahoraHHMM = formatHora(new Date())

// `null` deja que el servidor elija el modo según el rol (global para Administrador, personal
// para el resto). Solo el Administrador puede cambiarlo; el servidor ignora el parámetro de
// cualquier otro rol, así que esto es una comodidad de UI, no un control de acceso.
const modo = ref<ModoDashboard | null>(null)
const { data: resumen, status } = await useFetch<Dashboard>(
   () => `/api/dashboard?hoy=${hoyISO}&ahora=${ahoraHHMM}${modo.value ? `&modo=${modo.value}` : ''}`
)

const esPersonal = computed(() => resumen.value?.alcance.modo === 'personal')

// El cuadro de planificación (sala/profesor asignados, horas completas, topes) queda solo
// para los roles con responsabilidad sobre la malla de una carrera. El resto (Apoyo Docente,
// Profesor, Funcionario, Externo) no gestiona esos datos, así que no aporta mostrárselo.
const ROLES_PLANIFICACION = ['Administrador', 'Director Departamento', 'Jefe de Carrera']
const puedeVerPlanificacion = computed(() => !!user.value?.rol && ROLES_PLANIFICACION.includes(user.value.rol))

const opcionesModo = [
   { label: 'Todo el sistema', value: 'global' as const },
   { label: 'Mis carreras y salas', value: 'personal' as const },
]

const MESES = [
   'enero',
   'febrero',
   'marzo',
   'abril',
   'mayo',
   'junio',
   'julio',
   'agosto',
   'septiembre',
   'octubre',
   'noviembre',
   'diciembre',
]
// "Lunes 3 de agosto" a partir de un ISO, sin depender de toLocaleDateString (que cambia
// según la locale del navegador).
function formatFechaLarga(iso: string) {
   const [anio, mes, dia] = iso.split('-').map(Number)
   const fecha = new Date(Date.UTC(anio!, mes! - 1, dia!))
   const diaSemana = fecha.getUTCDay() === 0 ? 7 : fecha.getUTCDay()
   const nombreDia = DIAS_SEMANA.find((d) => d.valor === diaSemana)?.nombre ?? ''
   return `${nombreDia} ${dia} de ${MESES[mes! - 1]}`
}
function formatFechaCorta(iso: string) {
   const [, mes, dia] = iso.split('-').map(Number)
   return `${dia} de ${MESES[mes! - 1]}`
}

// Fecha compacta para la lista de próximas clases: "Hoy" / "Mañana" y, más allá, "lun 4 ago".
const DIAS_ABREVIADOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const UN_DIA_MS = 24 * 60 * 60 * 1000
function formatFechaRelativa(iso: string) {
   if (iso === hoyISO) return 'Hoy'
   const [anio, mes, dia] = iso.split('-').map(Number)
   const fecha = new Date(Date.UTC(anio!, mes! - 1, dia!))
   const diferenciaDias = Math.round((fecha.getTime() - new Date(`${hoyISO}T00:00:00.000Z`).getTime()) / UN_DIA_MS)
   if (diferenciaDias === 1) return 'Mañana'
   const diaSemana = fecha.getUTCDay() === 0 ? 7 : fecha.getUTCDay()
   return `${DIAS_ABREVIADOS[diaSemana - 1]} ${dia} ${MESES[mes! - 1]!.slice(0, 3)}`
}

const saludo = computed(() => {
   const hora = new Date().getHours()
   if (hora < 12) return 'Buenos días'
   if (hora < 20) return 'Buenas tardes'
   return 'Buenas noches'
})

/* ── Tarjetas de conteo ─────────────────────────────────────────────────
   En modo personal los números ya vienen acotados a las carreras y salas del usuario, así que
   las etiquetas lo dicen explícitamente para que no se lean como totales del departamento.
   El criterio exacto (por sala o por carrera) depende del rol — ver server/api/dashboard.get.ts
   — y se explica al pasar el mouse por cada tarjeta. */
const rolActual = computed(() => user.value?.rol ?? '')

const alcanceIndicadoresHoy = computed(() => {
   if (!esPersonal.value) return 'en todo el sistema'
   if (rolActual.value === 'Apoyo Docente') return 'en las salas que tienes a cargo'
   if (rolActual.value === 'Jefe de Carrera') return 'en las carreras que diriges'
   return 'en las carreras a las que estás asociado'
})

// Las reservas sin sesión de clases (ayudantías, reuniones…) no pertenecen a ninguna carrera,
// así que solo se cuentan cuando el alcance es por sala (Apoyo Docente) o no hay acotación
// (modo global). Para el resto de los roles el indicador queda igual a "Clases hoy".
const reservasIncluyeSueltas = computed(() => !esPersonal.value || rolActual.value === 'Apoyo Docente')

const tarjetas = computed(() => {
   const r = resumen.value
   if (!r) return []
   const alcance = alcanceIndicadoresHoy.value
   return [
      {
         label: r.hoy.clases === 1 ? 'Clase hoy' : 'Clases hoy',
         valor: r.hoy.clases,
         icon: 'i-lucide-graduation-cap',
         color: 'text-usm-blue',
         descripcion: `Clases que se dictan hoy ${alcance}. Varios bloques seguidos de un mismo paralelo cuentan como una sola clase.`,
      },
      {
         label: esPersonal.value
            ? r.hoy.reservas === 1
               ? 'Reserva en mis salas hoy'
               : 'Reservas en mis salas hoy'
            : r.hoy.reservas === 1
              ? 'Reserva de sala hoy'
              : 'Reservas de sala hoy',
         valor: r.hoy.reservas,
         icon: 'i-lucide-calendar-check',
         color: 'text-usm-green',
         descripcion: reservasIncluyeSueltas.value
            ? `Reservas de sala de hoy ${alcance}: incluye clases y otros usos, como ayudantías o reuniones.`
            : `Clases de hoy ${alcance}. No incluye reservas sin sesión de clases (ayudantías, reuniones…), que no pertenecen a ninguna carrera.`,
      },
      {
         label: r.hoy.cursosConClase === 1 ? 'Curso con clase hoy' : 'Cursos con clase hoy',
         valor: r.hoy.cursosConClase,
         icon: 'i-lucide-users-round',
         color: 'text-usm-purple',
         descripcion: `Cursos distintos con al menos una clase hoy ${alcance}.`,
      },
      {
         label: r.hoy.profesoresConClase === 1 ? 'Profesor con clase hoy' : 'Profesores con clase hoy',
         valor: r.hoy.profesoresConClase,
         icon: 'i-lucide-user',
         color: 'text-usm-cyan',
         descripcion: `Profesores distintos con clase hoy ${alcance}.`,
      },
   ]
})

/* ── Barras de estado de la planificación ───────────────────────────────
   Cada métrica se muestra como "cubierto / total". El color no es decorativo: verde cuando
   está completo, ámbar mientras falte algo — así se ve de un vistazo qué queda por hacer. */
const metricas = computed(() => {
   const r = resumen.value
   const p = r?.planificacion
   if (!r || !p) return []
   return [
      {
         label: 'Clases con sala asignada',
         hecho: p.clasesConSala,
         total: p.clasesTotales,
         icon: 'i-lucide-door-open',
         ruta: '/horario',
      },
      {
         label: 'Clases con profesor asignado',
         hecho: p.clasesConProfesor,
         total: p.clasesTotales,
         icon: 'i-lucide-user-check',
         ruta: '/horario',
      },
      {
         label: 'Paralelos con sus horas completas',
         hecho: p.paralelosCompletos,
         total: r.totales.paralelos,
         icon: 'i-lucide-list-checks',
         ruta: '/cursos',
      },
   ]
})

function porcentaje(hecho: number, total: number) {
   return total === 0 ? 100 : Math.round((hecho / total) * 100)
}
function claseBarra(hecho: number, total: number) {
   return hecho >= total ? 'bg-usm-green' : 'bg-usm-yellow-500'
}

const totalTopes = computed(() => {
   const p = resumen.value?.planificacion
   return p ? p.topesSala + p.topesProfesor : 0
})

// Los enlaces se ocultan si el rol no puede ver esa sección: el middleware la rebotaría a `/`.
const { puedeVer: puedeVerHorario } = usePermiso('/horario')
const { puedeVer: puedeVerCursos } = usePermiso('/cursos')
const { puedeVer: puedeVerReservas } = usePermiso('/reservas/horario')
const { puedeVer: puedeVerFeriados } = usePermiso('/feriados')
const { puedeVer: puedeVerTopesHorario } = usePermiso('/reportes/topes-horario')

function puedeVerRuta(ruta: string) {
   if (ruta === '/horario') return puedeVerHorario.value
   if (ruta === '/cursos') return puedeVerCursos.value
   return false
}

// Color del punto de cada evento de la agenda: el del paralelo o el del tipo de reserva.
function estiloPunto(color: string | null) {
   return { backgroundColor: color ?? '#94a3b8' }
}
</script>

<template>
   <div class="space-y-6">
      <TableSkeleton v-if="status === 'pending'" :rows="4" />

      <template v-else-if="resumen">
         <!-- Encabezado: saludo + semestre vigente con su progreso -->
         <div class="rounded-2xl border border-default bg-default p-5 sm:p-6">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
               <div class="min-w-0">
                  <h2 class="text-lg font-semibold text-usm-text dark:text-white">{{ saludo }}, {{ user?.nombre }}</h2>
                  <p class="mt-0.5 text-sm text-usm-text-muted dark:text-slate-400">
                     {{ formatFechaLarga(resumen.hoy.fecha) }}
                     <template v-if="resumen.semestre"> · Semestre {{ resumen.semestre.nombre }}</template>
                  </p>
               </div>
               <div class="flex flex-wrap items-center gap-3 sm:shrink-0">
                  <UBadge v-if="resumen.hoy.feriado" color="warning" variant="subtle" class="shrink-0">
                     <UIcon name="i-lucide-calendar-off" class="me-1.5 size-3.5" />
                     {{
                        resumen.hoy.feriado.horaInicio
                           ? `Feriado ${resumen.hoy.feriado.horaInicio}–${resumen.hoy.feriado.horaTermino}`
                           : 'Feriado'
                     }}
                     {{ resumen.hoy.feriado.alcance === 'SOLO_CLASES' ? '(solo clases)' : '' }}
                  </UBadge>
                  <!-- Solo el Administrador puede alternar entre la portada de todo el sistema y
                       la acotada a sus carreras y salas (la que ve un Director de Departamento). -->
                  <USelect
                     v-if="resumen.alcance.puedeCambiarModo"
                     :model-value="resumen.alcance.modo"
                     :items="opcionesModo"
                     value-key="value"
                     icon="i-lucide-eye"
                     class="w-56"
                     @update:model-value="modo = $event"
                  />
               </div>
            </div>

            <!-- Progreso del semestre. Fuera de su rango de fechas la barra no significa nada,
                 así que se muestra el estado en texto en vez de una barra engañosa. -->
            <div v-if="resumen.semestre" class="mt-5">
               <div class="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                  <span class="font-medium text-usm-text dark:text-slate-200">
                     <template v-if="resumen.semestre.enCurso">
                        Semana {{ resumen.semestre.semanaActual }} de {{ resumen.semestre.totalSemanas }}
                     </template>
                     <template v-else>El semestre vigente no está en curso en esta fecha</template>
                  </span>
                  <span class="text-usm-text-muted dark:text-slate-400">
                     {{ formatFechaCorta(resumen.semestre.fechaInicio) }} —
                     {{ formatFechaCorta(resumen.semestre.fechaFin) }}
                  </span>
               </div>
               <div v-if="resumen.semestre.enCurso" class="h-2 overflow-hidden rounded-full bg-elevated">
                  <div
                     class="h-full rounded-full bg-usm-blue transition-all"
                     :style="{
                        width: `${porcentaje(resumen.semestre.semanaActual, resumen.semestre.totalSemanas)}%`,
                     }"
                  />
               </div>
            </div>

            <!-- Contexto de fondo, sin competir con los datos del día. En modo personal son las
                 carreras y salas propias; en global, el tamaño del departamento. -->
            <div
               class="mt-5 flex flex-wrap gap-x-5 gap-y-1 border-t border-default pt-4 text-xs text-usm-text-muted dark:text-slate-400"
            >
               <template v-if="esPersonal">
                  <span
                     >{{ resumen.totales.carreras }} {{ resumen.totales.carreras === 1 ? 'carrera' : 'carreras' }}</span
                  >
                  <span>{{ resumen.totales.paralelos }} paralelos</span>
                  <span
                     >{{ resumen.totales.salas }} {{ resumen.totales.salas === 1 ? 'sala' : 'salas' }} a mi cargo</span
                  >
               </template>
               <template v-else>
                  <span>{{ resumen.totales.carreras }} carreras</span>
                  <span>{{ resumen.totales.paralelos }} paralelos</span>
                  <span>{{ resumen.totales.salas }} salas</span>
                  <span>{{ resumen.totales.personasActivas }} personas activas</span>
               </template>
            </div>
         </div>

         <EmptyState
            v-if="!resumen.semestre"
            icon="i-lucide-calendar-x"
            message="No hay un semestre marcado como vigente. Marca uno en la sección Semestres para ver el resumen del departamento."
         />

         <template v-else>
            <!-- Conteos del día -->
            <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
               <UTooltip
                  v-for="tarjeta in tarjetas"
                  :key="tarjeta.label"
                  :text="tarjeta.descripcion"
                  :ui="{ content: 'h-auto max-w-64 items-start py-1.5', text: 'whitespace-normal' }"
               >
                  <div class="flex items-center gap-4 rounded-2xl border border-default bg-default p-5">
                     <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-elevated">
                        <UIcon :name="tarjeta.icon" :class="['size-5', tarjeta.color]" />
                     </div>
                     <div class="min-w-0">
                        <p class="text-2xl font-bold text-usm-text dark:text-white">{{ tarjeta.valor }}</p>
                        <p class="text-xs leading-snug text-usm-text-muted dark:text-slate-400">{{ tarjeta.label }}</p>
                     </div>
                  </div>
               </UTooltip>
            </div>

            <div class="grid gap-6" :class="puedeVerPlanificacion ? 'lg:grid-cols-2' : ''">
               <!-- Mi día -->
               <div class="rounded-2xl border border-default bg-default p-5 sm:p-6">
                  <div class="mb-4 flex items-center justify-between gap-2">
                     <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-clock" class="size-4 text-usm-blue" />
                        <h2 class="text-sm font-semibold text-usm-text dark:text-white">Mi día</h2>
                     </div>
                     <UButton
                        v-if="puedeVerReservas"
                        to="/reservas/horario"
                        variant="link"
                        color="neutral"
                        size="xs"
                        trailing-icon="i-lucide-arrow-right"
                     >
                        Ver salas
                     </UButton>
                  </div>
                  <p
                     v-if="!resumen.miAgenda.length"
                     class="rounded-xl bg-muted px-4 py-6 text-center text-sm text-usm-text-muted dark:text-slate-400"
                  >
                     No tienes clases ni reservas registradas para hoy.
                  </p>
                  <div v-else class="space-y-2">
                     <div
                        v-for="(evento, i) in resumen.miAgenda"
                        :key="`${evento.inicio}-${evento.titulo}-${i}`"
                        class="flex items-start gap-3 rounded-xl bg-muted px-4 py-3"
                     >
                        <span class="mt-1.5 size-2 shrink-0 rounded-full" :style="estiloPunto(evento.color)" />
                        <div class="min-w-0 flex-1">
                           <p class="truncate text-sm font-medium text-usm-text dark:text-white">
                              {{ evento.titulo }}
                           </p>
                           <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                              {{ evento.detalle }}
                              <template v-if="evento.salaCodigo"> · {{ evento.salaCodigo }}</template>
                              <template v-else-if="evento.esClase"> · Sin sala</template>
                           </p>
                        </div>
                        <span
                           class="shrink-0 rounded-lg bg-usm-blue/10 px-2 py-1 text-xs font-medium whitespace-nowrap text-usm-blue dark:bg-usm-cyan/10 dark:text-usm-cyan"
                        >
                           {{ evento.inicio }}–{{ evento.fin }}
                        </span>
                     </div>
                  </div>
               </div>

               <!-- Estado de la planificación: solo Administrador, Director Departamento y Jefe
                    de Carrera — son quienes gestionan sala/profesor/topes de la malla. -->
               <div v-if="puedeVerPlanificacion" class="rounded-2xl border border-default bg-default p-5 sm:p-6">
                  <div class="mb-4 flex items-center gap-2">
                     <UIcon name="i-lucide-clipboard-check" class="size-4 text-usm-green" />
                     <h2 class="text-sm font-semibold text-usm-text dark:text-white">
                        {{ esPersonal ? 'Planificación de mis carreras' : 'Estado de la planificación' }}
                     </h2>
                  </div>
                  <p
                     v-if="!resumen.planificacion?.clasesTotales"
                     class="rounded-xl bg-muted px-4 py-6 text-center text-sm text-usm-text-muted dark:text-slate-400"
                  >
                     {{
                        esPersonal
                           ? 'Todavía no hay clases agendadas en tus carreras en este semestre.'
                           : 'Todavía no hay clases agendadas en este semestre.'
                     }}
                  </p>
                  <template v-else>
                     <div class="space-y-4">
                        <div v-for="metrica in metricas" :key="metrica.label">
                           <div class="mb-1.5 flex items-baseline justify-between gap-3">
                              <span class="flex min-w-0 items-center gap-1.5 text-xs text-usm-text dark:text-slate-200">
                                 <UIcon :name="metrica.icon" class="size-3.5 shrink-0" />
                                 <NuxtLink
                                    v-if="puedeVerRuta(metrica.ruta)"
                                    :to="metrica.ruta"
                                    class="truncate hover:underline"
                                 >
                                    {{ metrica.label }}
                                 </NuxtLink>
                                 <span v-else class="truncate">{{ metrica.label }}</span>
                              </span>
                              <span class="shrink-0 text-xs font-medium text-usm-text-muted dark:text-slate-400">
                                 {{ metrica.hecho }}/{{ metrica.total }}
                              </span>
                           </div>
                           <div class="h-2 overflow-hidden rounded-full bg-elevated">
                              <div
                                 class="h-full rounded-full transition-all"
                                 :class="claseBarra(metrica.hecho, metrica.total)"
                                 :style="{ width: `${porcentaje(metrica.hecho, metrica.total)}%` }"
                              />
                           </div>
                        </div>
                     </div>

                     <!-- Topes: solo aparece la fila si hay alguno que resolver y el rol puede ver el reporte. -->
                     <NuxtLink
                        v-if="totalTopes && puedeVerTopesHorario"
                        to="/reportes/topes-horario"
                        class="mt-5 flex items-center gap-3 rounded-xl border border-usm-yellow-300 bg-usm-yellow-50 px-4 py-3 transition-colors hover:bg-usm-yellow-100 dark:border-usm-yellow-800 dark:bg-usm-yellow-950 dark:hover:bg-usm-yellow-900"
                     >
                        <UIcon name="i-lucide-triangle-alert" class="size-4 shrink-0 text-usm-yellow-700" />
                        <div class="min-w-0 flex-1">
                           <p class="text-sm font-medium text-usm-text dark:text-white">
                              {{ totalTopes }} {{ totalTopes === 1 ? 'tope detectado' : 'topes detectados' }}
                           </p>
                           <p class="text-xs text-usm-text-muted dark:text-slate-400">
                              {{ resumen.planificacion.topesSala }} de sala ·
                              {{ resumen.planificacion.topesProfesor }} de profesor
                           </p>
                        </div>
                        <UIcon name="i-lucide-arrow-right" class="size-4 shrink-0 text-usm-text-muted" />
                     </NuxtLink>
                     <div
                        v-else
                        class="mt-5 flex items-center gap-3 rounded-xl border border-usm-green/30 bg-usm-green/10 px-4 py-3"
                     >
                        <UIcon name="i-lucide-check-circle-2" class="size-4 shrink-0 text-usm-green" />
                        <p class="text-sm font-medium text-usm-text dark:text-white">
                           Sin topes de sala ni de profesor
                        </p>
                     </div>
                  </template>
               </div>
            </div>

            <!-- Próximas clases y próximas reservas en las salas a cargo, una al lado de la
                 otra. Van en ambos modos: son información personal (EncargadoSala) incluso en
                 la portada global del Administrador. -->
            <div class="grid gap-6 lg:grid-cols-2">
               <!-- Próximas clases -->
               <div class="rounded-2xl border border-default bg-default p-5 sm:p-6">
                  <div class="mb-4 flex items-center justify-between gap-2">
                     <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-calendar-clock" class="size-4 text-usm-blue" />
                        <h2 class="text-sm font-semibold text-usm-text dark:text-white">
                           Próximas clases en mis salas
                        </h2>
                     </div>
                     <UButton
                        v-if="puedeVerReservas"
                        to="/reservas/horario"
                        variant="link"
                        color="neutral"
                        size="xs"
                        trailing-icon="i-lucide-arrow-right"
                     >
                        Ver horario
                     </UButton>
                  </div>
                  <p
                     v-if="!resumen.proximasClases.length"
                     class="rounded-xl bg-muted px-4 py-6 text-center text-sm text-usm-text-muted dark:text-slate-400"
                  >
                     No hay clases próximas en salas a tu cargo.
                  </p>
                  <div v-else class="space-y-2">
                     <div
                        v-for="clase in resumen.proximasClases"
                        :key="`${clase.fecha}-${clase.inicio}-${clase.asignaturaCodigo}-${clase.paraleloCodigo}`"
                        class="flex items-start gap-3 rounded-xl border-s-4 bg-muted px-4 py-3"
                        :class="clase.enCurso ? 'border-s-usm-green' : 'border-s-transparent'"
                     >
                        <span class="mt-1.5 size-2 shrink-0 rounded-full" :style="estiloPunto(clase.color)" />
                        <div class="min-w-0 flex-1">
                           <p
                              class="flex items-center gap-1.5 truncate text-sm font-medium text-usm-text dark:text-white"
                           >
                              {{ clase.asignaturaCodigo }} · Paralelo {{ clase.paraleloCodigo }}
                              <UBadge v-if="clase.enCurso" color="success" variant="subtle" size="xs" class="shrink-0">
                                 <span class="me-1 inline-block size-1.5 animate-pulse rounded-full bg-current" />
                                 En curso
                              </UBadge>
                           </p>
                           <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                              {{ clase.asignaturaNombre }} · {{ clase.carrera }}
                           </p>
                           <p class="mt-0.5 flex items-center gap-1 text-xs text-usm-text-muted dark:text-slate-400">
                              <UIcon name="i-lucide-user" class="size-3 shrink-0" />
                              <span class="truncate" :class="clase.profesor ? '' : 'italic'">
                                 {{ clase.profesor ?? 'Sin profesor asignado' }}
                              </span>
                           </p>
                        </div>
                        <div class="shrink-0 space-y-1 text-right">
                           <span
                              class="inline-flex items-center gap-1 rounded-lg bg-usm-cyan/10 px-2 py-1 text-xs font-medium whitespace-nowrap text-usm-cyan"
                           >
                              <UIcon name="i-lucide-door-open" class="size-3" />
                              {{ clase.salaCodigo }}
                           </span>
                           <p class="text-xs whitespace-nowrap text-usm-text-muted dark:text-slate-400">
                              {{ formatFechaRelativa(clase.fecha) }} · {{ clase.inicio }}–{{ clase.fin }}
                           </p>
                        </div>
                     </div>
                  </div>
               </div>

               <!-- Próximas reservas de sala que NO son de clase (ayudantías, reuniones,
                    eventos…), en las salas a cargo. -->
               <div class="rounded-2xl border border-default bg-default p-5 sm:p-6">
                  <div class="mb-4 flex items-center justify-between gap-2">
                     <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-calendar-check" class="size-4 text-usm-green" />
                        <h2 class="text-sm font-semibold text-usm-text dark:text-white">
                           Próximas reservas en mis salas
                        </h2>
                     </div>
                     <UButton
                        v-if="puedeVerReservas"
                        to="/reservas/horario"
                        variant="link"
                        color="neutral"
                        size="xs"
                        trailing-icon="i-lucide-arrow-right"
                     >
                        Ver horario
                     </UButton>
                  </div>
                  <p
                     v-if="!resumen.proximasReservas.length"
                     class="rounded-xl bg-muted px-4 py-6 text-center text-sm text-usm-text-muted dark:text-slate-400"
                  >
                     No hay reservas próximas (fuera de clases) en salas a tu cargo.
                  </p>
                  <div v-else class="space-y-2">
                     <div
                        v-for="reserva in resumen.proximasReservas"
                        :key="`${reserva.fecha}-${reserva.inicio}-${reserva.titulo}-${reserva.salaCodigo}`"
                        class="flex items-start gap-3 rounded-xl border-s-4 bg-muted px-4 py-3"
                        :class="reserva.enCurso ? 'border-s-usm-green' : 'border-s-transparent'"
                     >
                        <span class="mt-1.5 size-2 shrink-0 rounded-full" :style="estiloPunto(reserva.color)" />
                        <div class="min-w-0 flex-1">
                           <p
                              class="flex items-center gap-1.5 truncate text-sm font-medium text-usm-text dark:text-white"
                           >
                              {{ reserva.titulo }}
                              <UBadge
                                 v-if="reserva.enCurso"
                                 color="success"
                                 variant="subtle"
                                 size="xs"
                                 class="shrink-0"
                              >
                                 <span class="me-1 inline-block size-1.5 animate-pulse rounded-full bg-current" />
                                 En curso
                              </UBadge>
                           </p>
                           <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                              {{ reserva.tipo }}
                              <template v-if="reserva.responsable"> · {{ reserva.responsable }}</template>
                           </p>
                        </div>
                        <div class="shrink-0 space-y-1 text-right">
                           <span
                              class="inline-flex items-center gap-1 rounded-lg bg-usm-cyan/10 px-2 py-1 text-xs font-medium whitespace-nowrap text-usm-cyan"
                           >
                              <UIcon name="i-lucide-door-open" class="size-3" />
                              {{ reserva.salaCodigo }}
                           </span>
                           <p class="text-xs whitespace-nowrap text-usm-text-muted dark:text-slate-400">
                              {{ formatFechaRelativa(reserva.fecha) }} · {{ reserva.inicio }}–{{ reserva.fin }}
                           </p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <!-- ── Modo personal: mis carreras y mis salas ──────────────────── -->
            <div v-if="esPersonal" class="grid gap-6 lg:grid-cols-2">
               <!-- Mis carreras -->
               <div class="rounded-2xl border border-default bg-default p-5 sm:p-6">
                  <div class="mb-4 flex items-center gap-2">
                     <UIcon name="i-lucide-graduation-cap" class="size-4 text-usm-blue" />
                     <h2 class="text-sm font-semibold text-usm-text dark:text-white">Mis carreras</h2>
                  </div>
                  <p
                     v-if="!resumen.misCarreras.length"
                     class="rounded-xl bg-muted px-4 py-6 text-center text-sm text-usm-text-muted dark:text-slate-400"
                  >
                     No estás asociado a ninguna carrera. Pídele a un Administrador que te agregue en Carreras →
                     Asignación de personas.
                  </p>
                  <div v-else class="space-y-4">
                     <div v-for="carrera in resumen.misCarreras" :key="carrera.codigo" class="rounded-xl bg-muted p-4">
                        <div class="mb-2 flex items-start justify-between gap-2">
                           <div class="min-w-0">
                              <p class="truncate text-sm font-medium text-usm-text dark:text-white">
                                 {{ carrera.nombre }}
                              </p>
                              <p class="text-xs text-usm-text-muted dark:text-slate-400">
                                 {{ carrera.cursos }} {{ carrera.cursos === 1 ? 'curso' : 'cursos' }} ·
                                 {{ carrera.paralelos }} {{ carrera.paralelos === 1 ? 'paralelo' : 'paralelos' }}
                              </p>
                           </div>
                           <UBadge v-if="carrera.esJefe" color="primary" variant="subtle" size="xs" class="shrink-0">
                              Jefe de carrera
                           </UBadge>
                        </div>

                        <p v-if="!carrera.clasesTotales" class="text-xs text-usm-text-muted italic dark:text-slate-500">
                           Sin clases agendadas en este semestre.
                        </p>
                        <div v-else class="space-y-2">
                           <div>
                              <div class="mb-1 flex items-baseline justify-between gap-3 text-xs">
                                 <span class="text-usm-text dark:text-slate-200">Clases con sala</span>
                                 <span class="shrink-0 text-usm-text-muted dark:text-slate-400">
                                    {{ carrera.clasesConSala }}/{{ carrera.clasesTotales }}
                                 </span>
                              </div>
                              <div class="h-1.5 overflow-hidden rounded-full bg-elevated">
                                 <div
                                    class="h-full rounded-full transition-all"
                                    :class="claseBarra(carrera.clasesConSala, carrera.clasesTotales)"
                                    :style="{ width: `${porcentaje(carrera.clasesConSala, carrera.clasesTotales)}%` }"
                                 />
                              </div>
                           </div>
                           <div>
                              <div class="mb-1 flex items-baseline justify-between gap-3 text-xs">
                                 <span class="text-usm-text dark:text-slate-200">Clases con profesor</span>
                                 <span class="shrink-0 text-usm-text-muted dark:text-slate-400">
                                    {{ carrera.clasesConProfesor }}/{{ carrera.clasesTotales }}
                                 </span>
                              </div>
                              <div class="h-1.5 overflow-hidden rounded-full bg-elevated">
                                 <div
                                    class="h-full rounded-full transition-all"
                                    :class="claseBarra(carrera.clasesConProfesor, carrera.clasesTotales)"
                                    :style="{
                                       width: `${porcentaje(carrera.clasesConProfesor, carrera.clasesTotales)}%`,
                                    }"
                                 />
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               <!-- Mis salas -->
               <div class="rounded-2xl border border-default bg-default p-5 sm:p-6">
                  <div class="mb-4 flex items-center justify-between gap-2">
                     <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-door-open" class="size-4 text-usm-purple" />
                        <h2 class="text-sm font-semibold text-usm-text dark:text-white">Mis salas hoy</h2>
                     </div>
                     <UButton
                        v-if="puedeVerReservas"
                        to="/reservas/horario"
                        variant="link"
                        color="neutral"
                        size="xs"
                        trailing-icon="i-lucide-arrow-right"
                     >
                        Ver horario
                     </UButton>
                  </div>
                  <p
                     v-if="!resumen.misSalas.length"
                     class="rounded-xl bg-muted px-4 py-6 text-center text-sm text-usm-text-muted dark:text-slate-400"
                  >
                     No tienes salas a tu cargo. Pídele a un Administrador que te agregue como encargado en Salas →
                     Asignación.
                  </p>
                  <div v-else class="space-y-3">
                     <div v-for="sala in resumen.misSalas" :key="sala.codigo">
                        <div class="mb-1 flex items-baseline justify-between gap-3">
                           <span class="min-w-0 truncate text-xs font-medium text-usm-text dark:text-slate-200">
                              {{ sala.codigo }}
                              <span class="font-normal text-usm-text-muted dark:text-slate-400">
                                 · {{ sala.tipoSala }}
                              </span>
                           </span>
                           <span class="shrink-0 text-xs text-usm-text-muted dark:text-slate-400">
                              {{ sala.clasesHoy }} {{ sala.clasesHoy === 1 ? 'clase' : 'clases' }}
                              <template v-if="sala.reservasHoy">
                                 · {{ sala.reservasHoy }}
                                 {{ sala.reservasHoy === 1 ? 'reserva' : 'reservas' }}
                              </template>
                           </span>
                        </div>
                        <div class="h-1.5 overflow-hidden rounded-full bg-elevated">
                           <div
                              class="h-full rounded-full bg-usm-purple transition-all"
                              :style="{ width: `${porcentaje(sala.ocupadosHoy, sala.totalBloques)}%` }"
                           />
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div class="grid gap-6 lg:grid-cols-2">
               <!-- Ocupación de salas hoy: en modo personal ya está cubierto por "Mis salas". -->
               <div v-if="!esPersonal" class="rounded-2xl border border-default bg-default p-5 sm:p-6">
                  <div class="mb-4 flex items-center gap-2">
                     <UIcon name="i-lucide-door-open" class="size-4 text-usm-purple" />
                     <h2 class="text-sm font-semibold text-usm-text dark:text-white">Salas más ocupadas hoy</h2>
                  </div>
                  <p
                     v-if="!resumen.salasOcupadasHoy.length"
                     class="rounded-xl bg-muted px-4 py-6 text-center text-sm text-usm-text-muted dark:text-slate-400"
                  >
                     Ninguna sala tiene actividad hoy.
                  </p>
                  <div v-else class="space-y-3">
                     <div v-for="sala in resumen.salasOcupadasHoy" :key="sala.codigo">
                        <div class="mb-1 flex items-baseline justify-between gap-3">
                           <span class="truncate text-xs font-medium text-usm-text dark:text-slate-200">
                              {{ sala.codigo }}
                           </span>
                           <span class="shrink-0 text-xs text-usm-text-muted dark:text-slate-400">
                              {{ sala.ocupados }} de {{ sala.total }} bloques
                           </span>
                        </div>
                        <div class="h-1.5 overflow-hidden rounded-full bg-elevated">
                           <div
                              class="h-full rounded-full bg-usm-purple transition-all"
                              :style="{ width: `${porcentaje(sala.ocupados, sala.total)}%` }"
                           />
                        </div>
                     </div>
                  </div>
               </div>

               <!-- Próximos feriados -->
               <div class="rounded-2xl border border-default bg-default p-5 sm:p-6">
                  <div class="mb-4 flex items-center justify-between gap-2">
                     <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-calendar-off" class="size-4 text-usm-red" />
                        <h2 class="text-sm font-semibold text-usm-text dark:text-white">Próximos feriados</h2>
                     </div>
                     <UButton
                        v-if="puedeVerFeriados"
                        to="/feriados"
                        variant="link"
                        color="neutral"
                        size="xs"
                        trailing-icon="i-lucide-arrow-right"
                     >
                        Ver todos
                     </UButton>
                  </div>
                  <p
                     v-if="!resumen.proximosFeriados.length"
                     class="rounded-xl bg-muted px-4 py-6 text-center text-sm text-usm-text-muted dark:text-slate-400"
                  >
                     No quedan feriados registrados en este semestre.
                  </p>
                  <div v-else class="space-y-2">
                     <div
                        v-for="feriado in resumen.proximosFeriados"
                        :key="feriado.fecha"
                        class="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3"
                     >
                        <div class="min-w-0">
                           <p class="truncate text-sm font-medium text-usm-text dark:text-white">
                              {{ formatFechaLarga(feriado.fecha) }}
                           </p>
                           <p class="text-xs text-usm-text-muted dark:text-slate-400">
                              {{ feriado.horaInicio ? `${feriado.horaInicio}–${feriado.horaTermino}` : 'Todo el día' }}
                           </p>
                        </div>
                        <UBadge
                           :label="feriado.alcance === 'SOLO_CLASES' ? 'Solo clases' : 'Total'"
                           :color="feriado.alcance === 'SOLO_CLASES' ? 'warning' : 'error'"
                           variant="subtle"
                           class="shrink-0"
                        />
                     </div>
                  </div>
               </div>
            </div>
         </template>
      </template>
   </div>
</template>
