<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TipoReserva } from '~/types/reserva'
import { COLORES_RESERVA } from '~/types/reserva'

const toast = useToast()

const { data: tipos, status, refresh } = await useFetch<TipoReserva[]>('/api/reservas/tipos')

const { puedeCrear, puedeEditar, puedeBorrar } = usePermiso('/reservas/tipos')

const { paginaActual, itemsPagina: tiposPagina, porPagina } = usePaginacion(computed(() => tipos.value ?? []))

const columnas: TableColumn<TipoReserva>[] = [
   { accessorKey: 'nombre', header: 'Nombre' },
   { id: 'color', header: 'Color', size: 140 },
   { id: 'publicaPorDefecto', header: 'Pública por defecto', size: 160 },
   { id: 'acciones', header: '', size: 80 },
]

function nombreColor(hex: string) {
   return COLORES_RESERVA.find((c) => c.hex === hex)?.nombre ?? hex
}

/* ── Crear ───────────────────────────────────────────────── */
const modalCrearMostrar = ref(false)
const formCrear = reactive({ nombre: '', color: COLORES_RESERVA[0].hex as string, publicaPorDefecto: true })
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

function abrirCrear() {
   formCrear.nombre = ''
   formCrear.color = COLORES_RESERVA[0].hex
   formCrear.publicaPorDefecto = true
   errorGuardar.value = null
   modalCrearMostrar.value = true
}

async function guardar() {
   guardando.value = true
   errorGuardar.value = null
   try {
      await $fetch('/api/reservas/tipos', {
         method: 'POST',
         body: { nombre: formCrear.nombre, color: formCrear.color, publicaPorDefecto: formCrear.publicaPorDefecto },
      })
      modalCrearMostrar.value = false
      await refresh()
      toast.add({ title: 'Tipo de reserva agregado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorGuardar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Editar ──────────────────────────────────────────────── */
const modalEditarMostrar = ref(false)
const tipoEditar = ref<TipoReserva | null>(null)
const formEditar = reactive({ nombre: '', color: COLORES_RESERVA[0].hex as string, publicaPorDefecto: true })
const errorEditar = ref<string | null>(null)

function abrirEditar(tipo: TipoReserva) {
   tipoEditar.value = tipo
   formEditar.nombre = tipo.nombre
   formEditar.color = tipo.color
   formEditar.publicaPorDefecto = tipo.publicaPorDefecto
   errorEditar.value = null
   modalEditarMostrar.value = true
}

async function guardarEditar() {
   if (!tipoEditar.value) return
   guardando.value = true
   errorEditar.value = null
   try {
      const url: string = `/api/reservas/tipos/${tipoEditar.value.id}`
      await $fetch(url, {
         method: 'PATCH',
         body: { nombre: formEditar.nombre, color: formEditar.color, publicaPorDefecto: formEditar.publicaPorDefecto },
      })
      modalEditarMostrar.value = false
      await refresh()
      toast.add({ title: 'Tipo actualizado', color: 'success', icon: 'i-lucide-check-circle' })
   } catch (e: unknown) {
      errorEditar.value = (e as { data?: { message?: string } }).data?.message ?? 'Error al guardar'
   } finally {
      guardando.value = false
   }
}

/* ── Eliminar ────────────────────────────────────────────── */
const confirmEliminarMostrar = ref(false)
const tipoAEliminar = ref<TipoReserva | null>(null)
const eliminando = ref(false)

function abrirConfirmEliminar(tipo: TipoReserva) {
   tipoAEliminar.value = tipo
   confirmEliminarMostrar.value = true
}

async function confirmarEliminar() {
   if (!tipoAEliminar.value) return
   eliminando.value = true
   try {
      const url: string = `/api/reservas/tipos/${tipoAEliminar.value.id}`
      await $fetch(url, { method: 'DELETE' })
      confirmEliminarMostrar.value = false
      await refresh()
      toast.add({ title: 'Tipo eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <div>
            <p class="text-sm text-usm-text-muted dark:text-slate-400">
               Categorías para clasificar las reservas de sala
            </p>
         </div>
         <UButton icon="i-lucide-plus" class="sm:shrink-0" :disabled="!puedeCrear" @click="abrirCrear">
            Nuevo tipo
         </UButton>
      </div>

      <TableSkeleton v-if="status === 'pending'" :rows="5" />

      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
         <EmptyState
            v-if="!tipos?.length"
            icon="i-lucide-calendar"
            message="No hay tipos de reserva registrados"
            :action="puedeCrear ? 'Nuevo tipo' : undefined"
            @action="abrirCrear"
         />
         <UTable v-else :data="tiposPagina" :columns="columnas">
            <template #color-cell="{ row }">
               <div class="flex items-center gap-2">
                  <span
                     class="size-3.5 shrink-0 rounded-full border border-default"
                     :style="{ backgroundColor: row.original.color }"
                  />
                  <span class="text-sm text-usm-text dark:text-white">{{ nombreColor(row.original.color) }}</span>
               </div>
            </template>
            <template #publicaPorDefecto-cell="{ row }">
               <UBadge v-if="row.original.publicaPorDefecto" color="success" variant="subtle" size="sm">Sí</UBadge>
               <UBadge v-else color="neutral" variant="subtle" size="sm">No</UBadge>
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

      <div v-if="(tipos?.length ?? 0) > porPagina" class="flex justify-center">
         <UPagination v-model:page="paginaActual" :total="tipos?.length ?? 0" :items-per-page="porPagina" />
      </div>

      <!-- Modal crear -->
      <UModal v-model:open="modalCrearMostrar" title="Nuevo tipo de reserva" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-tipo-reserva-crear" :state="formCrear" class="space-y-4" @submit="guardar">
               <UFormField label="Nombre" name="nombre" :error="errorGuardar ?? undefined">
                  <UInput v-model="formCrear.nombre" placeholder="Clase, Reunión, Evento…" class="w-full" />
               </UFormField>
               <UFormField label="Color" name="color">
                  <div class="flex flex-wrap gap-2">
                     <button
                        v-for="c in COLORES_RESERVA"
                        :key="c.hex"
                        type="button"
                        class="size-7 rounded-full border-2 transition-transform"
                        :class="
                           formCrear.color === c.hex
                              ? 'scale-110 border-usm-text dark:border-white'
                              : 'border-transparent hover:scale-110'
                        "
                        :style="{ backgroundColor: c.hex }"
                        :aria-label="c.nombre"
                        :title="c.nombre"
                        @click="formCrear.color = c.hex"
                     />
                  </div>
               </UFormField>
               <USwitch
                  v-model="formCrear.publicaPorDefecto"
                  label="Pública por defecto"
                  description="Valor inicial de 'Reserva pública' al crear una reserva de este tipo (vista impresa y pantalla pública)."
               />
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
            <UButton type="submit" form="form-tipo-reserva-crear" :loading="guardando">Guardar</UButton>
         </template>
      </UModal>

      <!-- Modal editar -->
      <UModal v-model:open="modalEditarMostrar" title="Editar tipo de reserva" :ui="{ footer: 'justify-end' }">
         <template #body>
            <UForm id="form-tipo-reserva-editar" :state="formEditar" class="space-y-4" @submit="guardarEditar">
               <UFormField label="Nombre" name="nombre" :error="errorEditar ?? undefined">
                  <UInput v-model="formEditar.nombre" placeholder="Clase, Reunión, Evento…" class="w-full" />
               </UFormField>
               <UFormField label="Color" name="color">
                  <div class="flex flex-wrap gap-2">
                     <button
                        v-for="c in COLORES_RESERVA"
                        :key="c.hex"
                        type="button"
                        class="size-7 rounded-full border-2 transition-transform"
                        :class="
                           formEditar.color === c.hex
                              ? 'scale-110 border-usm-text dark:border-white'
                              : 'border-transparent hover:scale-110'
                        "
                        :style="{ backgroundColor: c.hex }"
                        :aria-label="c.nombre"
                        :title="c.nombre"
                        @click="formEditar.color = c.hex"
                     />
                  </div>
               </UFormField>
               <USwitch
                  v-model="formEditar.publicaPorDefecto"
                  label="Pública por defecto"
                  description="Valor inicial de 'Reserva pública' al crear una reserva de este tipo (vista impresa y pantalla pública)."
               />
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
            <UButton type="submit" form="form-tipo-reserva-editar" :loading="guardando">Guardar cambios</UButton>
         </template>
      </UModal>

      <!-- Confirmar eliminación -->
      <ConfirmModal
         v-model:open="confirmEliminarMostrar"
         title="Eliminar tipo de reserva"
         confirm-label="Eliminar"
         confirm-icon="i-lucide-trash-2"
         confirm-color="error"
         :loading="eliminando"
         @confirm="confirmarEliminar"
      >
         <p class="text-sm text-usm-text dark:text-slate-200">
            ¿Eliminar el tipo
            <span class="font-semibold">{{ tipoAEliminar?.nombre }}</span
            >? Solo es posible si no hay reservas con este tipo asignado.
         </p>
      </ConfirmModal>
   </div>
</template>
