export default defineEventHandler(async (event) => {
    const usuario = await requierePermiso(event, '/personas/gestion', 'editar')

    const id = Number(getRouterParam(event, 'id'))
    if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

    const existe = await prisma.persona.findUnique({ where: { id } })
    if (!existe) throw createError({ statusCode: 404, message: 'Persona no encontrada' })

    const body = await readBody(event)
    const parsed = editarPersonaSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

    const actualizada = await prisma.persona.update({
        where: { id },
        data: parsed.data,
        include: { rol: true },
    })

    publicarEventoHorario({
        tipo: 'profesor',
        accion: 'editar',
        semestreId: null,
        cursoId: null,
        descripcion: `${actualizada.nombre} ${actualizada.apellido}`,
        autorEmail: usuario.email,
        autorNombre: `${usuario.nombre} ${usuario.apellido}`,
    })

    return actualizada
})
