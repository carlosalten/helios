export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/asignaturas', 'crear')

    const body = await readBody(event)
    const parsed = crearAsignaturaSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

    const existe = await prisma.asignatura.findUnique({ where: { codigo: parsed.data.codigo } })
    if (existe) throw createError({ statusCode: 409, message: 'Ya existe una asignatura con ese código' })

    return prisma.asignatura.create({ data: parsed.data })
})
