export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/bloques', 'editar')

    const id = Number(getRouterParam(event, 'id'))
    if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

    const existe = await prisma.bloque.findUnique({ where: { id } })
    if (!existe) throw createError({ statusCode: 404, message: 'Bloque no encontrado' })

    const body = await readBody(event)
    const parsed = crearBloqueSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

    const semestre = await prisma.semestre.findUnique({ where: { id: parsed.data.semestreId } })
    if (!semestre) throw createError({ statusCode: 404, message: 'Semestre no encontrado' })

    const duplicado = await prisma.bloque.findFirst({
        where: { semestreId: parsed.data.semestreId, numero: parsed.data.numero, NOT: { id } },
    })
    if (duplicado) throw createError({ statusCode: 409, message: 'Ya existe un bloque con ese número en este semestre' })

    if (parsed.data.esUltimoManana) {
        const yaExiste = await prisma.bloque.findFirst({
            where: { semestreId: parsed.data.semestreId, esUltimoManana: true, NOT: { id } },
        })
        if (yaExiste) {
            throw createError({
                statusCode: 409,
                message: 'Ya existe un bloque marcado como el último de la mañana en este semestre',
            })
        }
    }

    const { diasProtegidos, ...datosBloque } = parsed.data

    // Reemplaza las protecciones por completo: borra las existentes y recrea desde el arreglo.
    const bloque = await prisma.bloque.update({
        where: { id },
        data: {
            ...datosBloque,
            protecciones: {
                deleteMany: {},
                create: diasProtegidos.map((diaSemana) => ({ diaSemana })),
            },
        },
        include: { semestre: true, protecciones: { select: { diaSemana: true } } },
    })

    return { ...bloque, protecciones: undefined, diasProtegidos: bloque.protecciones.map((p) => p.diaSemana) }
})
