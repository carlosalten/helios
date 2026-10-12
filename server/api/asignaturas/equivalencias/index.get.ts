import type { EquivalenciasPlan } from '~/types/asignatura'

// Equivalencias de un plan (?planId=) para /asignaturas/equivalencias: las asignaturas de su
// malla, cada una con sus equivalentes, y las candidatas a equivalente — todas las asignaturas
// que no están en la malla (una asignatura de la malla no puede ser equivalente de otra).
export default defineEventHandler(async (event): Promise<EquivalenciasPlan> => {
   await requierePermiso(event, '/asignaturas/equivalencias', 'ver')

   const planId = Number(getQuery(event).planId)
   if (!Number.isInteger(planId)) throw createError({ statusCode: 400, message: 'Plan inválido' })

   const [malla, asignaturas] = await Promise.all([
      prisma.asignaturaPlan.findMany({
         where: { planId },
         include: {
            asignatura: { select: { id: true, codigo: true, nombre: true } },
            equivalentes: { select: { asignatura: { select: { id: true, codigo: true, nombre: true } } } },
         },
         orderBy: [{ esElectiva: 'asc' }, { semestre: 'asc' }, { orden: 'asc' }],
      }),
      prisma.asignatura.findMany({ select: { id: true, codigo: true, nombre: true }, orderBy: { codigo: 'asc' } }),
   ])

   const idsMalla = new Set(malla.map((ap) => ap.asignaturaId))

   return {
      malla: malla.map((ap) => ({
         asignaturaPlanId: ap.id,
         ...ap.asignatura,
         semestre: ap.semestre,
         esElectiva: ap.esElectiva,
         equivalentes: ap.equivalentes.map((e) => e.asignatura).sort((a, b) => a.codigo.localeCompare(b.codigo)),
      })),
      candidatas: asignaturas.filter((a) => !idsMalla.has(a.id)),
   }
})
