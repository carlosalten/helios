// Carga masiva del horario de un plan desde el CSV de programación académica. Borra el horario
// que el plan tuviera en el semestre elegido (cursos, paralelos, sesiones y sus reservas) y lo
// reconstruye desde el archivo. Ver server/utils/cargaMasiva.ts para el detalle del análisis.
export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/cursos/carga-masiva', 'crear')

   const body = await readBody(event)
   const parsed = cargaMasivaSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const { plan, semestre } = await resolverPlanYSemestreCarga(usuario, parsed.data.planId, parsed.data.semestreId)

   // Se vuelve a analizar en vez de confiar en lo que validó el cliente: el archivo llega igual
   // desde el browser, pero la BD pudo cambiar entre la validación y la confirmación.
   const { reporte, ejecucion } = await analizarCargaMasiva(parsed.data.csv, plan.id, semestre.id, plan.carreraCodigo)
   if (!ejecucion) {
      throw createError({
         statusCode: 422,
         message: reporte.errores[0]?.titulo ?? 'El archivo tiene errores que impiden la carga',
         data: reporte,
      })
   }

   const resultado = await ejecutarCargaMasiva(ejecucion)

   publicarEventoHorario({
      tipo: 'paralelo',
      accion: 'crear',
      semestreId: semestre.id,
      cursoId: null,
      descripcion: `Carga masiva de ${plan.carrera.nombreCorto} · Plan N° ${plan.numero}`,
      autorEmail: usuario.email,
      autorNombre: `${usuario.nombre} ${usuario.apellido}`,
   })

   return { ...resultado, advertencias: reporte.advertencias }
})
