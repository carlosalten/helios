export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/profesores', 'borrar')

   const email = getRouterParam(event, 'email')
   if (!email) throw createError({ statusCode: 400, message: 'Email inválido' })

   const existe = await prisma.ttProfesor.findUnique({ where: { email } })
   if (!existe) throw createError({ statusCode: 404, message: 'Profesor no encontrado' })

   const [tieneComisiones, tieneLineas] = await Promise.all([
      prisma.ttComision.findFirst({ where: { profesorEmail: email } }),
      prisma.ttLineaInvestigacionProfesor.findFirst({ where: { profesorEmail: email } }),
   ])
   if (tieneComisiones || tieneLineas) {
      throw createError({
         statusCode: 409,
         message: 'No se puede eliminar: el profesor está asociado a una comisión o línea de investigación',
      })
   }

   await prisma.ttProfesor.delete({ where: { email } })
   return { ok: true }
})
