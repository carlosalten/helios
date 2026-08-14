import bcrypt from 'bcryptjs'

// Carga masiva de estudiantes desde uno o más Excel: el browser hace el parseo (ver
// app/pages/titulaciones/estudiantes.vue) y manda acá una fila por estudiante. Es puramente
// aditiva — nunca borra ni reemplaza lo que ya existe — y tolerante a errores: una fila mal
// formada o un estudiante que ya existe (mismo email o RUN) se omite y se sigue con el resto,
// no aborta la carga completa.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/estudiantes', 'crear')

   const body = await readBody(event)
   const parsed = cargaMasivaEstudiantesSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const proceso = await prisma.ttProceso.findUnique({ where: { id: parsed.data.procesoId } })
   if (!proceso) throw createError({ statusCode: 404, message: 'Proceso no encontrado' })

   const filasInvalidas: { archivo: string; fila: number; motivo: string }[] = []
   const filasValidas: {
      run: string
      apellidoPaterno: string
      apellidoMaterno: string
      nombres: string
      email: string
      archivo: string
      fila: number
   }[] = []

   for (const cruda of parsed.data.filas) {
      const resultado = filaCargaMasivaEstudianteSchema.safeParse(cruda)
      if (!resultado.success) {
         filasInvalidas.push({
            archivo: cruda.archivo,
            fila: cruda.fila,
            motivo: resultado.error.issues[0]?.message ?? 'Datos inválidos',
         })
         continue
      }
      filasValidas.push(resultado.data)
   }

   // Duplicados dentro de los propios archivos cargados (el mismo estudiante en dos filas, o
   // en dos archivos distintos de la misma carga): se conserva la primera aparición.
   const omitidosDuplicadosArchivo: { archivo: string; fila: number; run: string; email: string }[] = []
   const vistos = new Set<string>()
   const filasSinDuplicar: typeof filasValidas = []
   for (const fila of filasValidas) {
      const clave = `${fila.run}·${fila.email}`
      if (vistos.has(clave) || vistos.has(`run:${fila.run}`) || vistos.has(`email:${fila.email}`)) {
         omitidosDuplicadosArchivo.push({ archivo: fila.archivo, fila: fila.fila, run: fila.run, email: fila.email })
         continue
      }
      vistos.add(clave)
      vistos.add(`run:${fila.run}`)
      vistos.add(`email:${fila.email}`)
      filasSinDuplicar.push(fila)
   }

   // Estudiantes que ya estaban en la tabla (de una carga anterior, o creados a mano): se
   // omiten sin tocar la fila existente.
   const existentes = await prisma.ttEstudiante.findMany({
      where: {
         OR: [
            { run: { in: filasSinDuplicar.map((f) => f.run) } },
            { email: { in: filasSinDuplicar.map((f) => f.email) } },
         ],
      },
      select: { run: true, email: true },
   })
   const runsExistentes = new Set(existentes.map((e) => e.run))
   const emailsExistentes = new Set(existentes.map((e) => e.email))

   const omitidosExistian: { archivo: string; fila: number; run: string; email: string }[] = []
   const aCrear: typeof filasSinDuplicar = []
   for (const fila of filasSinDuplicar) {
      if (runsExistentes.has(fila.run) || emailsExistentes.has(fila.email)) {
         omitidosExistian.push({ archivo: fila.archivo, fila: fila.fila, run: fila.run, email: fila.email })
         continue
      }
      aCrear.push(fila)
   }

   const datos = await Promise.all(
      aCrear.map(async (fila) => ({
         email: fila.email,
         run: fila.run,
         password: await bcrypt.hash(generarPasswordEstudiante(fila.run, fila.apellidoPaterno, fila.nombres), 12),
         nombres: fila.nombres,
         apellidoPaterno: fila.apellidoPaterno,
         apellidoMaterno: fila.apellidoMaterno,
         procesoId: parsed.data.procesoId,
         grupoId: null,
      }))
   )

   // `skipDuplicates` como red de seguridad ante una condición de carrera (otra carga
   // insertando el mismo RUN/email justo entre el chequeo de arriba y este insert) — la
   // detección "normal" ya se hizo a mano para poder reportar cuáles se omitieron.
   const creado = await prisma.ttEstudiante.createMany({ data: datos, skipDuplicates: true })

   return {
      totalFilas: parsed.data.filas.length,
      creados: creado.count,
      omitidosExistian,
      omitidosDuplicadosArchivo,
      filasInvalidas,
   }
})
