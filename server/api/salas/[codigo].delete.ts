export default defineEventHandler(async (event) => {
    const usuario = await requierePermiso(event, '/salas/gestion', 'borrar')

    const codigo = getRouterParam(event, 'codigo')
    if (!codigo) throw createError({ statusCode: 400, message: 'Código inválido' })

    const existe = await prisma.sala.findUnique({ where: { codigo } })
    if (!existe) throw createError({ statusCode: 404, message: 'Sala no encontrada' })

    await prisma.encargadoSala.deleteMany({ where: { salaCodigo: codigo } })
    await prisma.sala.delete({ where: { codigo } })

    publicarEventoHorario({
        tipo: 'sala',
        accion: 'borrar',
        semestreId: null,
        cursoId: null,
        descripcion: `Sala ${codigo}`,
        autorEmail: usuario.email,
        autorNombre: `${usuario.nombre} ${usuario.apellido}`,
    })

    return { ok: true }
})
