export default defineEventHandler(async (event) => {
    await requierePermiso(event, '/bloques/copiar', 'crear')

    const body = await readBody(event)
    const parsed = copiarBloquesSchema.safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

    const { semestreOrigenId, semestreDestinoId } = parsed.data

    const [origen, destino] = await Promise.all([
        prisma.semestre.findUnique({ where: { id: semestreOrigenId } }),
        prisma.semestre.findUnique({ where: { id: semestreDestinoId } }),
    ])
    if (!origen) throw createError({ statusCode: 404, message: 'Semestre de origen no encontrado' })
    if (!destino) throw createError({ statusCode: 404, message: 'Semestre de destino no encontrado' })

    const bloquesOrigen = await prisma.bloque.findMany({
        where: { semestreId: semestreOrigenId },
        include: { protecciones: { select: { diaSemana: true } } },
    })

    if (!bloquesOrigen.length) {
        return { copiados: 0, omitidos: 0, total: 0 }
    }

    // Los bloques cuyo número ya existe en el destino se omiten (no se duplican ni sobrescriben).
    const numerosDestino = await prisma.bloque.findMany({
        where: { semestreId: semestreDestinoId },
        select: { numero: true },
    })
    const yaExisten = new Set(numerosDestino.map((b) => b.numero))
    const aCopiar = bloquesOrigen.filter((b) => !yaExisten.has(b.numero))

    // El destino ya podría tener su propio bloque marcado como "último de la mañana": en ese
    // caso no se copia esa marca (a lo más un bloque por semestre puede tenerla) y solo se
    // copian los datos del bloque en sí.
    const destinoYaTieneUltimoManana = await prisma.bloque.findFirst({
        where: { semestreId: semestreDestinoId, esUltimoManana: true },
    })

    // Copia cada bloque nuevo junto con sus días protegidos, en una transacción.
    await prisma.$transaction(
        aCopiar.map((b) =>
            prisma.bloque.create({
                data: {
                    semestreId: semestreDestinoId,
                    numero: b.numero,
                    inicio: b.inicio,
                    fin: b.fin,
                    jornada: b.jornada,
                    esUltimoManana: b.esUltimoManana && !destinoYaTieneUltimoManana,
                    protecciones: { create: b.protecciones.map(({ diaSemana }) => ({ diaSemana })) },
                },
            }),
        ),
    )

    return { copiados: aCopiar.length, omitidos: bloquesOrigen.length - aCopiar.length, total: bloquesOrigen.length }
})
