import { z } from 'zod'

// El browser lee el archivo, lo decodifica (UTF-8 o Windows-1252) y manda el texto plano:
// así la detección de encoding queda en un solo lugar y el servidor solo parsea CSV.
export const cargaMasivaSchema = z.object({
   // Tope de tamaño (~2 MB de texto): una carga académica real son a lo sumo unos cientos de
   // filas; el límite evita que un CSV gigante consuma memoria del proceso al parsearse.
   csv: z
      .string({ error: 'El archivo CSV es requerido' })
      .min(1, 'El archivo CSV está vacío')
      .max(2_000_000, 'El archivo CSV es demasiado grande'),
   planId: z.number({ error: 'El plan es requerido' }).int(),
   semestreId: z.number({ error: 'El semestre es requerido' }).int(),
})

export type CargaMasivaInput = z.infer<typeof cargaMasivaSchema>
