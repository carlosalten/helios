// Asignaturas que se dictan en un plan en un semestre: para cada asignatura con paralelos en
// los cursos de ese (planId, semestreId), cuántos paralelos tiene y, para el panel de detalle
// al hacer click en /reportes/asignaturas-plan.vue, el horario de cada paralelo (día, bloque,
// sala) y su(s) profesor(es) asignado(s). No distingue teoría de práctica.
interface SesionReporte {
   diaSemana: number
   salaCodigo: string | null
   profesor: { id: number; nombre: string; apellido: string } | null
   bloqueNumeroInicio: number | null
   bloqueNumeroFin: number | null
   horaInicio: string | null
   horaFin: string | null
}

interface ParaleloReporte {
   paraleloId: number
   codigo: string
   cursoNombre: string
   sesiones: SesionReporte[]
}

interface SesionCruda {
   diaSemana: number
   salaCodigo: string | null
   profesor: { id: number; nombre: string; apellido: string } | null
   bloque: { numero: number; inicio: Date; fin: Date; esUltimoManana: boolean } | null
}

// Fusiona sesiones contiguas (mismo día, sala y profesor, con bloques de numeración
// consecutiva) en un solo tramo — una clase de varios bloques seguidos es UNA clase, no varias
// filas separadas. A diferencia de `contarTramosContiguos` en /api/dashboard (que exige que el
// fin de un bloque coincida exactamente con el inicio del siguiente), acá SÍ se puentea un
// receso corto entre bloques consecutivos (ej. bloque 6 a las 12:15 y bloque 7 a las 12:30): la
// fusión se corta solo después de `esUltimoManana` (el bloque que antecede el almuerzo, ver
// invariante `bloque_un_ultimo_manana_por_semestre`), que es el único quiebre real del horario.
// El tipo (teoría/práctica) no se considera: esta vista no lo distingue.
function fusionarTramosContiguos(sesiones: SesionCruda[]): SesionReporte[] {
   const ordenadas = [...sesiones].sort((a, b) => {
      if (a.diaSemana !== b.diaSemana) return a.diaSemana - b.diaSemana
      return (a.bloque?.inicio.getTime() ?? 0) - (b.bloque?.inicio.getTime() ?? 0)
   })

   const tramos: (SesionReporte & { ultimoEsUltimoManana: boolean })[] = []
   for (const sesion of ordenadas) {
      const anterior = tramos[tramos.length - 1]
      const continua =
         anterior &&
         sesion.bloque &&
         !anterior.ultimoEsUltimoManana &&
         anterior.bloqueNumeroFin === sesion.bloque.numero - 1 &&
         anterior.diaSemana === sesion.diaSemana &&
         anterior.salaCodigo === sesion.salaCodigo &&
         (anterior.profesor?.id ?? null) === (sesion.profesor?.id ?? null)

      if (continua && anterior && sesion.bloque) {
         anterior.bloqueNumeroFin = sesion.bloque.numero
         anterior.horaFin = horaLocal(sesion.bloque.fin)
         anterior.ultimoEsUltimoManana = sesion.bloque.esUltimoManana
      } else {
         tramos.push({
            diaSemana: sesion.diaSemana,
            salaCodigo: sesion.salaCodigo,
            profesor: sesion.profesor,
            bloqueNumeroInicio: sesion.bloque?.numero ?? null,
            bloqueNumeroFin: sesion.bloque?.numero ?? null,
            horaInicio: sesion.bloque ? horaLocal(sesion.bloque.inicio) : null,
            horaFin: sesion.bloque ? horaLocal(sesion.bloque.fin) : null,
            ultimoEsUltimoManana: sesion.bloque?.esUltimoManana ?? false,
         })
      }
   }

   return tramos.map(({ ultimoEsUltimoManana: _u, ...resto }) => resto)
}

interface AsignaturaReporte {
   asignaturaId: number
   codigo: string
   nombre: string
   semestre: number
   esElectiva: boolean
   cantidadParalelos: number
   paralelos: ParaleloReporte[]
}

export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/reportes/asignaturas-plan', 'ver')

   const parsed = filtroPlanSemestreSchema.safeParse(getQuery(event))
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Filtro inválido' })
   }
   const { planId, semestreId } = parsed.data

   const cursos = await prisma.curso.findMany({ where: { planId, semestreId }, select: { id: true, nombre: true } })
   const cursoIds = cursos.map((c) => c.id)
   if (!cursoIds.length) return { asignaturas: [] }
   const nombreCurso = new Map(cursos.map((c) => [c.id, c.nombre]))

   const paralelos = await prisma.paralelo.findMany({
      where: { cursoId: { in: cursoIds } },
      select: {
         id: true,
         codigo: true,
         cursoId: true,
         asignaturaPlan: {
            select: {
               semestre: true,
               esElectiva: true,
               asignatura: { select: { id: true, codigo: true, nombre: true } },
            },
         },
         sesiones: {
            select: {
               diaSemana: true,
               salaCodigo: true,
               profesor: { select: { id: true, nombre: true, apellido: true } },
               bloques: {
                  select: { bloque: { select: { numero: true, inicio: true, fin: true, esUltimoManana: true } } },
               },
            },
            orderBy: { diaSemana: 'asc' },
         },
      },
      orderBy: { codigo: 'asc' },
   })

   interface Acumulador {
      asignaturaId: number
      codigo: string
      nombre: string
      ordenSemestre: number
      esElectiva: boolean
      paralelos: ParaleloReporte[]
   }
   const porAsignatura = new Map<number, Acumulador>()

   for (const paralelo of paralelos) {
      const asignatura = paralelo.asignaturaPlan.asignatura
      const acumulador = porAsignatura.get(asignatura.id) ?? {
         asignaturaId: asignatura.id,
         codigo: asignatura.codigo,
         nombre: asignatura.nombre,
         ordenSemestre: paralelo.asignaturaPlan.semestre,
         esElectiva: paralelo.asignaturaPlan.esElectiva,
         paralelos: [],
      }

      acumulador.paralelos.push({
         paraleloId: paralelo.id,
         codigo: paralelo.codigo,
         cursoNombre: nombreCurso.get(paralelo.cursoId) ?? '',
         sesiones: fusionarTramosContiguos(
            paralelo.sesiones.map((sesion) => ({
               diaSemana: sesion.diaSemana,
               salaCodigo: sesion.salaCodigo,
               profesor: sesion.profesor,
               bloque: sesion.bloques[0]?.bloque ?? null,
            }))
         ),
      })

      porAsignatura.set(asignatura.id, acumulador)
   }

   // Orden: semestre del plan (las electivas van al final, sin importar el `semestre` que
   // tengan guardado — ese valor no tiene significado para ellas, ver AsignaturaPlan.esElectiva),
   // código de asignatura y nombre.
   const asignaturas: AsignaturaReporte[] = [...porAsignatura.values()]
      .sort(
         (a, b) =>
            Number(a.esElectiva) - Number(b.esElectiva) ||
            a.ordenSemestre - b.ordenSemestre ||
            a.codigo.localeCompare(b.codigo) ||
            a.nombre.localeCompare(b.nombre)
      )
      .map((acumulador) => ({
         asignaturaId: acumulador.asignaturaId,
         codigo: acumulador.codigo,
         nombre: acumulador.nombre,
         semestre: acumulador.ordenSemestre,
         esElectiva: acumulador.esElectiva,
         cantidadParalelos: acumulador.paralelos.length,
         paralelos: acumulador.paralelos.sort((a, b) => a.codigo.localeCompare(b.codigo)),
      }))

   return { asignaturas }
})
