export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/asignaturas', 'editar')

    const id = Number(getRouterParam(event, 'id'))
    if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

    const existe = await prisma.asignatura.findUnique({ where: { id } })
    if (!existe) throw createError({ statusCode: 404, message: 'Asignatura no encontrada' })

    const body = await readBody(event)
    const parsed = crearAsignaturaSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

    const duplicado = await prisma.asignatura.findFirst({ where: { codigo: parsed.data.codigo, NOT: { id } } })
    if (duplicado) throw createError({ statusCode: 409, message: 'Ya existe una asignatura con ese código' })

    return prisma.asignatura.update({ where: { id }, data: parsed.data })
})
