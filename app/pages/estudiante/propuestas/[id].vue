<script setup lang="ts">
import type { CatalogosPropuesta, TtPropuestaConEstado } from '~/types/titulaciones'

definePageMeta({ layout: 'estudiante' })

const route = useRoute()
const id = Number(route.params.id)
const toast = useToast()

const [{ data: catalogos }, { data: propuesta, refresh }] = await Promise.all([
   useFetch<CatalogosPropuesta>('/api/estudiante/catalogos'),
   useFetch<TtPropuestaConEstado>(`/api/estudiante/propuestas/${id}`),
])

if (propuesta.value?.estados.some((e) => !e.vistoFechaHora)) {
   try {
      await $fetch(`/api/estudiante/propuestas/${id}/marcar-visto`, { method: 'POST' })
      const ahora = new Date().toISOString()
      for (const estado of propuesta.value.estados) {
         if (!estado.vistoFechaHora) estado.vistoFechaHora = ahora
      }
   } catch {
      // No crítico: si falla, el indicador de "no visto" en la lista simplemente sigue apareciendo.
   }
}

function ultimoEstado(p: TtPropuestaConEstado) {
   return p.estados[0]?.estado ?? null
}

function guiaDe(p: TtPropuestaConEstado) {
   return p.comision[0]?.profesor ?? null
}

function colorEstado(estado: string | null) {
   if (estado === 'Pendiente') return 'info'
   if (estado === 'Rechazada') return 'error'
   if (estado === 'Aceptada') return 'success'
   if (estado === 'Antecedentes solicitados') return 'warning'
   return 'neutral'
}

function fechaFormateada(fecha: string) {
   return new Date(fecha).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
}

function indicadorEstado(estado: string) {
   if (estado === 'Pendiente') return 'bg-info'
   if (estado === 'Rechazada') return 'bg-error'
   if (estado === 'Antecedentes solicitados') return 'bg-warning'
   return 'bg-success'
}

function iconoEstado(estado: string) {
   if (estado === 'Pendiente') return 'i-lucide-clock'
   if (estado === 'Rechazada') return 'i-lucide-x'
   if (estado === 'Antecedentes solicitados') return 'i-lucide-message-circle-question'
   return 'i-lucide-check'
}

// Timeline muestra las mismas filas que antes iban en la lista manual, más reciente primero
// (mismo orden que ya trae `propuesta.estados`).
const itemsHistorial = computed(() => {
   const p = propuesta.value
   if (!p) return []
   return p.estados.map((estado) => ({
      title: estado.estado,
      date: fechaFormateada(estado.fechaHora),
      description: estado.comentario ?? undefined,
      icon: iconoEstado(estado.estado),
      ui: { indicator: `${indicadorEstado(estado.estado)} text-inverted` },
   }))
})

// Un acordeón por campo de texto largo — solo entran los que la modalidad de la propuesta
// realmente completa. `content` es un prop propio de UAccordion: sin slot con nombre, el texto
// se renderiza solo.
const itemsDetalle = computed(() => {
   const p = propuesta.value
   if (!p) return []
   const items: { label: string; content: string }[] = [{ label: 'Descripción', content: p.descripcion }]
   if (p.invMotivacion) items.push({ label: 'Motivación', content: p.invMotivacion })
   if (p.invExperiencia) items.push({ label: 'Experiencia', content: p.invExperiencia })
   if (p.claProblema) items.push({ label: 'Problema', content: p.claProblema })
   if (p.claObjetivo) items.push({ label: 'Objetivo', content: p.claObjetivo })
   return items
})

// Solo se puede modificar la propuesta mientras la jefatura pidió más antecedentes — mismo gate
// que valida PATCH /api/estudiante/propuestas/[id].
const puedeEditar = computed(
   () => propuesta.value != null && ultimoEstado(propuesta.value) === 'Antecedentes solicitados'
)

const modalEditarMostrar = ref(false)
async function onGuardado() {
   await refresh()
   toast.add({ title: 'Propuesta actualizada', color: 'success', icon: 'i-lucide-check-circle' })
}
</script>

<template>
   <div class="-mt-2 space-y-6 sm:-mt-3 lg:-mt-4">
      <UButton to="/estudiante/propuestas" icon="i-lucide-arrow-left" variant="ghost" color="neutral" class="mb-2">
         Volver a mis propuestas
      </UButton>

      <EmptyState
         v-if="!propuesta"
         icon="i-lucide-file-x"
         message="No se encontró la propuesta."
         action="Volver a mis propuestas"
         @action="navigateTo('/estudiante/propuestas')"
      />

      <div v-else class="space-y-4">
         <div class="rounded-2xl border border-default bg-default p-4 sm:p-6">
            <h2 class="text-lg font-semibold text-usm-text dark:text-white">{{ propuesta.titulo }}</h2>

            <div class="mt-2 flex flex-wrap items-center gap-2">
               <UBadge :color="colorEstado(ultimoEstado(propuesta))" variant="subtle">
                  {{ ultimoEstado(propuesta) ?? 'Sin estado' }}
               </UBadge>
               <span class="text-xs text-usm-text font-bold dark:text-slate-400">
                  {{ propuesta.modalidad }}
               </span>
               <span class="text-xs text-usm-text-muted dark:text-slate-400">
                  · Recibida el {{ fechaFormateada(propuesta.fecha) }}
               </span>
            </div>

            <div class="mt-4 space-y-3">
               <div v-if="catalogos?.mostrarGuia">
                  <dt class="text-xs font-bold text-usm-text-muted dark:text-slate-400">Profesor guía</dt>
                  <dd class="mt-1 flex flex-wrap items-center gap-2 text-sm">
                     <template v-if="guiaDe(propuesta)"
                        ><UBadge color="info" variant="subtle"
                           >{{ guiaDe(propuesta)!.nombre }} {{ guiaDe(propuesta)!.apellido }}</UBadge
                        >
                        <span class="text-usm-text-muted dark:text-slate-400">{{ guiaDe(propuesta)!.email }}</span
                        ></template
                     >
                     <template v-else
                        ><span class="text-usm-text dark:text-slate-200">Sin guía asignado</span></template
                     >
                  </dd>
               </div>
               <div v-if="propuesta.lineaInvestigacion">
                  <dt class="text-xs font-medium text-usm-text-muted dark:text-slate-400">Línea de investigación</dt>
                  <dd class="text-sm text-usm-green font-semibold">{{ propuesta.lineaInvestigacion.nombre }}</dd>
               </div>
               <div v-if="propuesta.rol">
                  <dt class="text-xs font-medium text-usm-text-muted dark:text-slate-400">Rol</dt>
                  <dd class="text-sm text-usm-text font-bold dark:text-slate-200">{{ propuesta.rol.nombre }}</dd>
               </div>
            </div>

            <UAccordion
               :items="itemsDetalle"
               type="multiple"
               :default-value="['0']"
               class="mt-4"
               :ui="{
                  root: 'rounded-lg border border-default divide-y divide-default',
                  trigger: 'px-3 py-2 text-sm',
                  body: 'px-3 pb-3 text-sm text-usm-text dark:text-slate-200',
               }"
            />

            <div
               v-if="puedeEditar"
               class="mt-4 flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
               <p class="text-sm text-usm-text dark:text-slate-200">
                  Te han solicitado que agregues o modifiques información de tu propuesta. Presiona el botón para hacer
                  las modificaciones respectivas.
               </p>
               <UButton
                  icon="i-lucide-pen"
                  color="warning"
                  class="shrink-0 self-end sm:self-auto"
                  @click="
                     () => {
                        modalEditarMostrar = true
                     }
                  "
               >
                  Modificar
               </UButton>
            </div>
         </div>

         <div class="rounded-2xl border border-default bg-default p-4 sm:p-6">
            <h3 class="mb-3 font-semibold text-usm-text dark:text-white">Historial de estados</h3>
            <UTimeline :items="itemsHistorial" orientation="vertical" />
         </div>

         <FormularioPropuesta
            v-model:open="modalEditarMostrar"
            :catalogos="catalogos"
            :propuesta="propuesta"
            @guardado="onGuardado"
         />
      </div>
   </div>
</template>
