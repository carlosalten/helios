export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/horario', 'editar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })
   const hoy = resolverHoy(getQuery(event))

   const existe = await prisma.sesionParalelo.findUnique({
      where: { id },
      include: { paralelo: { include: { asignaturaPlan: { include: { plan: true } } } } },
   })
   if (!existe) throw createError({ statusCode: 404, message: 'Sesión no encontrada' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(existe.paralelo.asignaturaPlan.plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Sesión no encontrada' })
   }

   const body = await readBody(event)
   const parsed = asignarSesionSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const data: { salaCodigo?: string | null; profesorId?: number | null } = {}

   if ('salaCodigo' in parsed.data) {
      if (parsed.data.salaCodigo) {
         const sala = await prisma.sala.findUnique({ where: { codigo: parsed.data.salaCodigo } })
         if (!sala) throw createError({ statusCode: 404, message: 'Sala no encontrada' })
      }
      data.salaCodigo = parsed.data.salaCodigo ?? null
   }

   if ('profesorId' in parsed.data) {
      if (parsed.data.profesorId) {
         const profesor = await prisma.persona.findUnique({ where: { id: parsed.data.profesorId } })
         if (!profesor) throw createError({ statusCode: 404, message: 'Persona no encontrada' })
      }
      data.profesorId = parsed.data.profesorId ?? null
   }

   const sesion = await prisma.sesionParalelo.update({
      where: { id },
      data,
      include: incluirSesion,
   })

   // Asignar/cambiar/quitar la sala o el profesor de una sesión de clases (re)genera su
   // reserva de sala: una serie recurrente semanal desde el inicio hasta el término del
   // semestre, no una reserva independiente por cada bloque. Basta con que haya sala; el
   // responsable es el profesor de la sesión y queda nulo mientras no se le asigne uno.
   // Ver server/utils/reservasSesion.ts.
   if ('salaCodigo' in parsed.data || 'profesorId' in parsed.data) {
      const bloque = sesion.bloques[0]?.bloque
      if (bloque) {
         const semestre = await prisma.semestre.findUnique({ where: { id: sesion.paralelo.curso.semestreId } })
         if (semestre) {
            const titulo = tituloReservaSesion(sesion.paralelo)
            await regenerarReservaSesion(sesion, bloque, semestre, titulo, sesion.profesorId, hoy)

            // El mismo paralelo dictado en otro curso comparte sala y profesor: se le copia el
            // estado final (no solo el campo tocado). Ver server/utils/sesionesEspejo.ts.
            await replicarAsignarSesion(
               sesion.paralelo,
               { tipo: sesion.tipo, diaSemana: sesion.diaSemana, bloqueId: bloque.id },
               { salaCodigo: sesion.salaCodigo, profesorId: sesion.profesorId },
               bloque,
               semestre,
               titulo,
               hoy
            )
         }
      }
   }

   publicarEventoHorario({
      tipo: 'sesion',
      accion: 'editar',
      semestreId: sesion.paralelo.curso.semestreId,
      cursoId: sesion.paralelo.cursoId,
      descripcion: sesion.paralelo.curso.nombre,
      autorEmail: usuario.email,
      autorNombre: `${usuario.nombre} ${usuario.apellido}`,
   })

   return mapearSesion(sesion)
})
