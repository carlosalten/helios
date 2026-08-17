// Ver la lista de cursos NO se acota por carrera: cualquiera con 'ver' en alguna de las rutas
// de abajo ve todos los cursos del departamento (útil, por ejemplo, para que un Jefe de
// Carrera revise cómo van otras carreras). Lo que sí queda acotado por carrera son las
// mutaciones — ver index.post.ts, [id].patch.ts y [id].delete.ts, que usan
// resolverCarrerasCursos. Además de la propia página /cursos, este endpoint lo consumen
// /horario (para armar el selector de carrera) y /paralelos y /paralelos/asignacion — un rol
// que solo tenga 'ver' en esas rutas (no en /cursos) también necesita poder pedirlo.
export default defineEventHandler(async (event) => {
   await requiereAlgunPermiso(event, [
      ['/cursos', 'ver'],
      ['/horario', 'ver'],
      ['/paralelos', 'ver'],
      ['/paralelos/asignacion', 'ver'],
   ])

   const cursos = await prisma.curso.findMany({
      orderBy: [
         { plan: { carrera: { nombre: 'asc' } } },
         { plan: { numero: 'asc' } },
         { nombre: 'asc' },
         { numero: 'asc' },
         { numeroSemestre: 'asc' },
      ],
      include: {
         plan: { include: { carrera: true } },
         semestre: true,
         paralelos: {
            select: {
               id: true,
               codigo: true,
               asignaturaPlanId: true,
               asignaturaPlan: {
                  select: {
                     asignaturaId: true,
                     asignatura: { select: { nombre: true, codigo: true, bloquesTeoria: true, bloquesPractica: true } },
                  },
               },
            },
         },
      },
   })

   if (!cursos.length) return []

   const paraleloIdsPropios = new Set(cursos.flatMap((c) => c.paralelos.map((p) => p.id)))

   // Choques de horario por sala o profesor: son recursos compartidos por todo el
   // departamento, no solo por el curso, así que dos cursos de PLANES distintos pueden
   // toparse entre sí. Por eso se buscan sobre TODAS las sesiones de los semestres
   // involucrados (sin acotar por carrera ni por curso), a diferencia del resto de datos
   // de cada paralelo (profesores, horas asignadas), que sí quedan acotados a los propios.
   const semestreIds = [...new Set(cursos.map((c) => c.semestreId))]
   const sesiones = await prisma.sesionParalelo.findMany({
      where: { paralelo: { curso: { semestreId: { in: semestreIds } } } },
      select: {
         id: true,
         diaSemana: true,
         tipo: true,
         salaCodigo: true,
         profesorId: true,
         profesor: { select: { id: true, nombre: true, apellido: true } },
         paralelo: {
            select: {
               id: true,
               codigo: true,
               cursoId: true,
               // El plan y la carrera del otro paralelo permiten separar, en /cursos, los topes
               // internos del plan de los que cruzan a otro plan (que hay que coordinar con
               // otra carrera en vez de resolver puertas adentro).
               curso: {
                  select: {
                     nombre: true,
                     semestreId: true,
                     planId: true,
                     plan: { select: { numero: true, carrera: { select: { nombreCorto: true } } } },
                  },
               },
               asignaturaPlan: {
                  select: { exentaTope: true, asignatura: { select: { nombre: true, codigo: true } } },
               },
            },
         },
         bloques: { select: { bloque: { select: { id: true, numero: true, inicio: true, fin: true } } } },
      },
   })

   type SesionResumen = {
      sesionId: number
      diaSemana: number
      bloqueId: number
      bloqueNumero: number
      bloqueInicio: string
      bloqueFin: string
      paraleloId: number
      paraleloCodigo: string
      cursoNombre: string
      planId: number
      planNumero: number
      carreraNombreCorto: string
      asignaturaNombre: string
      asignaturaCodigo: string
   }

   // Agrupa las sesiones que comparten sala/profesor en el mismo semestre, día y bloque:
   // si hay más de una, todas esas sesiones están topadas (sin importar si son del mismo
   // curso o de cursos/planes distintos).
   const porSala = new Map<string, SesionResumen[]>()
   const porProfesor = new Map<string, SesionResumen[]>()
   for (const sesion of sesiones) {
      // Exenta en /configuracion (AsignaturaPlan.exentaTope): no entra al agrupamiento, así
      // que nunca genera un tope ni aparece como "otro" en el de alguien más.
      if (sesion.paralelo.asignaturaPlan.exentaTope) continue
      const { semestreId } = sesion.paralelo.curso
      for (const { bloque } of sesion.bloques) {
         const resumen: SesionResumen = {
            sesionId: sesion.id,
            diaSemana: sesion.diaSemana,
            bloqueId: bloque.id,
            bloqueNumero: bloque.numero,
            bloqueInicio: bloque.inicio.toISOString(),
            bloqueFin: bloque.fin.toISOString(),
            paraleloId: sesion.paralelo.id,
            paraleloCodigo: sesion.paralelo.codigo,
            cursoNombre: sesion.paralelo.curso.nombre,
            planId: sesion.paralelo.curso.planId,
            planNumero: sesion.paralelo.curso.plan.numero,
            carreraNombreCorto: sesion.paralelo.curso.plan.carrera.nombreCorto,
            asignaturaNombre: sesion.paralelo.asignaturaPlan.asignatura.nombre,
            asignaturaCodigo: sesion.paralelo.asignaturaPlan.asignatura.codigo,
         }
         if (sesion.salaCodigo) {
            const clave = `${semestreId}-${sesion.diaSemana}-${bloque.id}-sala-${sesion.salaCodigo}`
            const lista = porSala.get(clave) ?? []
            lista.push(resumen)
            porSala.set(clave, lista)
         }
         if (sesion.profesorId) {
            const clave = `${semestreId}-${sesion.diaSemana}-${bloque.id}-profesor-${sesion.profesorId}`
            const lista = porProfesor.get(clave) ?? []
            lista.push(resumen)
            porProfesor.set(clave, lista)
         }
      }
   }

   type Tope = {
      diaSemana: number
      bloqueId: number
      bloqueNumero: number
      bloqueInicio: string
      bloqueFin: string
      tipo: 'sala' | 'profesor'
      recurso: string
      otros: {
         asignaturaNombre: string
         asignaturaCodigo: string
         paraleloCodigo: string
         cursoNombre: string
         planId: number
         planNumero: number
         carreraNombreCorto: string
      }[]
   }

   // Por sesión propia (de un paralelo en scope), los topes en los que participa.
   const topesPorSesion = new Map<number, Tope[]>()
   function registrarTopes(
      mapa: Map<string, SesionResumen[]>,
      tipo: 'sala' | 'profesor',
      recursoDe: (r: SesionResumen) => string
   ) {
      for (const lista of mapa.values()) {
         if (lista.length < 2) continue
         for (const propia of lista) {
            if (!paraleloIdsPropios.has(propia.paraleloId)) continue
            const otros = lista.filter((otra) => otra.sesionId !== propia.sesionId)
            const topes = topesPorSesion.get(propia.sesionId) ?? []
            topes.push({
               diaSemana: propia.diaSemana,
               bloqueId: propia.bloqueId,
               bloqueNumero: propia.bloqueNumero,
               bloqueInicio: propia.bloqueInicio,
               bloqueFin: propia.bloqueFin,
               tipo,
               recurso: recursoDe(propia),
               otros: otros.map((o) => ({
                  asignaturaNombre: o.asignaturaNombre,
                  asignaturaCodigo: o.asignaturaCodigo,
                  paraleloCodigo: o.paraleloCodigo,
                  cursoNombre: o.cursoNombre,
                  planId: o.planId,
                  planNumero: o.planNumero,
                  carreraNombreCorto: o.carreraNombreCorto,
               })),
            })
            topesPorSesion.set(propia.sesionId, topes)
         }
      }
   }

   const sesionPorId = new Map(sesiones.map((s) => [s.id, s]))
   registrarTopes(porSala, 'sala', (r) => sesionPorId.get(r.sesionId)?.salaCodigo ?? '')
   registrarTopes(porProfesor, 'profesor', (r) => {
      const profesor = sesionPorId.get(r.sesionId)?.profesor
      return profesor ? `${profesor.nombre} ${profesor.apellido}` : ''
   })

   // Agrupa las sesiones propias por paralelo, para calcular profesores asignados, horas de
   // teoría/práctica cubiertas y los topes de cada paralelo.
   const sesionesPorParalelo = new Map<number, typeof sesiones>()
   for (const sesion of sesiones) {
      if (!paraleloIdsPropios.has(sesion.paralelo.id)) continue
      const lista = sesionesPorParalelo.get(sesion.paralelo.id) ?? []
      lista.push(sesion)
      sesionesPorParalelo.set(sesion.paralelo.id, lista)
   }

   return cursos.map((curso) => {
      const paralelos = curso.paralelos.map((paralelo) => {
         const sesionesDelParalelo = sesionesPorParalelo.get(paralelo.id) ?? []

         const profesoresMap = new Map<number, { id: number; nombre: string; apellido: string }>()
         for (const sesion of sesionesDelParalelo) {
            if (sesion.profesor) profesoresMap.set(sesion.profesor.id, sesion.profesor)
         }

         const bloquesTeoriaAsignados = sesionesDelParalelo.filter((s) => s.tipo === 'TEORIA').length
         const bloquesPracticaAsignados = sesionesDelParalelo.filter((s) => s.tipo === 'PRACTICA').length
         const { bloquesTeoria: bloquesTeoriaRequeridos, bloquesPractica: bloquesPracticaRequeridos } =
            paralelo.asignaturaPlan.asignatura

         const topes = sesionesDelParalelo
            .flatMap((s) => topesPorSesion.get(s.id) ?? [])
            .sort((a, b) => a.diaSemana - b.diaSemana || a.bloqueNumero - b.bloqueNumero)

         return {
            id: paralelo.id,
            codigo: paralelo.codigo,
            asignaturaNombre: paralelo.asignaturaPlan.asignatura.nombre,
            asignaturaCodigo: paralelo.asignaturaPlan.asignatura.codigo,
            profesores: [...profesoresMap.values()].sort((a, b) => a.apellido.localeCompare(b.apellido)),
            bloquesTeoriaAsignados,
            bloquesTeoriaRequeridos,
            bloquesPracticaAsignados,
            bloquesPracticaRequeridos,
            horasCompletas:
               bloquesTeoriaAsignados >= bloquesTeoriaRequeridos &&
               bloquesPracticaAsignados >= bloquesPracticaRequeridos,
            topes,
         }
      })

      // Una asignatura "tiene profesor asignado" si TODAS sus sesiones (sumando las de
      // todos sus paralelos en este curso, cuando tiene más de uno) traen profesorId — y
      // tiene al menos una sesión creada (si no tiene ninguna, no cuenta: no hay nada
      // "asignado").
      const paralelosPorAsignatura = new Map<number, typeof curso.paralelos>()
      for (const paralelo of curso.paralelos) {
         const grupo = paralelosPorAsignatura.get(paralelo.asignaturaPlanId) ?? []
         grupo.push(paralelo)
         paralelosPorAsignatura.set(paralelo.asignaturaPlanId, grupo)
      }
      let cantidadAsignaturasConProfesor = 0
      for (const grupo of paralelosPorAsignatura.values()) {
         const sesionesAsignatura = grupo.flatMap((p) => sesionesPorParalelo.get(p.id) ?? [])
         if (sesionesAsignatura.length > 0 && sesionesAsignatura.every((s) => s.profesorId != null)) {
            cantidadAsignaturasConProfesor++
         }
      }

      return {
         ...curso,
         cantidadAsignaturas: paralelosPorAsignatura.size,
         cantidadAsignaturasConProfesor,
         cantidadParalelos: paralelos.length,
         tieneTopes: paralelos.some((p) => p.topes.length > 0),
         paralelos: paralelos.sort(
            (a, b) => a.asignaturaNombre.localeCompare(b.asignaturaNombre) || a.codigo.localeCompare(b.codigo)
         ),
      }
   })
})
