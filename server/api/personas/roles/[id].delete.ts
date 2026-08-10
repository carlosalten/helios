export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/personas/tipos', 'borrar')

    const id = Number(getRouterParam(event, 'id'))
    if (isNaN(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

    const existe = await prisma.rol.findUnique({ where: { id } })
    if (!existe) throw createError({ statusCode: 404, message: 'Rol no encontrado' })
    // 'Administrador' controla el bypass hardcodeado en requierePermiso: no se puede borrar.
    if (existe.nombre === 'Administrador') {
        throw createError({ statusCode: 409, message: 'El rol Administrador no se puede eliminar' })
    }

    const personas = await prisma.persona.count({ where: { rolId: id } })
    if (personas > 0) throw createError({ statusCode: 409, message: 'No se puede eliminar: hay personas con este rol asignado' })

    await prisma.rol.delete({ where: { id } })
    return { ok: true }
})
