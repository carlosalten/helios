export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/salas/tipos', 'borrar')

    const id = Number(getRouterParam(event, 'id'))
    if (isNaN(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

    const salas = await prisma.sala.count({ where: { tipoSalaId: id } })
    if (salas > 0) throw createError({ statusCode: 409, message: 'No se puede eliminar: hay salas con este tipo asignado' })

    await prisma.tipoSala.delete({ where: { id } })
    return { ok: true }
})
