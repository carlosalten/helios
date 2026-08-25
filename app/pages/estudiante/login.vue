<script setup lang="ts">
import { z } from 'zod'

definePageMeta({
   layout: 'auth',
})

const schema = z.object({
   email: z.email({ error: 'Ingresa un correo válido' }),
   password: z.string({ error: 'La contraseña es requerida' }).min(1, 'La contraseña es requerida'),
})

const iniciandoSesion = ref(false)
const errorForm = ref('')
const formLogin = reactive({ email: '', password: '' })

const { fetch: fetchSession } = useUserSession()

// Captcha (Cloudflare Turnstile): mismo patrón que app/pages/login.vue — oculto en el primer
// intento, se muestra apenas falla uno (ver server/api/auth/estudiante/login.post.ts). El token
// es de un solo uso: `turnstileRef.reset()` pide uno nuevo para el siguiente intento.
const mostrarCaptcha = ref(false)
const turnstileToken = ref('')
const turnstileRef = ref()

async function login() {
   errorForm.value = ''
   iniciandoSesion.value = true
   // El servidor ya normaliza el email a minúsculas antes de revisar credenciales (ver
   // server/api/auth/estudiante/login.post.ts) — se hace también acá para que, si el login
   // falla, el campo quede mostrando el mismo valor que se envió a revisar.
   formLogin.email = formLogin.email.trim().toLowerCase()
   try {
      await $fetch('/api/auth/estudiante/login', {
         method: 'POST',
         body: { ...formLogin, turnstileToken: turnstileToken.value || undefined },
      })
      await fetchSession()
      await navigateTo('/estudiante')
   } catch (err: unknown) {
      const error = err as { data?: { message?: string; requiereCaptcha?: boolean } }
      errorForm.value = error?.data?.message ?? 'Ocurrió un error'
      mostrarCaptcha.value = true
      turnstileToken.value = ''
      turnstileRef.value?.reset()
   } finally {
      iniciandoSesion.value = false
   }
}
</script>

<template>
   <div class="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div class="w-full max-w-md">
         <!-- Card del formulario -->
         <div
            class="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm dark:shadow-none p-7 space-y-5"
         >
            <!-- Logo / título superior -->
            <div class="mb-8 text-center space-y-1">
               <div class="inline-flex items-center justify-center size-20 rounded-xl mb-4">
                  <NuxtImg src="/images/isotipo-usm.png" format="webp" quality="80" alt="UTFSM" />
               </div>
               <p class="text-xs font-semibold uppercase tracking-widest text-usm-cyan">
                  Departamento Electrotecnia e Informática
               </p>
               <h1 class="text-2xl font-bold text-usm-text dark:text-white">Portal de Estudiantes</h1>
               <p class="text-sm text-usm-gray dark:text-slate-400">
                  Ingresa con tu correo y contraseña para revisar tu propuesta de título.
               </p>
            </div>

            <UForm :schema="schema" :state="formLogin" class="space-y-5" @submit="login">
               <UFormField label="Correo" name="email">
                  <UInput
                     v-model="formLogin.email"
                     color="info"
                     placeholder="nombre@alumnos.usm.cl"
                     size="xl"
                     class="w-full"
                  />
               </UFormField>

               <UFormField label="Contraseña" name="password">
                  <UInput
                     v-model="formLogin.password"
                     color="info"
                     placeholder="Ingresa tu contraseña"
                     type="password"
                     size="xl"
                     class="w-full"
                  />
               </UFormField>

               <UAlert
                  v-if="errorForm"
                  color="error"
                  variant="soft"
                  icon="i-heroicons-exclamation-circle"
                  :title="errorForm"
               />

               <div v-if="mostrarCaptcha" class="flex justify-center">
                  <NuxtTurnstile ref="turnstileRef" v-model="turnstileToken" />
               </div>

               <UButton
                  type="submit"
                  :loading="iniciandoSesion"
                  :disabled="mostrarCaptcha && !turnstileToken"
                  block
                  size="xl"
               >
                  Ingresar
               </UButton>
            </UForm>
         </div>

         <footer class="mt-6">
            <p class="text-center text-xs text-usm-gray dark:text-slate-500">
               Desarrollado por Departamento Electrotecnia e Informática ELINF
            </p>
         </footer>
      </div>
   </div>
</template>
