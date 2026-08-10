export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/salas/asignacion', 'editar')

    const body = await readBody(event)
    const parsed = toggleAsignacionSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

    const { codigoSala, personaId } = parsed.data

    const sala = await prisma.sala.findUnique({ where: { codigo: codigoSala } })
    if (!sala) throw createError({ statusCode: 404, message: 'Sala no encontrada' })

    const persona = await prisma.persona.findUnique({ where: { id: personaId } })
    if (!persona) throw createError({ statusCode: 404, message: 'Persona no encontrada' })

    const existente = await prisma.encargadoSala.findUnique({
        where: { personaId_salaCodigo: { personaId, salaCodigo: codigoSala } },
    })

    if (existente) {
        await prisma.encargadoSala.delete({ where: { id: existente.id } })
        return { asignado: false }
    }

    await prisma.encargadoSala.create({ data: { personaId, salaCodigo: codigoSala } })
    return { asignado: true }
})
