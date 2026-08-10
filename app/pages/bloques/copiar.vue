<script setup lang="ts">
import type { Semestre } from '~/types/semestre'
import type { Bloque } from '~/types/bloque'
import { nombreCortoDia } from '~/types/dia'

const toast = useToast()

const [{ data: semestres, status }, { data: bloques, refresh: refrescarBloques }] = await Promise.all([
   useFetch<Semestre[]>('/api/semestres'),
   useFetch<Bloque[]>('/api/bloques'),
])

const { puedeCrear } = usePermiso('/bloques/copiar')

const semestreOrigenId = ref<number | undefined>(undefined)
const semestreDestinoId = ref<number | undefined>(undefined)

const opcionesSemestre = computed(() =>
   (semestres.value ?? []).map((s) => ({ label: s.nombre, value: s.id })),
)

const bloquesOrigen = computed(() =>
   (bloques.value ?? []).filter((b) => b.semestreId === semestreOrigenId.value),
)
const bloquesDestino = computed(() =>
   (bloques.value ?? []).filter((b) => b.semestreId === semestreDestinoId.value),
)

const mismoSemestre = computed(() =>
   semestreOrigenId.value !== undefined && semestreOrigenId.value === semestreDestinoId.value,
)

const puedeCopiar = computed(() =>
   puedeCrear.value &&
   semestreOrigenId.value !== undefined &&
   semestreDestinoId.value !== undefined &&
   !mismoSemestre.value &&
   bloquesOrigen.value.length > 0,
)

/* ── Copiar ──────────────────────────────────────────────── */
const copiando = ref(false)
const resultado = ref<{ copiados: number; omitidos: number; total: number } | null>(null)

async function copiarBloques() {
   if (!puedeCopiar.value) return
   copiando.value = true
   resultado.value = null
   try {
      resultado.value = await $fetch<{ copiados: number; omitidos: number; total: number }>(
         '/api/bloques/copiar',
         {
            method: 'POST',
            body: { semestreOrigenId: semestreOrigenId.value, semestreDestinoId: semestreDestinoId.value },
         },
      )
      await refrescarBloques()
      toast.add({
         title: `${resultado.value.copiados} bloque${resultado.value.copiados !== 1 ? 's' : ''} copiado${resultado.value.copiados !== 1 ? 's' : ''}`,
         color: 'success',
         icon: 'i-lucide-check-circle',
      })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al copiar los bloques'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      copiando.value = false
   }
}

function formatHora(hora: string) {
   return hora.slice(11, 16)
}
</script>

<template>
   <div class="space-y-6">
      <div>
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Copia los bloques horarios de un semestre a otro. Los bloques cuyo número ya exista en el semestre
            de destino no se duplican ni se sobrescriben.
         </p>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="4" />

      <template v-else>
         <div class="rounded-2xl border border-default bg-default p-4 sm:p-6 space-y-4">
            <div class="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
               <UFormField label="Semestre de origen">
                  <USelect v-model="semestreOrigenId" :items="opcionesSemestre" value-key="value"
                     placeholder="Selecciona un semestre" class="w-full" />
               </UFormField>
               <UIcon name="i-lucide-arrow-right" class="hidden size-5 shrink-0 justify-self-center text-usm-text-muted dark:text-slate-400 sm:block" />
               <UFormField label="Semestre de destino">
                  <USelect v-model="semestreDestinoId" :items="opcionesSemestre" value-key="value"
                     placeholder="Selecciona un semestre" class="w-full" />
               </UFormField>
            </div>

            <p v-if="mismoSemestre" class="text-sm text-usm-red">
               El semestre de origen y destino deben ser distintos.
            </p>

            <div v-if="semestreOrigenId !== undefined && semestreDestinoId !== undefined && !mismoSemestre"
               class="flex flex-col gap-2 rounded-xl bg-usm-light dark:bg-slate-800 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
               <span class="text-usm-text dark:text-slate-200">
                  <span class="font-semibold">{{ bloquesOrigen.length }}</span> bloque{{ bloquesOrigen.length !== 1 ? 's' : '' }} en el origen ·
                  <span class="font-semibold">{{ bloquesDestino.length }}</span> ya en el destino
               </span>
            </div>

            <div class="flex justify-end">
               <UButton icon="i-lucide-copy" :disabled="!puedeCopiar" :loading="copiando" @click="copiarBloques">
                  Copiar bloques
               </UButton>
            </div>
         </div>

         <div v-if="resultado" class="rounded-2xl border border-default bg-default p-4 sm:p-6">
            <h3 class="mb-3 font-semibold text-usm-text dark:text-white">Resultado</h3>
            <div class="grid grid-cols-3 gap-4 text-center">
               <div>
                  <p class="text-2xl font-bold text-usm-green">{{ resultado.copiados }}</p>
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">Copiados</p>
               </div>
               <div>
                  <p class="text-2xl font-bold text-usm-text-muted dark:text-slate-400">{{ resultado.omitidos }}</p>
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">Omitidos (ya existían)</p>
               </div>
               <div>
                  <p class="text-2xl font-bold text-usm-text dark:text-white">{{ resultado.total }}</p>
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">Total en origen</p>
               </div>
            </div>
         </div>

         <EmptyState v-if="!semestres?.length" icon="i-lucide-calendar-range"
            message="Primero crea al menos dos semestres para poder copiar bloques entre ellos" />

         <!-- Vista previa de bloques del origen -->
         <div v-else-if="semestreOrigenId !== undefined && bloquesOrigen.length" class="space-y-2">
            <h3 class="text-sm font-semibold text-usm-text dark:text-white">Bloques del semestre de origen</h3>
            <div class="overflow-hidden rounded-2xl border border-default bg-default divide-y divide-default">
               <div v-for="bloque in bloquesOrigen" :key="bloque.id"
                  class="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span class="text-usm-text dark:text-white">N° {{ bloque.numero }}</span>
                  <span class="text-usm-text-muted dark:text-slate-400">
                     {{ formatHora(bloque.inicio) }} – {{ formatHora(bloque.fin) }}
                  </span>
                  <div class="flex flex-wrap items-center justify-end gap-1">
                     <UBadge :color="bloque.jornada === 'VESPERTINA' ? 'info' : 'neutral'" variant="subtle">
                        {{ bloque.jornada === 'VESPERTINA' ? 'Vespertina' : 'Diurna' }}
                     </UBadge>
                     <UBadge v-for="dia in bloque.diasProtegidos" :key="dia" color="warning" variant="subtle">
                        {{ nombreCortoDia(dia) }}
                     </UBadge>
                  </div>
               </div>
            </div>
         </div>
      </template>
   </div>
</template>
