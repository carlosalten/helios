export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/estudiantes', 'borrar')

   const email = getRouterParam(event, 'email')
   if (!email) throw createError({ statusCode: 400, message: 'Email inválido' })

   const existe = await prisma.ttEstudiante.findUnique({ where: { email } })
   if (!existe) throw createError({ statusCode: 404, message: 'Estudiante no encontrado' })

   const tienePropuestas = await prisma.ttPropuesta.findFirst({ where: { estudianteEmail: email } })
   if (tienePropuestas) {
      throw createError({ statusCode: 409, message: 'No se puede eliminar: el estudiante tiene propuestas asociadas' })
   }

   await prisma.ttEstudiante.delete({ where: { email } })
   return { ok: true }
})
