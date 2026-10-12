// Descarga un CSV generado en el browser. Separador `;` y BOM UTF-8 al inicio: es lo que
// Excel (configurado en español) abre directo en columnas y sin romper tildes/ñ.
function celdaCsv(valor: string | number) {
   return `"${String(valor).replace(/"/g, '""')}"`
}

export function descargarCsv(nombreArchivo: string, encabezados: string[], filas: (string | number)[][]) {
   const contenido = [encabezados, ...filas].map((fila) => fila.map(celdaCsv).join(';')).join('\r\n')
   const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' })
   const url = URL.createObjectURL(blob)
   const enlace = document.createElement('a')
   enlace.href = url
   enlace.download = nombreArchivo
   enlace.click()
   URL.revokeObjectURL(url)
}
