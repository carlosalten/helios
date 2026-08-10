<script setup lang="ts">
import type { Permiso, AccionPermisoPersonas } from '~/types/permiso'
import { ACCIONES_PERMISO, ACCIONES_PERMISO_PERSONAS, RUTAS_PERMISO, RUTA_PERMISO_PERSONAS_GESTION } from '~/types/permiso'
import type { Rol } from '~/types/persona'

const toast = useToast()

const ETIQUETAS_ACCION: Record<AccionPermisoPersonas, string> = {
   ver: 'Ver',
   crear: 'Crear',
   editar: 'Editar',
   contrasena: 'Contraseña',
   cambiarrol: 'Rol',
   activar: 'Activar',
   borrar: 'Borrar',
}

// Acciones finas de /personas/gestion (no forman parte del CRUD genérico de las demás rutas).
const ACCIONES_PERSONAS_FINAS = ACCIONES_PERMISO_PERSONAS.filter(
   (a): a is 'contrasena' | 'cambiarrol' | 'activar' => !(ACCIONES_PERMISO as readonly string[]).includes(a),
)

function accionesDeRuta(ruta: string): readonly AccionPermisoPersonas[] {
   return ruta === RUTA_PERMISO_PERSONAS_GESTION ? ACCIONES_PERMISO_PERSONAS : ACCIONES_PERMISO
}

const { data: roles } = await useFetch<Rol[]>('/api/personas/roles')
// 'Administrador' tiene bypass hardcodeado: nunca se guarda como fila de permiso.
const rolesAsignables = computed(() => (roles.value ?? []).filter((r) => r.nombre !== 'Administrador'))
const opcionesRol = computed(() => rolesAsignables.value.map((r) => ({ label: r.nombre, value: r.nombre })))

const rolSeleccionado = ref<string>('')
watch(
   rolesAsignables,
   (lista) => {
      if (!rolSeleccionado.value && lista.length) rolSeleccionado.value = lista[0]!.nombre
   },
   { immediate: true },
)

const { data: permisos, refresh } = await useFetch<Permiso[]>('/api/permisos')

function tienePermiso(ruta: string, accion: AccionPermisoPersonas) {
   return (permisos.value ?? []).some((p) => p.rol === rolSeleccionado.value && p.ruta === ruta && p.accion === accion)
}

function columnaCompleta(accion: AccionPermisoPersonas) {
   return RUTAS_PERMISO.every((ruta) => tienePermiso(ruta, accion))
}

const cambiando = ref<string | null>(null)
const cambiandoColumna = ref<AccionPermisoPersonas | null>(null)
const ocupado = computed(() => cambiando.value !== null || cambiandoColumna.value !== null || !rolSeleccionado.value)

async function aplicarPermiso(ruta: string, accion: AccionPermisoPersonas, activar: boolean) {
   if (activar) {
      await $fetch('/api/permisos', {
         method: 'POST',
         body: { rol: rolSeleccionado.value, ruta, accion },
      })
   } else {
      const fila = (permisos.value ?? []).find(
         (p) => p.rol === rolSeleccionado.value && p.ruta === ruta && p.accion === accion
      )
      if (fila) await $fetch(`/api/permisos/${fila.id}`, { method: 'DELETE' })
   }
}

// Al desactivar 'ver' para una ruta, se desactivan las demás acciones de esa ruta
// (incluidas las finas de /personas/gestion).
async function aplicarPermisoConCascada(ruta: string, accion: AccionPermisoPersonas, activar: boolean) {
   await aplicarPermiso(ruta, accion, activar)
   if (accion === 'ver' && !activar) {
      const otras = accionesDeRuta(ruta).filter((a) => a !== 'ver' && tienePermiso(ruta, a))
      for (const otra of otras) await aplicarPermiso(ruta, otra, false)
   }
}

async function togglePermiso(ruta: string, accion: AccionPermisoPersonas, activar: boolean) {
   const clave = `${ruta}-${accion}`
   cambiando.value = clave
   try {
      await aplicarPermisoConCascada(ruta, accion, activar)
      await refresh()
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'No se pudo actualizar el permiso'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      cambiando.value = null
   }
}

async function toggleColumna(accion: AccionPermisoPersonas) {
   const activar = !columnaCompleta(accion)
   cambiandoColumna.value = accion
   try {
      for (const ruta of RUTAS_PERMISO) {
         if (tienePermiso(ruta, accion) === activar) continue
         await aplicarPermisoConCascada(ruta, accion, activar)
      }
      await refresh()
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'No se pudo actualizar el permiso'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      cambiandoColumna.value = null
   }
}
</script>

<template>
   <div class="space-y-6">
      <div>
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Controla qué puede hacer cada rol en cada sección. El rol Administrador siempre tiene acceso total y
            no aparece aquí.
         </p>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
         <USelect v-model="rolSeleccionado" :items="opcionesRol" value-key="value" class="sm:w-64" />
      </div>

      <div class="overflow-x-auto rounded-2xl border border-default bg-default">
         <table class="w-full border-collapse text-sm">
            <thead>
               <tr>
                  <th
                     class="border-b border-e border-default bg-muted p-3 text-left text-xs font-semibold text-usm-text-muted dark:text-slate-400"
                  >
                     Ruta
                  </th>
                  <th
                     v-for="accion in ACCIONES_PERMISO"
                     :key="accion"
                     class="border-b border-default bg-muted p-3 text-center text-xs font-semibold text-usm-text-muted dark:text-slate-400"
                  >
                     <div class="flex flex-col items-center gap-1">
                        <span>{{ ETIQUETAS_ACCION[accion] }}</span>
                        <UTooltip text="Activar/desactivar todos">
                           <USwitch
                              :model-value="columnaCompleta(accion)"
                              :loading="cambiandoColumna === accion"
                              :disabled="ocupado"
                              size="sm"
                              :aria-label="`Todos: ${ETIQUETAS_ACCION[accion]}`"
                              @update:model-value="() => toggleColumna(accion)"
                           />
                        </UTooltip>
                     </div>
                  </th>
               </tr>
            </thead>
            <tbody>
               <tr v-for="ruta in RUTAS_PERMISO" :key="ruta" class="border-b border-default last:border-b-0">
                  <td class="border-e border-default p-3 font-mono text-xs text-usm-text dark:text-slate-200">
                     {{ ruta }}
                  </td>
                  <td v-for="accion in ACCIONES_PERMISO" :key="accion" class="p-3 text-center">
                     <USwitch
                        :model-value="tienePermiso(ruta, accion)"
                        :loading="cambiando === `${ruta}-${accion}`"
                        :disabled="ocupado"
                        @update:model-value="(val: boolean) => togglePermiso(ruta, accion, val)"
                     />
                  </td>
               </tr>
            </tbody>
         </table>
      </div>

      <!-- Acciones finas de /personas/gestion: además de ver/crear/editar/borrar, separa
           contraseña, rol y activar/bloquear porque gestionan la cuenta de acceso. -->
      <div>
         <h3 class="text-sm font-semibold text-usm-text dark:text-white">Acciones de cuenta en /personas/gestion</h3>
         <p class="text-sm text-usm-text-muted dark:text-slate-400">
            Cambiar contraseña, cambiar rol y activar/bloquear son acciones independientes de 'Editar'.
         </p>
      </div>
      <div class="overflow-x-auto rounded-2xl border border-default bg-default">
         <table class="w-full border-collapse text-sm">
            <thead>
               <tr>
                  <th
                     class="border-b border-e border-default bg-muted p-3 text-left text-xs font-semibold text-usm-text-muted dark:text-slate-400"
                  >
                     Ruta
                  </th>
                  <th
                     v-for="accion in ACCIONES_PERSONAS_FINAS"
                     :key="accion"
                     class="border-b border-default bg-muted p-3 text-center text-xs font-semibold text-usm-text-muted dark:text-slate-400"
                  >
                     {{ ETIQUETAS_ACCION[accion] }}
                  </th>
               </tr>
            </thead>
            <tbody>
               <tr class="border-b border-default last:border-b-0">
                  <td class="border-e border-default p-3 font-mono text-xs text-usm-text dark:text-slate-200">
                     {{ RUTA_PERMISO_PERSONAS_GESTION }}
                  </td>
                  <td v-for="accion in ACCIONES_PERSONAS_FINAS" :key="accion" class="p-3 text-center">
                     <USwitch
                        :model-value="tienePermiso(RUTA_PERMISO_PERSONAS_GESTION, accion)"
                        :loading="cambiando === `${RUTA_PERMISO_PERSONAS_GESTION}-${accion}`"
                        :disabled="ocupado"
                        @update:model-value="(val: boolean) => togglePermiso(RUTA_PERMISO_PERSONAS_GESTION, accion, val)"
                     />
                  </td>
               </tr>
            </tbody>
         </table>
      </div>
   </div>
</template>
