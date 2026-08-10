export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/semestres', 'borrar')

    const id = Number(getRouterParam(event, 'id'))
    if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

    const existe = await prisma.semestre.findUnique({ where: { id } })
    if (!existe) throw createError({ statusCode: 404, message: 'Semestre no encontrado' })

    const [tieneCursos, tieneBloques] = await Promise.all([
        prisma.curso.findFirst({ where: { semestreId: id } }),
        prisma.bloque.findFirst({ where: { semestreId: id } }),
    ])
    if (tieneCursos || tieneBloques) {
        throw createError({
            statusCode: 409,
            message: 'No se puede eliminar: el semestre tiene cursos o bloques asociados',
        })
    }

    await prisma.semestre.delete({ where: { id } })
    return { ok: true }
})
