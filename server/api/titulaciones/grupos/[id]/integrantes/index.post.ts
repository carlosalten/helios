// Agrega un estudiante ya existente (de cualquier grupo o sin grupo) al grupo `id` — le
// reasigna su `grupoId`. No crea el estudiante: eso es POST /api/titulaciones/estudiantes.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/titulaciones/grupos', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const grupo = await prisma.ttGrupo.findUnique({ where: { id } })
   if (!grupo) throw createError({ statusCode: 404, message: 'Grupo no encontrado' })

   const body = await readBody(event)
   const parsed = agregarIntegranteGrupoSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const estudiante = await prisma.ttEstudiante.findUnique({ where: { email: parsed.data.email } })
   if (!estudiante) throw createError({ statusCode: 404, message: 'Estudiante no encontrado' })
   if (estudiante.procesoId !== grupo.procesoId) {
      throw createError({ statusCode: 422, message: 'El estudiante pertenece a otro proceso de titulación' })
   }

   return prisma.ttEstudiante.update({
      where: { email: estudiante.email },
      data: { grupoId: id },
      select: { email: true, run: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true },
   })
})
