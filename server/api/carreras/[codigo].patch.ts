export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/carreras', 'editar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const codigo = Number(getRouterParam(event, 'codigo'))
   if (!Number.isInteger(codigo)) throw createError({ statusCode: 400, message: 'Código inválido' })

   const existe = await prisma.carrera.findUnique({ where: { codigo } })
   if (!existe) throw createError({ statusCode: 404, message: 'Carrera no encontrada' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(codigo)) {
      throw createError({ statusCode: 404, message: 'Carrera no encontrada' })
   }

   const body = await readBody(event)
   const parsed = editarCarreraSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const duplicadoNombre = await prisma.carrera.findFirst({
      where: { nombre: parsed.data.nombre, NOT: { codigo } },
   })
   if (duplicadoNombre) throw createError({ statusCode: 409, message: 'Ya existe una carrera con ese nombre' })

   await validarJefeCarrera(parsed.data.jefePersonaId)

   return prisma.carrera.update({
      where: { codigo },
      data: parsed.data,
      include: { jefe: { include: { rol: true } } },
   })
})
