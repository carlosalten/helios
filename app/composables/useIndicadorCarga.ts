// Enciende el mismo indicador de carga global que usa la navegación (la barra de progreso de
// `app/app.vue` y el velo del layout) mientras corre una operación de datos dentro de una
// página ya montada: un `refresh()` tras guardar, un filtro que vuelve a pedir al servidor,
// una exportación que tarda.
//
// Hace falta porque Nuxt solo dispara su indicador al navegar entre páginas (hooks
// `page:loading:start` / `page:loading:end`): una vez montada la página, cualquier espera
// posterior no muestra nada por sí sola.
//
// No reemplaza a `TableSkeleton` — ese sirve para la carga inicial de una lista, donde todavía
// no hay nada que mostrar. Este es para cuando ya hay contenido en pantalla y se está
// actualizando.
export function useIndicadorCarga() {
   const { start, finish } = useLoadingIndicator()

   // Envuelve la operación: enciende el indicador antes y lo apaga al terminar, haya o no
   // error (por eso el `finally` — si no, un fallo dejaría el velo pegado en pantalla). Devuelve
   // lo que devuelva la operación y deja pasar la excepción, así el llamador sigue manejando
   // sus errores como siempre.
   async function conIndicador<T>(operacion: () => Promise<T>): Promise<T> {
      start()
      try {
         return await operacion()
      } finally {
         finish()
      }
   }

   return { conIndicador }
}
