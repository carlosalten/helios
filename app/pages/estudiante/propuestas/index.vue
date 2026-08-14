<script setup lang="ts">
import type { CatalogosPropuesta, TtPropuestaConEstado } from '~/types/titulaciones'

definePageMeta({ layout: 'estudiante' })

const toast = useToast()

const [{ data: catalogos }, { data: propuestas, refresh }] = await Promise.all([
   useFetch<CatalogosPropuesta>('/api/estudiante/catalogos'),
   useFetch<TtPropuestaConEstado[]>('/api/estudiante/propuestas'),
])

function ultimoEstado(propuesta: TtPropuestaConEstado) {
   return propuesta.estados[0]?.estado ?? null
}

function colorEstado(estado: string | null) {
   if (estado === 'Pendiente') return 'info'
   if (estado === 'Rechazada') return 'error'
   if (estado === 'Aceptada') return 'success'
   if (estado === 'Antecedentes solicitados') return 'warning'
   return 'neutral'
}

function puntoEstado(estado: string) {
   if (estado === 'Pendiente') return 'bg-info'
   if (estado === 'Rechazada') return 'bg-error'
   if (estado === 'Antecedentes solicitados') return 'bg-warning'
   return 'bg-success'
}

const estadosInfo = [
   {
      estado: 'Pendiente',
      descripcion: 'Propuesta, o modificaciones de propuesta, ingresadas y en espera de revisión.',
   },
   {
      estado: 'Antecedentes solicitados',
      descripcion: 'La carrera solicita más información o modificaciones a la propuesta.',
   },
   { estado: 'Rechazada', descripcion: 'La propuesta no fue aceptada. Debes ingresar una nueva.' },
   { estado: 'Aceptada', descripcion: 'Propuesta aceptada. Se te asignará profesor guía.' },
] as const

function tieneNoVistos(propuesta: TtPropuestaConEstado) {
   return propuesta.estados.some((e) => !e.vistoFechaHora)
}

function fechaFormateada(fecha: string) {
   return new Date(fecha).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
}

// Se fija al cargar la página y se vuelve a fijar al presionar "Actualizar" — mismo criterio que
// /titulaciones/propuestas y el dashboard (app/pages/index.vue).
const ultimaActualizacion = ref(fechaFormateada(new Date().toISOString()))
const { conIndicador } = useIndicadorCarga()
async function actualizarPagina() {
   await conIndicador(() => refresh())
   ultimaActualizacion.value = fechaFormateada(new Date().toISOString())
}

// Puede ingresar una propuesta nueva si nunca ha presentado ninguna, o si todas las que tiene
// fueron rechazadas — mismo gate que valida POST /api/estudiante/propuestas.
const puedeIngresar = computed(
   () => !propuestas.value?.length || propuestas.value.every((p) => ultimoEstado(p) === 'Rechazada')
)

const modalMostrar = ref(false)
function abrirNuevaPropuesta() {
   modalMostrar.value = true
}

async function onGuardado() {
   await refresh()
   toast.add({ title: 'Propuesta enviada', color: 'success', icon: 'i-lucide-check-circle' })
}
</script>

<template>
   <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Tus propuestas de trabajo de título. Solo puede agregar propuestas si es que no tiene ninguna anterior o las
            que ya ingresó fueron rechazdas.
         </p>
         <div class="flex flex-wrap items-center gap-3 sm:justify-end">
            <div class="flex items-center gap-2">
               <p class="text-xs text-usm-text-muted dark:text-slate-400">Última actualización: {{ ultimaActualizacion }}</p>
               <UTooltip text="Actualizar">
                  <UButton
                     icon="i-lucide-refresh-cw"
                     color="neutral"
                     variant="ghost"
                     size="xs"
                     aria-label="Actualizar"
                     @click="actualizarPagina"
                  />
               </UTooltip>
            </div>
            <UTooltip :text="puedeIngresar ? '' : 'Ya tienes una propuesta en proceso'">
               <UButton icon="i-lucide-plus" :disabled="!puedeIngresar" @click="abrirNuevaPropuesta">
                  Nueva propuesta
               </UButton>
            </UTooltip>
         </div>
      </div>

      <div class="rounded-2xl border border-default bg-default p-4 sm:p-6">
         <h3 class="mb-3 text-sm font-semibold text-usm-text dark:text-white">Estados de la propuesta</h3>
         <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div v-for="info in estadosInfo" :key="info.estado" class="flex gap-2">
               <span class="mt-1 size-2 shrink-0 rounded-full" :class="puntoEstado(info.estado)" />
               <div class="min-w-0">
                  <dt class="text-sm font-medium text-usm-text dark:text-white">{{ info.estado }}</dt>
                  <dd class="text-xs text-usm-text-muted dark:text-slate-400">{{ info.descripcion }}</dd>
               </div>
            </div>
         </dl>
      </div>

      <EmptyState
         v-if="!propuestas?.length"
         icon="i-lucide-file-clock"
         message="Todavía no has presentado ninguna propuesta."
         action="Nueva propuesta"
         @action="abrirNuevaPropuesta"
      />

      <div v-else class="space-y-4">
         <div
            v-for="propuesta in propuestas"
            :key="propuesta.id"
            class="rounded-2xl border border-default bg-default p-4 sm:p-6"
         >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
               <div class="min-w-0">
                  <h3 class="font-semibold text-usm-text dark:text-white">{{ propuesta.titulo }}</h3>
                  <p class="mt-0.5 text-xs text-usm-text-muted dark:text-slate-400">
                     {{ propuesta.modalidad }}<template v-if="propuesta.rol"> · {{ propuesta.rol.nombre }}</template
                     ><template v-if="propuesta.lineaInvestigacion">
                        · {{ propuesta.lineaInvestigacion.nombre }}</template
                     >
                  </p>
                  <p class="mt-0.5 text-xs text-usm-text-muted dark:text-slate-400">
                     {{ fechaFormateada(propuesta.fecha) }}
                  </p>
                  <p v-if="tieneNoVistos(propuesta)" class="mt-1 flex items-center gap-1.5 text-xs text-error">
                     <UIcon name="i-lucide-bell" class="size-3.5 shrink-0" />
                     Tu propuesta cambió de estado, presiona Ver detalle para más información.
                  </p>
               </div>
               <div class="flex shrink-0 flex-col items-end gap-2">
                  <UBadge :color="colorEstado(ultimoEstado(propuesta))" variant="subtle">
                     {{ ultimoEstado(propuesta) ?? 'Sin estado' }}
                  </UBadge>
                  <UButton
                     :to="`/estudiante/propuestas/${propuesta.id}`"
                     icon="i-lucide-file-text"
                     color="neutral"
                     variant="soft"
                     size="xs"
                  >
                     Ver detalle
                  </UButton>
               </div>
            </div>
         </div>
      </div>

      <FormularioPropuesta v-model:open="modalMostrar" :catalogos="catalogos" @guardado="onGuardado" />
   </div>
</template>
