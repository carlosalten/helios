// Stream SSE con los cambios del horario: mientras varios usuarios editan a la vez, cada
// uno recibe un aviso apenas otro crea, mueve, reasigna o borra una sesión, y refresca sus
// datos sin recargar la página (así aparecen también los topes que el cambio ajeno genere).
//
// Es un GET que no muta nada: solo abre el stream. La respuesta no lleva datos del horario,
// únicamente el aviso de que algo cambió (ver `server/utils/horarioEventos.ts`).
const LATIDO_MS = 25_000

export default defineEventHandler(async (event) => {
   // El stream sirve a la matriz de clases, a las reservas de sala y a la vista de solo
   // lectura /horario/salas: alcanza con poder ver cualquiera de esas páginas.
   await requiereAlgunPermiso(event, [
      ['/horario', 'ver'],
      ['/reservas/horario', 'ver'],
      ['/horario/salas', 'ver'],
   ])

   const stream = createEventStream(event)

   const desuscribir = suscribirHorario((evento) => {
      void stream.push({ event: 'horario', data: JSON.stringify(evento) })
   })

   // Comentario periódico para que un proxy intermedio no corte la conexión por inactividad.
   const latido = setInterval(() => {
      void stream.push({ event: 'latido', data: String(Date.now()) })
   }, LATIDO_MS)
   // Latido inicial: la respuesta (y sus headers) recién sale con el primer mensaje, y hasta
   // entonces el EventSource del cliente no dispara 'open' — sin esto el indicador "En vivo"
   // se quedaba en "Reconectando…" los primeros LATIDO_MS de cada conexión.
   void stream.push({ event: 'latido', data: String(Date.now()) })

   stream.onClosed(() => {
      clearInterval(latido)
      desuscribir()
   })

   return stream.send()
})
