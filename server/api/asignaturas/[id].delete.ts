export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/asignaturas', 'borrar')

    const id = Number(getRouterParam(event, 'id'))
    if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

    const existe = await prisma.asignatura.findUnique({ where: { id } })
    if (!existe) throw createError({ statusCode: 404, message: 'Asignatura no encontrada' })

    const tienePlanes = await prisma.asignaturaPlan.findFirst({ where: { asignaturaId: id } })
    if (tienePlanes) {
        throw createError({ statusCode: 409, message: 'No se puede eliminar: la asignatura está asociada a uno o más planes' })
    }

    await prisma.asignatura.delete({ where: { id } })
    return { ok: true }
})
