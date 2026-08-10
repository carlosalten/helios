// Todas las asignaturas del sistema (menos la propia) marcando cuáles son equivalentes a la
// del `id`, para el panel derecho de /asignaturas/equivalencias. Mismo patrón que
// /api/salas/[codigo]/personas: la lista completa con un booleano, y el toggle aparte.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/asignaturas/equivalencias', 'ver')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const asignatura = await prisma.asignatura.findUnique({
      where: { id },
      select: { id: true, equivalencias: { select: { equivalenteId: true } } },
   })
   if (!asignatura) throw createError({ statusCode: 404, message: 'Asignatura no encontrada' })

   const equivalentes = new Set(asignatura.equivalencias.map((e) => e.equivalenteId))

   const asignaturas = await prisma.asignatura.findMany({
      where: { id: { not: id } },
      select: { id: true, codigo: true, nombre: true },
      orderBy: { codigo: 'asc' },
   })

   return asignaturas.map((a) => ({ ...a, equivalente: equivalentes.has(a.id) }))
})
