// Stream SSE con los cambios del horario: mientras varios usuarios editan a la vez, cada
// uno recibe un aviso apenas otro crea, mueve, reasigna o borra una sesión, y refresca sus
// datos sin recargar la página (así aparecen también los topes que el cambio ajeno genere).
//
// Es un GET que no muta nada: solo abre el stream. La respuesta no lleva datos del horario,
// únicamente el aviso de que algo cambió (ver `server/utils/horarioEventos.ts`).
const LATIDO_MS = 25_000

export default defineEventHandler(async (event) => {
   // El stream sirve a la matriz de clases y a las reservas de sala: alcanza con poder ver
   // cualquiera de las dos páginas.
   await requiereAlgunPermiso(event, [
      ['/horario', 'ver'],
      ['/reservas/horario', 'ver'],
   ])

   const stream = createEventStream(event)

   const desuscribir = suscribirHorario((evento) => {
      void stream.push({ event: 'horario', data: JSON.stringify(evento) })
   })

   // Comentario periódico para que un proxy intermedio no corte la conexión por inactividad.
   const latido = setInterval(() => {
      void stream.push({ event: 'latido', data: String(Date.now()) })
   }, LATIDO_MS)

   stream.onClosed(() => {
      clearInterval(latido)
      desuscribir()
   })

   return stream.send()
})
