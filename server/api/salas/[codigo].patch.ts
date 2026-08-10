export default defineEventHandler(async (event) => {
    const usuario = await requierePermiso(event, '/salas/gestion', 'editar')

    const codigo = getRouterParam(event, 'codigo')
    if (!codigo) throw createError({ statusCode: 400, message: 'Código inválido' })

    const existe = await prisma.sala.findUnique({ where: { codigo } })
    if (!existe) throw createError({ statusCode: 404, message: 'Sala no encontrada' })

    const body = await readBody(event)
    const parsed = editarSalaSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

    const tipo = await prisma.tipoSala.findUnique({ where: { id: parsed.data.tipoSalaId } })
    if (!tipo) throw createError({ statusCode: 404, message: 'Tipo de sala no encontrado' })

    const actualizada = await prisma.sala.update({
        where: { codigo },
        data: parsed.data,
        include: { tipoSala: true },
    })

    // Cambiar la capacidad puede hacer que una sesión ya agendada pase a exceder el cupo
    // del paralelo, así que hay que avisar aunque la sala no cambie de código.
    publicarEventoHorario({
        tipo: 'sala',
        accion: 'editar',
        semestreId: null,
        cursoId: null,
        descripcion: `Sala ${actualizada.codigo}`,
        autorEmail: usuario.email,
        autorNombre: `${usuario.nombre} ${usuario.apellido}`,
    })

    return actualizada
})
