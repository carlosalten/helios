// Cantidad de bloques horarios con clases asignadas por profesor, para uno o más planes
// dentro de un semestre. Se agrupa en memoria (escala académica pequeña) sumando los
// bloques de cada sesión (`SesionParaleloBloque`) por profesor, plan, asignatura y paralelo
// (sin combinar el total de una asignatura si tiene más de un paralelo).
//
// Deduplicación: si existen varias filas `Paralelo`/`SesionParalelo` que representan la
// misma clase (misma asignatura, mismo código de paralelo, mismo día y mismo bloque —
// típicamente por datos duplicados), ese bloque se cuenta una sola vez. Por eso se agrupa
// por código de paralelo (no por su id) y se dedupe con un Set de "día-bloque".
//
// Ver NO se acota por carrera (mismo criterio que /api/cursos): se muestran los bloques de
// TODOS los planes que el usuario seleccionó en el filtro, sea o no una carrera que dirige o
// tiene asignada. Lo que sí queda acotado por carrera son las mutaciones de horario.
function normalizarIds(valor: unknown): number[] {
   const lista = Array.isArray(valor) ? valor : valor !== undefined ? [valor] : []
   return lista.map((v) => Number(v)).filter((n) => Number.isInteger(n))
}

export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/horario/profesores', 'ver')

   const query = getQuery(event)
   const semestreId = query.semestreId ? Number(query.semestreId) : undefined
   if (semestreId !== undefined && !Number.isInteger(semestreId)) {
      throw createError({ statusCode: 400, message: 'semestreId inválido' })
   }
   const planIds = normalizarIds(query.planIds)

   if (!semestreId || !planIds.length) return []

   const sesiones = await prisma.sesionParalelo.findMany({
      where: {
         profesorId: { not: null },
         paralelo: {
            curso: { semestreId },
            asignaturaPlan: { planId: { in: planIds } },
         },
      },
      select: {
         profesorId: true,
         profesor: {
            select: { id: true, nombre: true, apellido: true, jornadaLaboral: true, rol: { select: { nombre: true } } },
         },
         diaSemana: true,
         paralelo: {
            select: {
               codigo: true,
               asignaturaPlan: {
                  select: { planId: true, asignatura: { select: { id: true, nombre: true, codigo: true } } },
               },
            },
         },
         bloques: { select: { bloqueId: true } },
      },
   })

   // bloquesUnicos: claves "diaSemana-bloqueId" ya contabilizadas para ese paralelo,
   // así una misma clase duplicada en la BD no se cuenta dos veces.
   type ParaleloFila = { codigo: string; bloquesUnicos: Set<string> }
   type AsignaturaFila = { asignaturaId: number; nombre: string; codigo: string; paralelos: Map<string, ParaleloFila> }
   type PlanFila = { planId: number; bloquesUnicos: Set<string>; asignaturas: Map<number, AsignaturaFila> }
   type Fila = {
      id: number
      nombre: string
      apellido: string
      jornadaLaboral: string | null
      rol: string | null
      bloquesUnicos: Set<string>
      planes: Map<number, PlanFila>
   }

   const porProfesor = new Map<number, Fila>()
   for (const sesion of sesiones) {
      if (!sesion.profesorId || !sesion.profesor) continue
      const { rol, ...profesor } = sesion.profesor
      const fila = porProfesor.get(sesion.profesorId) ?? {
         ...profesor,
         rol: rol?.nombre ?? null,
         bloquesUnicos: new Set<string>(),
         planes: new Map<number, PlanFila>(),
      }

      const { planId, asignatura } = sesion.paralelo.asignaturaPlan
      const codigoParalelo = sesion.paralelo.codigo

      const plan = fila.planes.get(planId) ?? {
         planId,
         bloquesUnicos: new Set<string>(),
         asignaturas: new Map<number, AsignaturaFila>(),
      }
      const asignaturaFila = plan.asignaturas.get(asignatura.id) ?? {
         asignaturaId: asignatura.id,
         nombre: asignatura.nombre,
         codigo: asignatura.codigo,
         paralelos: new Map<string, ParaleloFila>(),
      }
      const paraleloFila = asignaturaFila.paralelos.get(codigoParalelo) ?? {
         codigo: codigoParalelo,
         bloquesUnicos: new Set<string>(),
      }

      // Clave global (asignatura + paralelo + día + bloque) para deduplicar en el
      // profesor y en el plan; dentro del paralelo alcanza con día + bloque.
      for (const { bloqueId } of sesion.bloques) {
         const claveGlobal = `${asignatura.id}-${codigoParalelo}-${sesion.diaSemana}-${bloqueId}`
         const claveLocal = `${sesion.diaSemana}-${bloqueId}`
         fila.bloquesUnicos.add(claveGlobal)
         plan.bloquesUnicos.add(claveGlobal)
         paraleloFila.bloquesUnicos.add(claveLocal)
      }

      asignaturaFila.paralelos.set(codigoParalelo, paraleloFila)
      plan.asignaturas.set(asignatura.id, asignaturaFila)
      fila.planes.set(planId, plan)
      porProfesor.set(sesion.profesorId, fila)
   }

   // Los topes se calculan sobre TODAS las sesiones del profesor en el semestre, sin
   // restringir por los planes seleccionados: un profesor puede tener un choque de
   // horario entre una clase de un plan seleccionado y otra de un plan que no está
   // entre los filtros, y el tope debe mostrarse igual.
   const profesorIds = [...porProfesor.keys()]
   const sesionesParaTopes = profesorIds.length
      ? await prisma.sesionParalelo.findMany({
           where: {
              profesorId: { in: profesorIds },
              paralelo: { curso: { semestreId } },
           },
           select: {
              profesorId: true,
              diaSemana: true,
              paralelo: {
                 select: {
                    codigo: true,
                    asignaturaPlan: {
                       select: { planId: true, asignatura: { select: { id: true, nombre: true, codigo: true } } },
                    },
                 },
              },
              bloques: { select: { bloque: { select: { id: true, numero: true, inicio: true, fin: true } } } },
           },
        })
      : []

   type ClaseEnTope = {
      asignaturaId: number
      asignaturaNombre: string
      asignaturaCodigo: string
      planId: number
      codigoParalelo: string
   }
   type GrupoBloque = {
      diaSemana: number
      bloqueId: number
      bloqueNumero: number
      bloqueInicio: string
      bloqueFin: string
      clases: Map<string, ClaseEnTope>
   }

   // Por cada profesor, por cada "día-bloque", las clases (asignatura+código de paralelo)
   // distintas dictadas ahí: si hay más de una, es un choque de horario.
   const gruposPorProfesor = new Map<number, Map<string, GrupoBloque>>()
   for (const sesion of sesionesParaTopes) {
      if (!sesion.profesorId) continue
      const grupos = gruposPorProfesor.get(sesion.profesorId) ?? new Map<string, GrupoBloque>()
      const { planId, asignatura } = sesion.paralelo.asignaturaPlan
      const codigoParalelo = sesion.paralelo.codigo
      const claveClase = `${asignatura.id}-${codigoParalelo}`

      for (const { bloque } of sesion.bloques) {
         const claveLocal = `${sesion.diaSemana}-${bloque.id}`
         const grupo = grupos.get(claveLocal) ?? {
            diaSemana: sesion.diaSemana,
            bloqueId: bloque.id,
            bloqueNumero: bloque.numero,
            bloqueInicio: bloque.inicio.toISOString(),
            bloqueFin: bloque.fin.toISOString(),
            clases: new Map<string, ClaseEnTope>(),
         }
         grupo.clases.set(claveClase, {
            asignaturaId: asignatura.id,
            asignaturaNombre: asignatura.nombre,
            asignaturaCodigo: asignatura.codigo,
            planId,
            codigoParalelo,
         })
         grupos.set(claveLocal, grupo)
      }
      gruposPorProfesor.set(sesion.profesorId, grupos)
   }

   function topesDe(profesorId: number) {
      const grupos = gruposPorProfesor.get(profesorId)
      if (!grupos) return []
      return [...grupos.values()]
         .filter((grupo) => grupo.clases.size > 1)
         .map((grupo) => ({ ...grupo, clases: [...grupo.clases.values()] }))
         .sort((a, b) => a.diaSemana - b.diaSemana || a.bloqueNumero - b.bloqueNumero)
   }

   return [...porProfesor.entries()]
      .map(([profesorId, { planes, bloquesUnicos, ...resto }]) => ({
         ...resto,
         cantidadBloques: bloquesUnicos.size,
         topes: topesDe(profesorId),
         bloquesPorPlan: [...planes.values()].map((plan) => ({
            planId: plan.planId,
            cantidadBloques: plan.bloquesUnicos.size,
            asignaturas: [...plan.asignaturas.values()]
               .map((asig) => ({
                  asignaturaId: asig.asignaturaId,
                  nombre: asig.nombre,
                  codigo: asig.codigo,
                  paralelos: [...asig.paralelos.values()]
                     .map((p) => ({ codigo: p.codigo, cantidadBloques: p.bloquesUnicos.size }))
                     .sort((a, b) => a.codigo.localeCompare(b.codigo)),
               }))
               .sort((a, b) => a.nombre.localeCompare(b.nombre)),
         })),
      }))
      .sort((a, b) => a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre))
})
