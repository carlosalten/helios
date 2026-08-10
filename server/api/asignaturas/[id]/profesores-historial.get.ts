// Profesores que han dictado esta asignatura, para el panel "Profesores que han dictado esta
// asignatura" que aparece en /horario al hacer click en una sesión de clases — ayuda a decidir
// a quién asignar viendo quién ya la ha hecho antes. Gateado con el permiso de /horario (no el
// de /asignaturas): es una vista propia de esa página, igual que /api/sesiones o
// /api/salas/mias.
//
// `excluirSemestreId` (opcional) saca de la lista al semestre que se está viendo — así el
// panel muestra "quién más" la ha dictado, no repite a los profesores ya visibles en el
// panel de Profesores de ese mismo semestre.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/horario', 'ver')

   const asignaturaId = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(asignaturaId)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const query = getQuery(event)
   const excluirSemestreId = query.excluirSemestreId ? Number(query.excluirSemestreId) : undefined
   if (excluirSemestreId !== undefined && !Number.isInteger(excluirSemestreId)) {
      throw createError({ statusCode: 400, message: 'excluirSemestreId inválido' })
   }

   const sesiones = await prisma.sesionParalelo.findMany({
      where: {
         profesorId: { not: null },
         paralelo: {
            asignaturaPlan: { asignaturaId },
            ...(excluirSemestreId !== undefined && { curso: { semestreId: { not: excluirSemestreId } } }),
         },
      },
      select: {
         paraleloId: true,
         profesor: { select: { id: true, nombre: true, apellido: true } },
         paralelo: { select: { curso: { select: { semestre: { select: { fechaInicio: true } } } } } },
      },
   })

   interface Acumulador {
      id: number
      nombre: string
      apellido: string
      // Cada paralelo distinto (código de curso) es una vez que dictó la asignatura, sea en
      // el mismo semestre (dos secciones a la vez) o en semestres distintos.
      paralelos: Set<number>
      ultimaFechaInicio: Date
   }
   const porProfesor = new Map<number, Acumulador>()

   for (const sesion of sesiones) {
      if (!sesion.profesor) continue
      const acumulador = porProfesor.get(sesion.profesor.id) ?? {
         ...sesion.profesor,
         paralelos: new Set<number>(),
         ultimaFechaInicio: new Date(0),
      }
      acumulador.paralelos.add(sesion.paraleloId)
      const fechaInicio = sesion.paralelo.curso.semestre.fechaInicio
      if (fechaInicio > acumulador.ultimaFechaInicio) acumulador.ultimaFechaInicio = fechaInicio
      porProfesor.set(sesion.profesor.id, acumulador)
   }

   return [...porProfesor.values()]
      .map((p) => ({
         id: p.id,
         nombre: p.nombre,
         apellido: p.apellido,
         vecesDictada: p.paralelos.size,
         ultimaFechaInicio: p.ultimaFechaInicio,
      }))
      .sort(
         (a, b) => b.ultimaFechaInicio.getTime() - a.ultimaFechaInicio.getTime() || a.apellido.localeCompare(b.apellido)
      )
      .map(({ ultimaFechaInicio: _u, ...resto }) => resto)
})
