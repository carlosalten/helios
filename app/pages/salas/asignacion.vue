<script setup lang="ts">
import type { Sala, PersonaConAsignacion } from '~/types/sala'
import { JORNADAS_LABORALES, type JornadaLaboral } from '~/types/persona'

const toast = useToast()

const { data: salas, status: statusSalas } = await useFetch<Sala[]>('/api/salas')

const { puedeEditar } = usePermiso('/salas/asignacion')

/* ── Sala seleccionada ───────────────────────────────────── */
const salaSeleccionada = ref<Sala | null>(null)
const personas = ref<PersonaConAsignacion[]>([])
const cargandoPersonas = ref(false)

const busquedaSala = ref('')
const busquedaPersona = ref('')
const filtroRolId = ref<number | '__todos__'>('__todos__')
const filtroJornada = ref<JornadaLaboral | '__todos__'>('__todos__')

const opcionesRol = computed(() => {
   const vistos = new Map<number, string>()
   for (const p of personas.value) {
      if (p.rol && !vistos.has(p.rol.id)) vistos.set(p.rol.id, p.rol.nombre)
   }
   return [
      { label: 'Todos los roles', value: '__todos__' as const },
      ...Array.from(vistos, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
   ]
})

// El filtro de jornada solo tiene sentido para el rol Profesor (el resto de los roles no
// tiene jornada laboral, ver Persona.jornadaLaboral en schema.prisma): se muestra solo
// cuando el rol elegido es justo ese.
const rolFiltradoEsProfesor = computed(
   () => opcionesRol.value.find((o) => o.value === filtroRolId.value)?.label === 'Profesor'
)
const opcionesJornada = computed(() => [
   { label: 'Todas las jornadas', value: '__todos__' as const },
   ...JORNADAS_LABORALES.map((j) => ({ label: j.label, value: j.valor })),
])

// Cambiar de rol invalida el filtro de jornada (deja de tener sentido si ya no es Profesor).
watch(filtroRolId, () => {
   filtroJornada.value = '__todos__'
})
const filtroTipoSala = ref<number | '__todos__'>('__todos__')

const opcionesTipoSala = computed(() => {
   const vistos = new Map<number, string>()
   for (const s of salas.value ?? []) {
      if (!vistos.has(s.tipoSalaId)) vistos.set(s.tipoSalaId, s.tipoSala.nombre)
   }
   return [
      { label: 'Todos los tipos', value: '__todos__' as const },
      ...Array.from(vistos, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
   ]
})

const salasFiltradas = computed(() =>
   (salas.value ?? []).filter(
      (s) =>
         (normalizarTexto(s.codigo).includes(normalizarTexto(busquedaSala.value)) ||
            normalizarTexto(s.tipoSala.nombre).includes(normalizarTexto(busquedaSala.value))) &&
         (filtroTipoSala.value === '__todos__' || s.tipoSalaId === filtroTipoSala.value)
   )
)

const personasFiltradas = computed(() =>
   personas.value.filter(
      (p) =>
         (normalizarTexto(`${p.nombre} ${p.apellido}`).includes(normalizarTexto(busquedaPersona.value)) ||
            normalizarTexto(p.email).includes(normalizarTexto(busquedaPersona.value))) &&
         (filtroRolId.value === '__todos__' || p.rol?.id === filtroRolId.value) &&
         (!rolFiltradoEsProfesor.value ||
            filtroJornada.value === '__todos__' ||
            p.jornadaLaboral === filtroJornada.value)
   )
)

async function seleccionarSala(sala: Sala) {
   if (salaSeleccionada.value?.codigo === sala.codigo) return
   salaSeleccionada.value = sala
   busquedaPersona.value = ''
   cargandoPersonas.value = true
   try {
      const url: string = `/api/salas/${sala.codigo}/personas`
      personas.value = await $fetch<PersonaConAsignacion[]>(url)
   } finally {
      cargandoPersonas.value = false
   }
}

/* ── Toggle asignación ───────────────────────────────────── */
const toggling = ref<number | null>(null)

async function toggleAsignacion(persona: PersonaConAsignacion) {
   if (!salaSeleccionada.value || toggling.value) return
   toggling.value = persona.id
   try {
      const { asignado } = await $fetch<{ asignado: boolean }>('/api/salas/asignacion/toggle', {
         method: 'POST',
         body: { codigoSala: salaSeleccionada.value.codigo, personaId: persona.id },
      })
      persona.asignado = asignado
   } catch {
      toast.add({ title: 'Error al actualizar la asignación', color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      toggling.value = null
   }
}

const asignadosCount = computed(() => personas.value.filter((p) => p.asignado).length)
</script>

<template>
   <div class="space-y-6">
      <div>
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Selecciona una sala para gestionar qué personas son encargadas de ella
         </p>
      </div>

      <div class="lg:grid lg:grid-cols-[280px_1fr] lg:gap-6">
         <!-- Panel izquierdo: lista de salas -->
         <div class="space-y-3">
            <UInput v-model="busquedaSala" icon="i-lucide-search" placeholder="Buscar sala…" class="w-full" />
            <USelect v-model="filtroTipoSala" :items="opcionesTipoSala" value-key="value" class="w-full" />

            <TableSkeleton v-if="statusSalas === 'pending'" :rows="6" />

            <div
               v-else-if="!salasFiltradas.length"
               class="rounded-2xl border border-dashed border-default p-6 text-center"
            >
               <p class="text-sm text-usm-text-muted dark:text-slate-400">No se encontraron salas</p>
            </div>

            <div v-else class="space-y-1">
               <button
                  v-for="sala in salasFiltradas"
                  :key="sala.codigo"
                  class="w-full rounded-xl border px-4 py-3 text-left transition-colors duration-150"
                  :class="
                     salaSeleccionada?.codigo === sala.codigo
                        ? 'border-usm-blue bg-usm-blue/10 dark:border-usm-cyan dark:bg-usm-cyan/10'
                        : 'border-default bg-default hover:bg-gray-50 dark:hover:bg-slate-800'
                  "
                  @click="seleccionarSala(sala)"
               >
                  <p
                     class="text-sm font-semibold"
                     :class="
                        salaSeleccionada?.codigo === sala.codigo
                           ? 'text-usm-blue dark:text-usm-cyan'
                           : 'text-usm-text dark:text-white'
                     "
                  >
                     {{ sala.codigo }}
                  </p>
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">
                     {{ sala.tipoSala.nombre }} · {{ sala.capacidad }} personas
                  </p>
               </button>
            </div>
         </div>

         <!-- Panel derecho: personas encargadas de la sala seleccionada -->
         <div class="mt-6 lg:mt-0">
            <EmptyState
               v-if="!salaSeleccionada"
               icon="i-lucide-mouse-pointer-click"
               message="Selecciona una sala para ver y gestionar sus encargados"
            />

            <div v-else class="space-y-4">
               <!-- Cabecera del panel -->
               <div>
                  <h3 class="font-semibold text-usm-text dark:text-white">{{ salaSeleccionada.codigo }}</h3>
                  <p class="text-sm text-usm-text-muted dark:text-slate-400">
                     {{ salaSeleccionada.tipoSala.nombre }} · {{ salaSeleccionada.capacidad }} personas ·
                     <span class="font-medium text-usm-blue dark:text-usm-cyan">
                        {{ asignadosCount }} asignado{{ asignadosCount !== 1 ? 's' : '' }}
                     </span>
                  </p>
               </div>

               <!-- Filtros de personas -->
               <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <UInput
                     v-model="busquedaPersona"
                     icon="i-lucide-search"
                     placeholder="Buscar persona…"
                     class="sm:w-52"
                  />
                  <USelect v-model="filtroRolId" :items="opcionesRol" value-key="value" class="sm:w-44" />
                  <USelect
                     v-if="rolFiltradoEsProfesor"
                     v-model="filtroJornada"
                     :items="opcionesJornada"
                     value-key="value"
                     class="sm:w-48"
                  />
               </div>

               <!-- Lista de personas -->
               <TableSkeleton v-if="cargandoPersonas" :rows="5" />

               <div
                  v-else-if="!personasFiltradas.length"
                  class="rounded-2xl border border-dashed border-default p-6 text-center"
               >
                  <p class="text-sm text-usm-text-muted dark:text-slate-400">No se encontraron personas</p>
               </div>

               <div v-else class="overflow-hidden rounded-2xl border border-default bg-default divide-y divide-default">
                  <div
                     v-for="persona in personasFiltradas"
                     :key="persona.id"
                     class="flex items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                     <!-- Avatar -->
                     <div
                        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-usm-blue/10 dark:bg-usm-cyan/10"
                     >
                        <span class="text-xs font-bold text-usm-blue dark:text-usm-cyan">
                           {{ persona.nombre[0] }}{{ persona.apellido[0] }}
                        </span>
                     </div>

                     <!-- Info -->
                     <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium text-usm-text dark:text-white">
                           {{ persona.nombre }} {{ persona.apellido }}
                        </p>
                        <p class="truncate text-xs text-usm-text-muted dark:text-slate-400">
                           {{ persona.email }}<template v-if="persona.rol"> · {{ persona.rol.nombre }}</template>
                        </p>
                     </div>

                     <!-- Checkbox -->
                     <UCheckbox
                        :model-value="persona.asignado"
                        :disabled="toggling !== null || !puedeEditar"
                        :ui="{ base: toggling === persona.id ? 'opacity-50' : '' }"
                        @update:model-value="toggleAsignacion(persona)"
                     />
                  </div>
               </div>
            </div>
         </div>
      </div>
   </div>
</template>
