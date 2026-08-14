<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { z } from 'zod'
import type { JornadaLaboral, Persona, Rol } from '~/types/persona'
import { JORNADAS_LABORALES } from '~/types/persona'

const toast = useToast()
const { user } = useUserSession()

const [{ data: personas, status, refresh }, { data: roles }] = await Promise.all([
   useFetch<Persona[]>('/api/personas'),
   useFetch<Rol[]>('/api/personas/roles'),
])

/* ── Permisos por acción (además del 'ver' que ya exige la página) ─ */
const { puedeCrear, puedeEditar, puedeBorrar, tienePermiso } = usePermiso('/personas/gestion')
const puedeCambiarContrasena = computed(() => tienePermiso('contrasena'))
const puedeCambiarRol = computed(() => tienePermiso('cambiarrol'))
const puedeActivar = computed(() => tienePermiso('activar'))

// Solo se pueden asignar roles de jerarquía igual o menor a la propia (ver Rol.jerarquia y el
// mismo chequeo en server/api/personas/index.post.ts y server/api/personas/[id]/rol.patch.ts).
// Administrador tiene bypass total, sin importar su jerarquiaRol.
const rolesAsignables = computed(() => {
   if (user.value?.rol === 'Administrador') return roles.value ?? []
   const miJerarquia = user.value?.jerarquiaRol ?? 0
   return (roles.value ?? []).filter((r) => r.jerarquia <= miJerarquia)
})
const opcionesRolAsignable = computed(() => rolesAsignables.value.map((r) => ({ label: r.nombre, value: r.id })))

const filtroRol = ref<number | '__todos__'>('__todos__')
const busqueda = ref('')

const personasFiltradas = computed(() => {
   let lista = personas.value ?? []
   if (filtroRol.value !== '__todos__') {
      lista = lista.filter((p) => p.rolId === filtroRol.value)
   }
   if (busqueda.value.trim()) {
      const q = normalizarTexto(busqueda.value)
      lista = lista.filter(
         (p) =>
            normalizarTexto(p.nombre).includes(q) ||
            normalizarTexto(p.apellido).includes(q) ||
            normalizarTexto(p.email).includes(q)
      )
   }
   return lista
})

const { paginaActual, itemsPagina: personasPagina, porPagina } = usePaginacion(personasFiltradas)

const opcionesRol = computed(() => [
   { label: 'Todos los roles', value: '__todos__' as const },
   ...(roles.value ?? []).map((r) => ({ label: r.nombre, value: r.id })),
])

const columnas: TableColumn<Persona>[] = [
   { id: 'persona', header: 'Persona' },
   { id: 'rol', header: 'Rol' },
   { id: 'jornada', header: 'Jornada', size: 130 },
   { id: 'estado', header: 'Estado', size: 100 },
   { id: 'acceso', header: 'Acceso', size: 100 },
   { id: 'acciones', header: '', size: 160 },
]

function labelJornadaLaboral(jornada: JornadaLaboral) {
   return JORNADAS_LABORALES.find((j) => j.valor === jornada)?.label ?? jornada
}

const opcionesJornadaLaboral = [
   { label: 'Sin especificar', value: '__sin_definir__' as const },
   ...JORNADAS_LABORALES.map((j) => ({ label: j.label, value: j.valor })),
]

const guardando = ref(false)

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({
   email: '',
   nombre: '',
   apellido: '',
   rolId: 0,
   jornadaLaboral: '__sin_definir__' as JornadaLaboral | '__sin_definir__',
   emoji: '',
})
const errorGuardar = ref<string | null>(null)

const formCrearEsProfesor = computed(() => roles.value?.find((r) => r.id === formCrear.rolId)?.nombre === 'Profesor')

watch(
   () => formCrear.rolId,
   () => {
      formCrear.jornadaLaboral = formCrearEsProfesor.value ? 'PARCIAL' : '__sin_definir__'
   }
)

function abrirCrear() {
   formCrear.email = ''
   formCrear.nombre = ''
   formCrear.apellido = ''
   const rolProfesor = rolesAsignables.value.find((r) => r.nombre === 'Profesor')
   formCrear.rolId = rolProfesor?.id ?? rolesAsignables.value[0]?.id ?? 0
   formCrear.emoji = ''
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/personas', {
         method: 'POST',
         body: {
            ...formCrear,
            rolId: Number(formCrear.rolId),
            jornadaLaboral: formCrear.jornadaLaboral === '__sin_definir__' ? null : formCrear.jornadaLaboral,
         },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Persona agregada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar (nombre/apellido) ───────────────────────────────── */
const modalEditarMostrar = ref(false)
const personaEditar = ref<Persona | null>(null)
const formEditar = reactive({
   nombre: '',
   apellido: '',
   jornadaLaboral: '__sin_definir__' as JornadaLaboral | '__sin_definir__',
   emoji: '',
})
const errorEditar = ref<string | null>(null)

function abrirEditar(persona: Persona) {
   personaEditar.value = persona
   formEditar.nombre = persona.nombre
   formEditar.apellido = persona.apellido
   formEditar.jornadaLaboral = persona.jornadaLaboral ?? '__sin_definir__'
   formEditar.emoji = persona.emoji ?? ''
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!personaEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/personas/${personaEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: {
            ...formEditar,
            jornadaLaboral: formEditar.jornadaLaboral === '__sin_definir__' ? null : formEditar.jornadaLaboral,
         },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Persona actualizada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Cambiar rol ─────────────────────────────────────────── */
const modalCambiarRolMostrar = ref(false)
const personaCambiarRol = ref<Persona | null>(null)
const formCambiarRol = reactive({ rolId: 0 })
const errorCambiarRol = ref<string | null>(null)

function abrirCambiarRol(persona: Persona) {
   personaCambiarRol.value = persona
   formCambiarRol.rolId = persona.rolId
   errorCambiarRol.value = null
   modalCambiarRolMostrar.value = true
}

// Igual que rolesAsignables, pero siempre incluye el rol actual de la persona (aunque supere
// la jerarquía propia) para que el selector no quede sin label — dejarlo tal cual nunca se
// bloquea (ver el chequeo en server/api/personas/[id]/rol.patch.ts).
const opcionesCambiarRol = computed(() => {
   const asignables = rolesAsignables.value
   const actual = personaCambiarRol.value?.rol
   const lista = actual && !asignables.some((r) => r.id === actual.id) ? [...asignables, actual] : asignables
   return lista.map((r) => ({ label: r.nombre, value: r.id }))
})

async function cambiarRol() {
   if (!personaCambiarRol.value) return
   guardando.value = true
   errorCambiarRol.value = null
   try {
      const url: string = `/api/personas/${personaCambiarRol.value.id}/rol`
      await $fetch(url, { method: 'PATCH', body: { rolId: Number(formCambiarRol.rolId) } })
      modalCambiarRolMostrar.value = false
      await refresh()
      toast.add({ title: 'Rol actualizado', color: 'info', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorCambiarRol.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al cambiar rol'
   } finally {
      guardando.value = false
   }
}

/* ── Contraseña (asignar/cambiar) ───────────────────────────── */
const passwordSchema = z
   .string({ error: 'La contraseña es requerida' })
   .min(8, 'Mínimo 8 caracteres')
   .regex(/\d/, 'Debe contener al menos un número')
   .regex(/[a-z]/, 'Debe contener al menos una minúscula')
   .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')

const schemaContrasena = z
   .object({
      nueva: passwordSchema,
      confirmar: z.string({ error: 'Repite la contraseña' }),
   })
   .refine((d) => d.nueva === d.confirmar, { message: 'Las contraseñas no coinciden', path: ['confirmar'] })

const modalContrasenaMostrar = ref(false)
const personaContrasena = ref<Persona | null>(null)
const formContrasena = reactive({ nueva: '', confirmar: '' })

function abrirCambiarContrasena(persona: Persona) {
   personaContrasena.value = persona
   Object.assign(formContrasena, { nueva: '', confirmar: '' })
   modalContrasenaMostrar.value = true
}

async function cambiarContrasena() {
   if (!personaContrasena.value) return
   guardando.value = true
   try {
      const url: string = `/api/personas/${personaContrasena.value.id}/password`
      await $fetch(url, { method: 'PATCH', body: { password: formContrasena.nueva } })
      modalContrasenaMostrar.value = false
      await refresh()
      toast.add({ title: 'Contraseña actualizada', color: 'warning', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const msg = (e as { data?: { message?: string } }).data?.message ?? 'Ocurrió un error'
      toast.add({ title: 'Error', description: msg, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      guardando.value = false
   }
}

/* ── Activar / Desactivar ────────────────────────────────── */
const toggling = ref<number | null>(null)

async function toggleActivo(persona: Persona) {
   if (toggling.value) return
   toggling.value = persona.id
   try {
      const url: string = `/api/personas/${persona.id}/activar`
      await $fetch(url, { method: 'PATCH' })
      await refresh()
      toast.add({
         title: persona.activo ? 'Persona bloqueada' : 'Persona activada',
         color: 'success',
         icon: 'i-lucide-check-circle',
      })
   } catch {
      toast.add({ title: 'Error al cambiar estado', color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      toggling.value = null
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const personaAEliminar = ref<Persona | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(persona: Persona) {
   personaAEliminar.value = persona
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!personaAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/personas/${personaAEliminar.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Persona eliminada', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      const mensaje = (e as { data?: { message?: string } }).data?.message ?? 'Error al eliminar'
      toast.add({ title: mensaje, color: 'error', icon: 'i-lucide-alert-circle' })
   } finally {
      eliminando.value = false
   }
}
</script>

<template>
   <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <div>
            <p class="text-sm text-usm-text-muted dark:text-slate-400">
               Personas registradas en el departamento, con o sin acceso al sistema
            </p>
         </div>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nueva persona
         </UButton>
      </div>

      <!-- Filtros -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
         <UInput v-model="busqueda" icon="i-lucide-search" placeholder="Buscar por nombre o email…" class="sm:w-72" />
         <USelect v-model="filtroRol" :items="opcionesRol" value-key="value" class="sm:w-52" />
         <span class="text-sm text-usm-text-muted dark:text-slate-400">
            {{ personasFiltradas.length }} persona{{ personasFiltradas.length !== 1 ? 's' : '' }}
         </span>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="6" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!personasFiltradas.length"
            icon="i-lucide-user-round"
            message="No hay personas registradas"
            :action="filtroRol === '__todos__' && !busqueda && puedeCrear ? 'Nueva persona' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="personasPagina" :columns="columnas">
            <template #persona-cell="{ row }">
               <div>
                  <p class="font-medium text-usm-text dark:text-white">
                     {{ row.original.nombre }} {{ row.original.apellido }}
                  </p>
                  <p class="text-xs text-usm-text-muted dark:text-slate-400">{{ row.original.email }}</p>
               </div>
            </template>
            <template #rol-cell="{ row }">
               <UBadge v-if="row.original.rol" variant="subtle" color="neutral">
                  {{ row.original.rol.nombre }}
               </UBadge>
            </template>
            <template #jornada-cell="{ row }">
               <UBadge v-if="row.original.jornadaLaboral" variant="subtle" color="info">
                  {{ labelJornadaLaboral(row.original.jornadaLaboral) }}
               </UBadge>
               <span v-else class="text-sm text-usm-text-muted dark:text-slate-400">—</span>
            </template>
            <template #estado-cell="{ row }">
               <UBadge :color="row.original.activo ? 'success' : 'neutral'" variant="subtle">
                  {{ row.original.activo ? 'Activo' : 'Bloqueado' }}
               </UBadge>
            </template>
            <template #acceso-cell="{ row }">
               <UBadge :color="row.original.tieneContrasena ? 'info' : 'neutral'" variant="subtle">
                  {{ row.original.tieneContrasena ? 'Con acceso' : 'Sin acceso' }}
               </UBadge>
            </template>
            <template #acciones-cell="{ row }">
               <div class="flex justify-end gap-1">
                  <UTooltip text="Editar">
                     <UButton
                        icon="i-lucide-pen"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        :disabled="!puedeEditar"
                        aria-label="Editar"
                        @click="abrirEditar(row.original)"
                     />
                  </UTooltip>
                  <UTooltip text="Cambiar rol">
                     <UButton
                        icon="i-lucide-shield-user"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        :disabled="!puedeCambiarRol"
                        aria-label="Cambiar rol"
                        @click="abrirCambiarRol(row.original)"
                     />
                  </UTooltip>
                  <UTooltip :text="row.original.tieneContrasena ? 'Cambiar contraseña' : 'Asignar contraseña'">
                     <UButton
                        icon="i-lucide-key-round"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        :disabled="!puedeCambiarContrasena"
                        :aria-label="row.original.tieneContrasena ? 'Cambiar contraseña' : 'Asignar contraseña'"
                        @click="abrirCambiarContrasena(row.original)"
                     />
                  </UTooltip>
                  <UTooltip :text="row.original.activo ? 'Bloquear' : 'Activar'">
                     <UButton
                        :icon="row.original.activo ? 'i-lucide-user-x' : 'i-lucide-user-check'"
                        :color="row.original.activo ? 'warning' : 'success'"
                        variant="ghost"
                        size="xs"
                        :disabled="!puedeActivar"
                        :loading="toggling === row.original.id"
                        :aria-label="row.original.activo ? 'Bloquear' : 'Activar'"
                        @click="toggleActivo(row.original)"
                     />
                  </UTooltip>
                  <UTooltip text="Eliminar">
                     <UButton
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        size="xs"
                        :disabled="!puedeBorrar"
                        aria-label="Eliminar"
                        @click="abrirConfirmEliminar(row.original)"
                     />
                  </UTooltip>
               </div>
            </template>
         </UTable>
      </div>

      <div v-if="personasFiltradas.length > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="personasFiltradas.length" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nueva persona" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-persona-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Email" name="email" :error="errorGuardar ?? undefined">
                  <UInput v-model="formCrear.email" type="email" placeholder="nombre@usm.cl" class="w-full" />
               </UFormField>
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Nombre" name="nombre">
                     <UInput v-model="formCrear.nombre" class="w-full" />
                  </UFormField>
                  <UFormField label="Apellido" name="apellido">
                     <UInput v-model="formCrear.apellido" class="w-full" />
                  </UFormField>
               </div>
               <UFormField label="Rol" name="rolId">
                  <USelect v-model="formCrear.rolId" :items="opcionesRolAsignable" value-key="value" class="w-full" />
               </UFormField>
               <UFormField v-if="formCrearEsProfesor" label="Jornada laboral" name="jornadaLaboral">
                  <USelect
                     v-model="formCrear.jornadaLaboral"
                     :items="opcionesJornadaLaboral"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UFormField
                  label="Emoji"
                  name="emoji"
                  description="Opcional. Un emoji elegido del catálogo Unicode; se muestra sobre las iniciales de la persona en el navbar."
                  :ui="{ description: 'text-[13px]' }"
               >
                  <UInput v-model="formCrear.emoji" placeholder="🦉" class="w-24" />
               </UFormField>
               <p class="text-xs text-usm-text-muted dark:text-slate-400">
                  La persona se crea sin acceso al sistema. Para darle acceso, asígnale una contraseña después.
               </p>
            </UForm>
         </template>
         <template #footer>
            <UButton
               variant="ghost"
               color="neutral"
               @click="
                  () => {
                     modalCrearMostrar = false
                  }
               "
               >Cancelar</UButton
            >
            <UButton type="submit" form="form-persona-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal
         v-model:open="modalEditarMostrar"
         :title="`Editar — ${personaEditar?.nombre} ${personaEditar?.apellido}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm id="form-persona-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Nombre" name="nombre" :error="errorEditar ?? undefined">
                     <UInput v-model="formEditar.nombre" class="w-full" />
                  </UFormField>
                  <UFormField label="Apellido" name="apellido">
                     <UInput v-model="formEditar.apellido" class="w-full" />
                  </UFormField>
               </div>
               <UFormField label="Jornada laboral" name="jornadaLaboral">
                  <USelect
                     v-model="formEditar.jornadaLaboral"
                     :items="opcionesJornadaLaboral"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
               <UFormField
                  label="Emoji"
                  name="emoji"
                  description="Opcional. Un emoji elegido del catálogo Unicode; se muestra sobre las iniciales de la persona en el navbar."
                  :ui="{ description: 'text-[13px]' }"
               >
                  <UInput v-model="formEditar.emoji" placeholder="🦉" class="w-24" />
               </UFormField>
            </UForm>
         </template>
         <template #footer>
            <UButton
               variant="ghost"
               color="neutral"
               @click="
                  () => {
                     modalEditarMostrar = false
                  }
               "
               >Cancelar</UButton
            >
            <UButton type="submit" form="form-persona-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Modal cambiar rol -->
      <UModal
         v-model:open="modalCambiarRolMostrar"
         :title="`Cambiar rol — ${personaCambiarRol?.nombre} ${personaCambiarRol?.apellido}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <form id="form-persona-cambiar-rol" @submit.prevent="cambiarRol">
               <UFormField label="Rol" name="rolId" :error="errorCambiarRol ?? undefined">
                  <USelect
                     v-model="formCambiarRol.rolId"
                     :items="opcionesCambiarRol"
                     value-key="value"
                     class="w-full"
                  />
               </UFormField>
            </form>
         </template>
         <template #footer>
            <UButton
               variant="ghost"
               color="neutral"
               @click="
                  () => {
                     modalCambiarRolMostrar = false
                  }
               "
               >Cancelar</UButton
            >
            <UButton type="submit" form="form-persona-cambiar-rol" icon="i-lucide-shield-half" :loading="guardando">
               Cambiar rol
            </UButton>
         </template>
      </UModal>

      <!-- Modal contraseña -->
      <UModal
         v-model:open="modalContrasenaMostrar"
         :title="personaContrasena?.tieneContrasena ? 'Cambiar contraseña' : 'Asignar contraseña'"
         :description="`${personaContrasena?.nombre} ${personaContrasena?.apellido}`"
         :ui="{ footer: 'justify-end' }"
      >
         <template #body>
            <UForm
               id="form-persona-contrasena"
               :schema="schemaContrasena"
               :state="formContrasena"
               class="space-y-4"
               @submit="cambiarContrasena"
            >
               <UFormField name="nueva" label="Nueva contraseña" required>
                  <UInput v-model="formContrasena.nueva" type="password" placeholder="••••••••" class="w-full" />
               </UFormField>
               <UFormField name="confirmar" label="Confirmar contraseña" required>
                  <UInput v-model="formContrasena.confirmar" type="password" placeholder="••••••••" class="w-full" />
               </UFormField>
            </UForm>
         </template>
         <template #footer>
            <UButton
               type="button"
               color="neutral"
               variant="outline"
               :disabled="guardando"
               @click="
                  () => {
                     modalContrasenaMostrar = false
                  }
               "
               >Cancelar</UButton
            >
            <UButton type="submit" form="form-persona-contrasena" icon="i-lucide-key-round" :loading="guardando">
               Guardar contraseña
            </UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar persona"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar a
            <span class="font-semibold">{{ personaAEliminar?.nombre }} {{ personaAEliminar?.apellido }}</span
            >? Se eliminarán también todas sus reservas.
         </p>
      </ConfirmModal>
   </div>
</template>
