// Da de alta o de baja una equivalencia entre dos asignaturas. La relación es simétrica y se
// guarda en las dos direcciones (ver AsignaturaEquivalencia en schema.prisma): las dos filas
// se crean o se borran juntas, en una transacción, para que nunca quede media equivalencia.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/asignaturas/equivalencias', 'editar')

   const body = await readBody(event)
   const parsed = toggleEquivalenciaSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const { asignaturaId, equivalenteId } = parsed.data
   if (asignaturaId === equivalenteId) {
      throw createError({ statusCode: 422, message: 'Una asignatura no puede ser equivalente a sí misma' })
   }

   const existentes = await prisma.asignatura.count({ where: { id: { in: [asignaturaId, equivalenteId] } } })
   if (existentes !== 2) throw createError({ statusCode: 404, message: 'Asignatura no encontrada' })

   const yaEquivalen = await prisma.asignaturaEquivalencia.findUnique({
      where: { asignaturaId_equivalenteId: { asignaturaId, equivalenteId } },
   })

   if (yaEquivalen) {
      await prisma.asignaturaEquivalencia.deleteMany({
         where: {
            OR: [
               { asignaturaId, equivalenteId },
               { asignaturaId: equivalenteId, equivalenteId: asignaturaId },
            ],
         },
      })
      return { equivalente: false }
   }

   await prisma.asignaturaEquivalencia.createMany({
      data: [
         { asignaturaId, equivalenteId },
         { asignaturaId: equivalenteId, equivalenteId: asignaturaId },
      ],
      skipDuplicates: true,
   })
   return { equivalente: true }
})
