interface RegistroTasa {
   conteo: number
   expiraEn: number
}

// Almacén en memoria. Suficiente para una instancia única; para múltiples
// instancias se requeriría un store compartido (p. ej. Redis).
const almacen = new Map<string, RegistroTasa>()

interface ResultadoTasa {
   permitido: boolean
   /** Segundos hasta que la ventana se reinicie (0 si está permitido). */
   reintentarEnSeg: number
}

/**
 * Consulta si una clave ya superó el límite, **sin** incrementar el contador.
 * Útil para limitar por cuenta contando solo fallos (ver `registrarFallo`).
 */
export function excedeLimite(clave: string, max: number): ResultadoTasa {
   const ahora = Date.now()
   const registro = almacen.get(clave)

   if (!registro || registro.expiraEn < ahora) {
      return { permitido: true, reintentarEnSeg: 0 }
   }

   if (registro.conteo >= max) {
      return { permitido: false, reintentarEnSeg: Math.ceil((registro.expiraEn - ahora) / 1000) }
   }

   return { permitido: true, reintentarEnSeg: 0 }
}

/** Registra un fallo para una clave, abriendo la ventana si no existe. */
export function registrarFallo(clave: string, ventanaMs: number): void {
   const ahora = Date.now()
   const registro = almacen.get(clave)

   if (!registro || registro.expiraEn < ahora) {
      almacen.set(clave, { conteo: 1, expiraEn: ahora + ventanaMs })
      return
   }

   registro.conteo++
}

/** Reinicia el contador de una clave (p. ej. tras un login exitoso). */
export function reiniciarTasa(clave: string): void {
   almacen.delete(clave)
}
