<script setup lang="ts">
import type {
   ConteoCarreraResumen,
   ModoResumenSemestres,
   ResumenSemestres,
   TarjetaSemestreResumen,
} from '~/types/semestre'

const toast = useToast()
const { puedeEditar } = usePermiso('/semestres/resumen')
const { conIndicador } = useIndicadorCarga()

// `null` deja que el servidor elija el modo por defecto según el rol; el servidor ignora un
// modo que no corresponda al rol.
const modo = ref<ModoResumenSemestres | null>(null)
const {
   data: resumen,
   status,
   refresh,
} = await useFetch<ResumenSemestres>(() => `/api/semestres/resumen${modo.value ? `?modo=${modo.value}` : ''}`)

function formatFecha(fecha: string) {
   return new Date(fecha).toLocaleDateString('es-CL', { timeZone: 'UTC' })
}

interface Tarjeta {
   clave: 'vigente' | 'borrador'
   titulo: string
   icono: string
   color: 'success' | 'info'
   semestre: TarjetaSemestreResumen | null
   mensajeVacio: string
}

const tarjetas = computed<Tarjeta[]>(() => [
   {
      clave: 'vigente',
      titulo: 'Semestre vigente',
      icono: 'i-lucide-badge-check',
      color: 'success',
      semestre: resumen.value?.vigente ?? null,
      mensajeVacio: 'No hay un semestre marcado como vigente.',
   },
   {
      clave: 'borrador',
      titulo: 'Semestre borrador',
      icono: 'i-lucide-wrench',
      color: 'info',
      semestre: resumen.value?.borrador ?? null,
      mensajeVacio: 'No hay un semestre marcado como borrador.',
   },
])

function gestionaVisibilidad(tarjeta: Tarjeta) {
   return tarjeta.clave === 'borrador' && !!resumen.value?.puedeGestionarVisibilidad
}

/* ── Ocultar / mostrar los cursos de una carrera en el borrador ─────────── */
const cambiandoCarrera = ref<number | null>(null)

async function cambiarVisibilidad(carrera: ConteoCarreraResumen) {
   // Con algún curso visible se ocultan todos; si ya están todos ocultos, se muestran.
   const visible = carrera.cursosVisibles === 0
   cambiandoCarrera.value = carrera.codigo
   try {
      await $fetch('/api/semestres/resumen/visibilidad-cursos', {
         method: 'PATCH',
         body: { carreraCodigo: carrera.codigo, visible },
      })
      await conIndicador(() => refresh())
      toast.add({
         title: visible ? `Cursos de ${carrera.nombre} visibles` : `Cursos de ${carrera.nombre} ocultos`,
         color: 'success',
         icon: 'i-lucide-check-circle',
      })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'No se pudo cambiar la visibilidad'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      cambiandoCarrera.value = null
   }
}
</script>

<template>
   <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Cursos y paralelos del semestre vigente y del semestre en preparación (borrador).
         </p>
         <div v-if="resumen" class="w-full sm:w-56 sm:shrink-0">
            <USelect
               :model-value="resumen.modo"
               :items="resumen.opcionesModo"
               value-key="value"
               icon="i-lucide-eye"
               class="w-full"
               @update:model-value="modo = $event"
            />
         </div>
      </div>

      <TableSkeleton v-if="status === 'pending' && !resumen" :rows="6" />

      <div v-else class="grid gap-6 lg:grid-cols-2">
         <div
            v-for="tarjeta in tarjetas"
            :key="tarjeta.clave"
            class="space-y-5 rounded-2xl border border-default bg-default p-5 sm:p-6"
         >
            <div class="flex items-start justify-between gap-3">
               <div class="min-w-0">
                  <p class="flex items-center gap-2 text-sm font-medium text-usm-text-muted dark:text-slate-400">
                     <UIcon :name="tarjeta.icono" class="size-4 shrink-0" />
                     {{ tarjeta.titulo }}
                  </p>
                  <template v-if="tarjeta.semestre">
                     <h3 class="mt-1 text-xl font-semibold text-usm-text dark:text-white">
                        {{ tarjeta.semestre.nombre }}
                     </h3>
                     <p class="text-xs text-usm-text-muted dark:text-slate-400">
                        {{ formatFecha(tarjeta.semestre.fechaInicio) }} – {{ formatFecha(tarjeta.semestre.fechaFin) }}
                     </p>
                  </template>
               </div>
               <div v-if="tarjeta.semestre" class="flex shrink-0 flex-wrap justify-end gap-1.5">
                  <UBadge :color="tarjeta.color" variant="subtle">
                     {{ tarjeta.clave === 'vigente' ? 'Vigente' : 'Borrador' }}
                  </UBadge>
                  <UBadge v-if="!tarjeta.semestre.visible" color="neutral" variant="subtle">Oculto</UBadge>
               </div>
            </div>

            <EmptyState v-if="!tarjeta.semestre" icon="i-lucide-calendar-range" :message="tarjeta.mensajeVacio" />

            <template v-else>
               <div class="grid grid-cols-2 gap-3">
                  <div class="rounded-xl bg-muted p-4">
                     <p class="text-xs text-usm-text-muted dark:text-slate-400">Cursos</p>
                     <p class="mt-1 text-3xl font-semibold text-usm-text dark:text-white">
                        {{ tarjeta.semestre.cursos }}
                     </p>
                     <p
                        v-if="tarjeta.semestre.cursosVisibles < tarjeta.semestre.cursos"
                        class="mt-0.5 text-xs text-usm-text-muted dark:text-slate-400"
                     >
                        {{ tarjeta.semestre.cursosVisibles }} visible{{
                           tarjeta.semestre.cursosVisibles !== 1 ? 's' : ''
                        }}
                     </p>
                  </div>
                  <div class="rounded-xl bg-muted p-4">
                     <p class="text-xs text-usm-text-muted dark:text-slate-400">Paralelos</p>
                     <p class="mt-1 text-3xl font-semibold text-usm-text dark:text-white">
                        {{ tarjeta.semestre.paralelos }}
                     </p>
                  </div>
               </div>

               <p v-if="!tarjeta.semestre.carreras.length" class="text-sm text-usm-text-muted dark:text-slate-400">
                  No hay cursos en este semestre para el alcance seleccionado.
               </p>

               <div v-else class="divide-y divide-default overflow-hidden rounded-xl border border-default">
                  <div
                     v-for="carrera in tarjeta.semestre.carreras"
                     :key="carrera.codigo"
                     class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                     <div class="min-w-0">
                        <p class="truncate text-sm font-medium text-usm-text dark:text-white">{{ carrera.nombre }}</p>
                        <p class="text-xs text-usm-text-muted dark:text-slate-400">
                           {{ carrera.cursos }} curso{{ carrera.cursos !== 1 ? 's' : '' }} ·
                           {{ carrera.paralelos }} paralelo{{ carrera.paralelos !== 1 ? 's' : '' }}
                        </p>
                     </div>

                     <div
                        v-if="gestionaVisibilidad(tarjeta) && carrera.cursos"
                        class="flex shrink-0 items-center gap-2"
                     >
                        <UBadge :color="carrera.cursosVisibles === 0 ? 'neutral' : 'success'" variant="subtle">
                           {{
                              carrera.cursosVisibles === carrera.cursos
                                 ? 'Visibles'
                                 : carrera.cursosVisibles === 0
                                   ? 'Ocultos'
                                   : `${carrera.cursosVisibles} de ${carrera.cursos} visibles`
                           }}
                        </UBadge>
                        <UButton
                           :icon="carrera.cursosVisibles === 0 ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                           color="neutral"
                           variant="outline"
                           size="xs"
                           :loading="cambiandoCarrera === carrera.codigo"
                           :disabled="cambiandoCarrera !== null || !puedeEditar"
                           @click="cambiarVisibilidad(carrera)"
                        >
                           {{ carrera.cursosVisibles === 0 ? 'Mostrar cursos' : 'Ocultar cursos' }}
                        </UButton>
                     </div>
                  </div>
               </div>
            </template>
         </div>
      </div>
   </div>
</template>
