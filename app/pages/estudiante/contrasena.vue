<script setup lang="ts">
definePageMeta({ layout: 'estudiante' })

const toast = useToast()

const form = reactive({ passwordActual: '', password: '', passwordRepetida: '' })
const guardando = ref(false)
const error = ref<string | null>(null)

// Mismos requisitos que `passwordSchema` (server/utils/personas.schemas.ts). Se comprueban acá
// solo para guiar al usuario mientras escribe; quien valida de verdad es el endpoint.
const requisitos = computed(() => [
   { texto: 'Al menos 8 caracteres', cumple: form.password.length >= 8 },
   { texto: 'Una letra mayúscula', cumple: /[A-Z]/.test(form.password) },
   { texto: 'Una letra minúscula', cumple: /[a-z]/.test(form.password) },
   { texto: 'Un número', cumple: /\d/.test(form.password) },
   { texto: 'Un símbolo (por ejemplo: ! @ # $ %)', cumple: /[^A-Za-z0-9]/.test(form.password) },
])

const cumpleRequisitos = computed(() => requisitos.value.every((r) => r.cumple))
const coinciden = computed(() => form.password.length > 0 && form.password === form.passwordRepetida)
const puedeGuardar = computed(
   () => form.passwordActual.length > 0 && cumpleRequisitos.value && coinciden.value && !guardando.value
)

async function guardar() {
   if (!puedeGuardar.value) return
   guardando.value = true
   error.value = null
   try {
      await $fetch('/api/auth/estudiante/password', { method: 'PATCH', body: { ...form } })
      form.passwordActual = ''
      form.password = ''
      form.passwordRepetida = ''
      toast.add({ title: 'Contraseña actualizada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      error.value = (e as { data?: { message?: string } }).data?.message ?? 'No se pudo cambiar la contraseña'
   } finally {
      guardando.value = false
   }
}
</script>

<template>
   <div class="space-y-6">
      <p class="text-sm text-usm-text-muted dark:text-slate-400">Cambia la contraseña con la que ingresas al portal.</p>

      <div class="max-w-lg rounded-2xl border border-default bg-default p-4 sm:p-6">
         <UForm id="form-contrasena-estudiante" :state="form" class="space-y-4" @submit="guardar">
            <UFormField label="Contraseña actual" name="passwordActual" required>
               <UInput v-model="form.passwordActual" type="password" autocomplete="current-password" class="w-full" />
            </UFormField>

            <UFormField label="Nueva contraseña" name="password" required>
               <UInput v-model="form.password" type="password" autocomplete="new-password" class="w-full" />
            </UFormField>

            <ul class="space-y-1">
               <li
                  v-for="requisito in requisitos"
                  :key="requisito.texto"
                  class="flex items-center gap-2 text-xs"
                  :class="requisito.cumple ? 'text-success' : 'text-usm-text-muted dark:text-slate-400'"
               >
                  <UIcon
                     :name="requisito.cumple ? 'i-lucide-check-circle' : 'i-lucide-circle'"
                     class="size-3.5 shrink-0"
                  />
                  {{ requisito.texto }}
               </li>
            </ul>

            <UFormField
               label="Repetir nueva contraseña"
               name="passwordRepetida"
               required
               :error="form.passwordRepetida.length > 0 && !coinciden ? 'Las contraseñas no coinciden' : undefined"
            >
               <UInput v-model="form.passwordRepetida" type="password" autocomplete="new-password" class="w-full" />
            </UFormField>

            <UAlert v-if="error" icon="i-lucide-alert-circle" color="error" variant="subtle" :description="error" />

            <div class="flex justify-end">
               <UButton type="submit" form="form-contrasena-estudiante" :loading="guardando" :disabled="!puedeGuardar">
                  Cambiar contraseña
               </UButton>
            </div>
         </UForm>
      </div>
   </div>
</template>
