export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/salas/tipos', 'crear')

    const body = await readBody(event)
    const parsed = crearTipoSalaSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

    const existe = await prisma.tipoSala.findFirst({ where: { nombre: parsed.data.nombre } })
    if (existe) throw createError({ statusCode: 409, message: 'Ya existe un tipo de sala con ese nombre' })

    return prisma.tipoSala.create({ data: parsed.data })
})
