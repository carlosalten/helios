export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/bloques', 'borrar')

    const id = Number(getRouterParam(event, 'id'))
    if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

    const existe = await prisma.bloque.findUnique({ where: { id } })
    if (!existe) throw createError({ statusCode: 404, message: 'Bloque no encontrado' })

    const tieneSesiones = await prisma.sesionParaleloBloque.findFirst({ where: { bloqueId: id } })
    if (tieneSesiones) {
        throw createError({ statusCode: 409, message: 'No se puede eliminar: el bloque tiene sesiones asociadas' })
    }

    await prisma.bloque.delete({ where: { id } })
    return { ok: true }
})
