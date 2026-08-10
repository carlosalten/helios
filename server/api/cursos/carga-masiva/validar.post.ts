// Analiza el CSV sin tocar la base de datos: informa qué falta (asignaturas, salas, profesores,
// bloques), qué se borraría y qué se crearía. La carga real va en index.post.ts.
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/cursos/carga-masiva', 'ver')

   const body = await readBody(event)
   const parsed = cargaMasivaSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const { plan, semestre } = await resolverPlanYSemestreCarga(usuario, parsed.data.planId, parsed.data.semestreId)

   const { reporte } = await analizarCargaMasiva(parsed.data.csv, plan.id, semestre.id, plan.carreraCodigo)
   return reporte
})
