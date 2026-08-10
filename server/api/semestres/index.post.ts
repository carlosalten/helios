export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/semestres', 'crear')

    const body = await readBody(event)
    const parsed = crearSemestreSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

    // Solo un semestre puede estar vigente a la vez.
    if (parsed.data.vigente) {
        return prisma.$transaction(async (tx) => {
            await tx.semestre.updateMany({ where: { vigente: true }, data: { vigente: false } })
            return tx.semestre.create({ data: parsed.data })
        })
    }

    return prisma.semestre.create({ data: parsed.data })
})
