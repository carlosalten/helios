export default defineEventHandler(async (event) => {
    const usuario = await requierePermiso(event, '/salas/gestion', 'crear')

    const body = await readBody(event)
    const parsed = crearSalaSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

    const existe = await prisma.sala.findUnique({ where: { codigo: parsed.data.codigo } })
    if (existe) throw createError({ statusCode: 409, message: 'Ya existe una sala con ese código' })

    const tipo = await prisma.tipoSala.findUnique({ where: { id: parsed.data.tipoSalaId } })
    if (!tipo) throw createError({ statusCode: 404, message: 'Tipo de sala no encontrado' })

    const creada = await prisma.sala.create({ data: parsed.data, include: { tipoSala: true } })

    // Las salas se arrastran desde el panel lateral de /horario: `semestreId`/`cursoId` van
    // en null porque son un recurso global, no dependen del semestre en pantalla.
    publicarEventoHorario({
        tipo: 'sala',
        accion: 'crear',
        semestreId: null,
        cursoId: null,
        descripcion: `Sala ${creada.codigo}`,
        autorEmail: usuario.email,
        autorNombre: `${usuario.nombre} ${usuario.apellido}`,
    })

    return creada
})
