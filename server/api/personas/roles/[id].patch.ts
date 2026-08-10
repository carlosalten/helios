export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/personas/tipos', 'editar')

    const id = Number(getRouterParam(event, 'id'))
    if (isNaN(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

    const existe = await prisma.rol.findUnique({ where: { id } })
    if (!existe) throw createError({ statusCode: 404, message: 'Rol no encontrado' })
    // 'Administrador' controla el bypass hardcodeado en requierePermiso: renombrarlo
    // dejaría a cualquier persona con ese rol sin acceso total por accidente.
    if (existe.nombre === 'Administrador') {
        throw createError({ statusCode: 409, message: 'El rol Administrador no se puede modificar' })
    }

    const body = await readBody(event)
    const parsed = crearRolSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

    const duplicado = await prisma.rol.findFirst({ where: { nombre: parsed.data.nombre, NOT: { id } } })
    if (duplicado) throw createError({ statusCode: 409, message: 'Ya existe un rol con ese nombre' })

    return prisma.rol.update({ where: { id }, data: parsed.data })
})
