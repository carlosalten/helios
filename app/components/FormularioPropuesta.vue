<script setup lang="ts">
import type { CatalogosPropuesta, ModalidadPropuesta, TtPropuestaConEstado } from '~/types/titulaciones'
import { MODALIDADES_PROPUESTA } from '~/types/titulaciones'

// Compartido entre /estudiante/propuestas (crear, POST) y /estudiante/propuestas/[id] (editar,
// PATCH — solo disponible con la propuesta en "Antecedentes solicitados"). `propuesta` presente
// = modo edición: precarga sus datos y manda el PATCH a ese id en vez de crear una nueva.
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
   catalogos: CatalogosPropuesta | null | undefined
   propuesta?: TtPropuestaConEstado | null
}>()

const emit = defineEmits<{ guardado: [] }>()

const itemsModalidad = MODALIDADES_PROPUESTA.map((m) => ({ label: m, value: m }))
const itemsRol = computed(() => (props.catalogos?.roles ?? []).map((r) => ({ label: r.nombre, value: r.id })))
const itemsLinea = computed(() =>
   (props.catalogos?.lineasInvestigacion ?? []).map((l) => ({ label: l.nombre, value: l.id }))
)

function formularioVacio() {
   const p = props.propuesta
   return {
      titulo: p?.titulo ?? '',
      modalidad: (p?.modalidad as ModalidadPropuesta | undefined) ?? ('Tesina Feria de Software' as ModalidadPropuesta),
      descripcion: p?.descripcion ?? '',
      invMotivacion: p?.invMotivacion ?? '',
      invExperiencia: p?.invExperiencia ?? '',
      claProblema: p?.claProblema ?? '',
      claObjetivo: p?.claObjetivo ?? '',
      rolId: p?.rolId ?? props.catalogos?.roles[0]?.id ?? 0,
      lineaInvestigacionId: p?.lineaInvestigacionId ?? props.catalogos?.lineasInvestigacion[0]?.id ?? 0,
   }
}

const form = reactive(formularioVacio())
const enviando = ref(false)
const errorEnviar = ref<string | null>(null)

// Snapshot del formulario al abrir, para detectar si el estudiante realmente modificó algo antes
// de habilitar "Enviar cambios" (no tiene sentido volver a enviar la misma propuesta sin cambios).
let formInicial = JSON.stringify(form)

// Al abrir (crear o editar otra propuesta distinta), repone el formulario con los valores que
// correspondan — mismo criterio que `abrirCrear`/`abrirEditar` en el resto de la app, pero acá
// no hay una función "abrir" propia porque el trigger vive en la página, no en el componente.
watch(open, (val) => {
   if (!val) return
   Object.assign(form, formularioVacio())
   formInicial = JSON.stringify(form)
   errorEnviar.value = null
})

const hayCambiosFormulario = computed(() => JSON.stringify(form) !== formInicial)

const esInvestigacion = computed(() => form.modalidad === 'Investigación')
const esProyectoPropio = computed(() => form.modalidad === 'Proyecto Propio')
const esTesina = computed(() => form.modalidad === 'Tesina Feria de Software')

const puedeEnviar = computed(() => {
   if (enviando.value) return false
   if (props.propuesta && !hayCambiosFormulario.value) return false
   if (!form.titulo.trim() || !form.modalidad || !form.descripcion.trim()) return false
   if (
      esInvestigacion.value &&
      (!form.invMotivacion.trim() || !form.invExperiencia.trim() || !form.lineaInvestigacionId)
   )
      return false
   if (esProyectoPropio.value && (!form.claProblema.trim() || !form.claObjetivo.trim())) return false
   if (esTesina.value && !form.rolId) return false
   return true
})

// Al crear (no al editar) se pide confirmación aparte: el estudiante solo puede tener una
// propuesta activa a la vez, así que conviene que sepa de antemano que no podrá ingresar otra
// mientras esta esté en evaluación.
const confirmarEnvioMostrar = ref(false)
function onSubmit() {
   if (!puedeEnviar.value) return
   if (!props.propuesta) {
      confirmarEnvioMostrar.value = true
      return
   }
   enviar()
}

async function enviar() {
   if (!puedeEnviar.value) return
   confirmarEnvioMostrar.value = false
   enviando.value = true
   errorEnviar.value = null
   try {
      const url = props.propuesta ? `/api/estudiante/propuestas/${props.propuesta.id}` : '/api/estudiante/propuestas'
      const method = props.propuesta ? 'PATCH' : 'POST'
      await $fetch(url, {
         method,
         body: {
            titulo: form.titulo,
            modalidad: form.modalidad,
            descripcion: form.descripcion,
            invMotivacion: esInvestigacion.value ? form.invMotivacion : undefined,
            invExperiencia: esInvestigacion.value ? form.invExperiencia : undefined,
            claProblema: esProyectoPropio.value ? form.claProblema : undefined,
            claObjetivo: esProyectoPropio.value ? form.claObjetivo : undefined,
            rolId: esTesina.value ? Number(form.rolId) : undefined,
            lineaInvestigacionId: esInvestigacion.value ? Number(form.lineaInvestigacionId) : undefined,
         },
      })
      open.value = false
      emit('guardado')
   } catch (e: unknown) {
      errorEnviar.value = (e as { data?: { message?: string } }).data?.message ?? 'No se pudo guardar la propuesta'
   } finally {
      enviando.value = false
   }
}
</script>

<template>
   <UModal
      v-model:open="open"
      :title="propuesta ? 'Editar propuesta' : 'Nueva propuesta'"
      :ui="{ footer: 'justify-end', content: 'max-w-2xl' }"
   >
      <template #body>
         <p class="mb-4 text-sm text-usm-blue">
            <template v-if="propuesta">
               Modifica los datos que la jefatura te pidió precisar y vuelve a enviarla — quedará de nuevo en estado
               pendiente de revisión.
            </template>
            <template v-else>
               Completa los datos solicitados para registrar tu postulación de tema. Una vez enviado, la solicitud queda
               en estado pendiente de revisión por la jefatura de carrera.
            </template>
         </p>
         <UForm id="form-propuesta" :state="form" class="space-y-4" @submit="onSubmit">
            <UFormField
               label="Título"
               name="titulo"
               description="Enunciado con el que quedará registrado el tema en el acta de inscripción"
               help="Debe ser específico y enunciar el objeto del trabajo."
               :ui="{ description: 'text-[13px]', help: 'text-xs' }"
            >
               <UInput v-model="form.titulo" class="w-full" />
            </UFormField>

            <UFormField
               label="Modalidad"
               name="modalidad"
               :description="
                  propuesta
                     ? 'La modalidad no se puede cambiar una vez ingresada la propuesta.'
                     : 'Campo obligatorio. La ruta determina qué antecedentes se solicitan a continuación.'
               "
               :ui="{ description: 'text-[13px]' }"
            >
               <USelectMenu
                  v-model="form.modalidad"
                  :items="itemsModalidad"
                  value-key="value"
                  :disabled="!!propuesta"
                  class="w-full"
               />
            </UFormField>

            <UFormField v-if="esInvestigacion" label="Línea de investigación" name="lineaInvestigacionId">
               <UAlert
                  v-if="!itemsLinea.length"
                  icon="i-lucide-alert-triangle"
                  color="warning"
                  variant="subtle"
                  description="Todavía no hay líneas de investigación configuradas. Contacta a un administrador."
               />
               <USelectMenu
                  v-else
                  v-model="form.lineaInvestigacionId"
                  :items="itemsLinea"
                  value-key="value"
                  class="w-full"
               />
            </UFormField>

            <UFormField v-if="esTesina" label="Rol" name="rolId">
               <UAlert
                  v-if="!itemsRol.length"
                  icon="i-lucide-alert-triangle"
                  color="warning"
                  variant="subtle"
                  description="Todavía no hay roles configurados. Contacta a un administrador."
               />
               <USelectMenu v-else v-model="form.rolId" :items="itemsRol" value-key="value" class="w-full" />
            </UFormField>

            <UFormField label="Descripción" name="descripcion" :help="`${form.descripcion.length}/3000`">
               <UTextarea v-model="form.descripcion" :rows="4" maxlength="3000" class="w-full" />
            </UFormField>

            <template v-if="esInvestigacion">
               <UFormField label="Motivación" name="invMotivacion" :help="`${form.invMotivacion.length}/3000`">
                  <UTextarea v-model="form.invMotivacion" :rows="3" maxlength="3000" class="w-full" />
               </UFormField>
               <UFormField label="Experiencia" name="invExperiencia" :help="`${form.invExperiencia.length}/3000`">
                  <UTextarea v-model="form.invExperiencia" :rows="3" maxlength="3000" class="w-full" />
               </UFormField>
            </template>

            <template v-if="esProyectoPropio">
               <UFormField label="Problema" name="claProblema" :help="`${form.claProblema.length}/3000`">
                  <UTextarea v-model="form.claProblema" :rows="3" maxlength="3000" class="w-full" />
               </UFormField>
               <UFormField label="Objetivo" name="claObjetivo" :help="`${form.claObjetivo.length}/3000`">
                  <UTextarea v-model="form.claObjetivo" :rows="3" maxlength="3000" class="w-full" />
               </UFormField>
            </template>

            <UAlert
               v-if="errorEnviar"
               icon="i-lucide-alert-circle"
               color="error"
               variant="subtle"
               :description="errorEnviar"
            />
         </UForm>
      </template>
      <template #footer>
         <UButton
            variant="ghost"
            color="neutral"
            @click="
               () => {
                  open = false
               }
            "
            >Cancelar</UButton
         >
         <UButton type="submit" form="form-propuesta" :loading="enviando" :disabled="!puedeEnviar">
            {{ propuesta ? 'Enviar cambios' : 'Enviar propuesta' }}
         </UButton>
      </template>
   </UModal>

   <ConfirmModal
      v-model:open="confirmarEnvioMostrar"
      title="¿Confirmar envío de la propuesta?"
      confirm-label="Enviar propuesta"
      :loading="enviando"
      @confirm="enviar"
   >
      <p class="text-sm text-usm-text dark:text-slate-200">
         Ten en cuenta que solo puedes tener una propuesta activa a la vez. Una vez enviada, no podrás ingresar otra
         propuesta a menos que la actual sea rechazada durante la evaluación.
      </p>
   </ConfirmModal>
</template>
