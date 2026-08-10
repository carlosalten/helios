export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/personas/tipos', 'crear')

    const body = await readBody(event)
    const parsed = crearRolSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

    const existe = await prisma.rol.findFirst({ where: { nombre: parsed.data.nombre } })
    if (existe) throw createError({ statusCode: 409, message: 'Ya existe un rol con ese nombre' })

    return prisma.rol.create({ data: parsed.data })
})
