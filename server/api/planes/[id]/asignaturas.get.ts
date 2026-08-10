// Ver la malla de un plan NO se acota por carrera, igual que /api/planes: un Jefe de Carrera
// puede revisar la malla de otra carrera aunque no pueda editarla (ver
// server/api/planes/asignacion/toggle.post.ts y reordenar.post.ts, que sí quedan acotados).
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/planes/asignacion', 'ver')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const plan = await prisma.plan.findUnique({ where: { id } })
   if (!plan) throw createError({ statusCode: 404, message: 'Plan no encontrado' })

   const [asignaturas, asociadas] = await Promise.all([
      prisma.asignatura.findMany({ orderBy: { nombre: 'asc' } }),
      prisma.asignaturaPlan.findMany({
         where: { planId: id },
         select: { id: true, asignaturaId: true, semestre: true, orden: true, esElectiva: true },
      }),
   ])

   const asociacionPorAsignatura = new Map(asociadas.map((a) => [a.asignaturaId, a]))

   return asignaturas
      .map((a) => {
         const asociacion = asociacionPorAsignatura.get(a.id)
         return {
            ...a,
            asignado: !!asociacion,
            asignaturaPlanId: asociacion?.id ?? null,
            semestre: asociacion?.semestre ?? 1,
            orden: asociacion?.orden ?? 0,
            esElectiva: asociacion?.esElectiva ?? false,
         }
      })
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
})
