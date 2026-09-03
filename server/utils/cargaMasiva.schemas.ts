import { z } from 'zod'

// El browser lee el archivo, lo decodifica (UTF-8 o Windows-1252) y manda el texto plano:
// así la detección de encoding queda en un solo lugar y el servidor solo parsea CSV.
export const cargaMasivaSchema = z.object({
   // Tope de tamaño (~10 MB de texto): el CSV real es la programación académica completa de
   // TODOS los campus y carreras (analizarCargaMasiva filtra recién en el servidor a Viña del
   // Mar + la carrera del plan elegido) — un solo semestre ya son miles de filas y varios MB.
   // El límite solo evita que un archivo desproporcionado consuma memoria del proceso al
   // parsearse, no acota el uso real esperado.
   csv: z
      .string({ error: 'El archivo CSV es requerido' })
      .min(1, 'El archivo CSV está vacío')
      .max(10_000_000, 'El archivo CSV es demasiado grande'),
   planId: z.number({ error: 'El plan es requerido' }).int(),
   semestreId: z.number({ error: 'El semestre es requerido' }).int(),
})

export type CargaMasivaInput = z.infer<typeof cargaMasivaSchema>
