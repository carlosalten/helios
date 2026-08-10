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

// Captcha (Cloudflare Turnstile): oculto en el primer intento, se muestra apenas falla uno
// (credenciales malas o, por si el widget no llegó a mostrarse antes, el propio servidor lo
// pide vía `requiereCaptcha` — ver server/api/auth/login.post.ts). El token es de un solo
// uso: `turnstileRef.reset()` pide uno nuevo para el siguiente intento.
const mostrarCaptcha = ref(false)
const turnstileToken = ref('')
const turnstileRef = ref()

async function login() {
   errorForm.value = ''
   iniciandoSesion.value = true
   try {
      await $fetch('/api/auth/login', {
         method: 'POST',
         body: { ...formLogin, turnstileToken: turnstileToken.value || undefined },
      })
      await fetchSession()
      await navigateTo('/')
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
               <h1 class="text-2xl font-bold text-usm-text dark:text-white">Helios</h1>
               <p class="text-sm text-usm-gray dark:text-slate-400">
                  Ingrese sus credenciales para acceder al sistema.
               </p>
            </div>

            <UForm :schema="schema" :state="formLogin" class="space-y-5" @submit="login">
               <UFormField label="Correo USM" name="email">
                  <UInput
                     v-model="formLogin.email"
                     color="info"
                     placeholder="usuario@dominio"
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
                  Ingresar al Sistema
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
