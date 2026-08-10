export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/salas/tipos', 'editar')

    const id = Number(getRouterParam(event, 'id'))
    if (isNaN(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

    const existe = await prisma.tipoSala.findUnique({ where: { id } })
    if (!existe) throw createError({ statusCode: 404, message: 'Tipo de sala no encontrado' })

    const body = await readBody(event)
    const parsed = crearTipoSalaSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

    const duplicado = await prisma.tipoSala.findFirst({ where: { nombre: parsed.data.nombre, NOT: { id } } })
    if (duplicado) throw createError({ statusCode: 409, message: 'Ya existe un tipo de sala con ese nombre' })

    return prisma.tipoSala.update({ where: { id }, data: parsed.data })
})
