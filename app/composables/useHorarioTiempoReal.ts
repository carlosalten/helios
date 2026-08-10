import type { EventoHorario } from '~/types/horarioEvento'

// Suscribe la página al stream SSE `/api/horario/eventos` y llama a `alCambiar` cuando
// alguien modifica el horario, para que quienes lo estén editando vean los cambios (y los
// topes que generen) sin recargar. `EventSource` reconecta solo si se cae la conexión.
//
// Los eventos llegan agrupados: una sola acción del usuario puede disparar varias
// mutaciones (p. ej. asignar un profesor a todas las sesiones de un paralelo hace un PATCH
// por sesión), y no tiene sentido refrescar una vez por cada una.
const ESPERA_AGRUPACION_MS = 300

// `ruta` es la página que se suscribe: el stream exige poder verla (ver
// server/api/horario/eventos.get.ts). Sin permiso la conexión respondería 401 y `EventSource`
// reintentaría en bucle, así que ni se abre: la página se queda sin avisos en vivo, pero sigue
// funcionando.
export function useHorarioTiempoReal(alCambiar: (eventos: EventoHorario[]) => void, ruta = '/horario') {
   const { puedeVer } = usePermiso(ruta)
   const conectado = ref(false)

   let fuente: EventSource | null = null
   let temporizador: ReturnType<typeof setTimeout> | null = null
   let pendientes: EventoHorario[] = []

   function agrupar(evento: EventoHorario) {
      pendientes.push(evento)
      if (temporizador) clearTimeout(temporizador)
      temporizador = setTimeout(() => {
         const lote = pendientes
         pendientes = []
         temporizador = null
         alCambiar(lote)
      }, ESPERA_AGRUPACION_MS)
   }

   function cerrar() {
      if (temporizador) {
         clearTimeout(temporizador)
         temporizador = null
      }
      fuente?.close()
      fuente = null
      conectado.value = false
   }

   onMounted(() => {
      if (!puedeVer.value) return

      fuente = new EventSource('/api/horario/eventos')

      fuente.addEventListener('open', () => {
         conectado.value = true
      })
      // EventSource reintenta solo; el indicador vuelve a 'true' en el próximo 'open'.
      fuente.addEventListener('error', () => {
         conectado.value = false
      })
      fuente.addEventListener('horario', (e) => {
         try {
            agrupar(JSON.parse((e as MessageEvent).data) as EventoHorario)
         } catch {
            // Un mensaje corrupto no debe romper el stream: se ignora y se sigue escuchando.
         }
      })
   })

   onScopeDispose(cerrar)

   return { conectado }
}
