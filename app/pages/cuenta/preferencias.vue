<script setup lang="ts">
import { COLORES_RESERVA } from '~/types/reserva'
import { TEMAS_PREFERIDOS, type TemaPreferido } from '~/types/preferencias'

const { user } = useUserSession()
const colorMode = useColorMode()
const toast = useToast()

/* ── Theme ───────────────────────────────────────────────── */
const formTema = reactive({ temaPreferido: user.value?.temaPreferido ?? 'CLARO' })
const guardandoTema = ref(false)
const errorTema = ref<string | null>(null)

const opcionesTema = TEMAS_PREFERIDOS.map((t) => ({ label: t.label, value: t.valor }))

function aplicarColorMode(tema: TemaPreferido) {
   colorMode.preference = tema === 'OSCURO' ? 'dark' : 'light'
}

async function guardarTema() {
   guardandoTema.value = true
   errorTema.value = null
   try {
      await $fetch('/api/preferencias', { method: 'PATCH', body: { ...formTema } })
      aplicarColorMode(formTema.temaPreferido)
      toast.add({ title: 'Preferencias guardadas', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorTema.value =
         (e as { data?: { message?: string } }).data?.message ?? 'No se pudieron guardar las preferencias'
   } finally {
      guardandoTema.value = false
   }
}

/* ── Topes de paralelo espejo en /horario ───────────────────
   Un mismo paralelo dictado en más de un curso (ver server/utils/sesionesEspejo.ts) hace que su
   sala y su profesor aparezcan "ocupados" en cada copia — no es un choque real, así que
   /horario lo destaca aparte de los topes de verdad (ver `topeEsEspejo` en horario/index.vue). */
const formTopes = reactive({
   mostrarTopesEspejo: user.value?.mostrarTopesEspejo ?? true,
   colorTopesEspejo: user.value?.colorTopesEspejo ?? '#06B6D4',
})
const guardandoTopes = ref(false)
const errorTopes = ref<string | null>(null)

async function guardarTopes() {
   guardandoTopes.value = true
   errorTopes.value = null
   try {
      await $fetch('/api/preferencias', { method: 'PATCH', body: { ...formTopes } })
      toast.add({ title: 'Preferencias guardadas', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorTopes.value =
         (e as { data?: { message?: string } }).data?.message ?? 'No se pudieron guardar las preferencias'
   } finally {
      guardandoTopes.value = false
   }
}
</script>

<template>
   <div class="space-y-6">
      <p class="text-sm text-usm-text-muted dark:text-slate-400">
         Elige cómo prefieres ver la interfaz. Cada tarjeta se guarda por separado, queda asociada a tu cuenta y se
         aplica cada vez que inicias sesión, sea cual sea el dispositivo.
      </p>

      <div class="max-w-lg rounded-2xl border border-default bg-default p-4 sm:p-6">
         <h3 class="mb-4 text-sm font-semibold text-usm-text dark:text-white">Theme</h3>
         <UForm id="form-tema" :state="formTema" class="space-y-4" @submit="guardarTema">
            <UFormField label="Selecciona el theme de tu preferencia" name="temaPreferido">
               <USelect v-model="formTema.temaPreferido" :items="opcionesTema" value-key="value" class="w-full" />
            </UFormField>

            <UAlert
               v-if="errorTema"
               icon="i-lucide-alert-circle"
               color="error"
               variant="subtle"
               :description="errorTema"
            />

            <div class="flex justify-end">
               <UButton type="submit" form="form-tema" :loading="guardandoTema">Guardar</UButton>
            </div>
         </UForm>
      </div>

      <div class="max-w-lg rounded-2xl border border-default bg-default p-4 sm:p-6">
         <h3 class="mb-1 text-sm font-semibold text-usm-text dark:text-white">Topes de horario</h3>
         <p class="mb-4 text-xs text-usm-text-muted dark:text-slate-400">
            Cuando un mismo paralelo se dicta en más de un curso, su sala y su profesor aparecen "ocupados" en cada
            copia, lo cual no es un choque real.
         </p>
         <p class="mb-4 text-xs text-usm-text-muted dark:text-slate-400">
            Elige si quieres que <span class="font-medium">Horario</span> lo destaque y con qué color.
         </p>
         <UForm id="form-topes" :state="formTopes" class="space-y-4" @submit="guardarTopes">
            <UFormField name="mostrarTopesEspejo">
               <USwitch v-model="formTopes.mostrarTopesEspejo" label="Destacar paralelos dictados en más de un curso" />
            </UFormField>

            <UFormField v-if="formTopes.mostrarTopesEspejo" label="Color" name="colorTopesEspejo">
               <div class="flex flex-wrap gap-2">
                  <button
                     v-for="c in COLORES_RESERVA"
                     :key="c.hex"
                     type="button"
                     class="size-7 rounded-full border-2 transition-transform"
                     :class="
                        formTopes.colorTopesEspejo === c.hex
                           ? 'scale-110 border-usm-text dark:border-white'
                           : 'border-transparent hover:scale-110'
                     "
                     :style="{ backgroundColor: c.hex }"
                     :aria-label="c.nombre"
                     :title="c.nombre"
                     @click="formTopes.colorTopesEspejo = c.hex"
                  />
               </div>
            </UFormField>

            <UAlert
               v-if="errorTopes"
               icon="i-lucide-alert-circle"
               color="error"
               variant="subtle"
               :description="errorTopes"
            />

            <div class="flex justify-end">
               <UButton type="submit" form="form-topes" :loading="guardandoTopes">Guardar</UButton>
            </div>
         </UForm>
      </div>
   </div>
</template>
