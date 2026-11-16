// Clases conjuntas ("paralelos espejo")
//
// Una misma clase física puede estar registrada en más de un curso, incluso de carreras
// distintas: p. ej. Inglés dictado a la vez a TUINF e IBTINF, en la misma sala y con el mismo
// profesor. Cada Jefe de Carrera agenda SU paralelo; el sistema NO replica sesiones entre
// paralelos (ni dentro de una carrera ni entre carreras) y ningún JC modifica sesiones de otra
// carrera. Hasta nov. 2026 sí se replicaban por coincidencia de asignatura + código de paralelo,
// y eso copiaba sesiones a paralelos de otra carrera que no eran la misma clase (caso HCW102-T
// paralelo 300, 2027-1). No reintroducir esa replicación.
//
// Lo que sí se hace es RECONOCER la clase conjunta al leer el horario. Dos sesiones son la
// misma clase cuando coinciden en TODO esto:
//   - código de la asignatura visible: la equivalente si el paralelo se creó desde una, si no la
//     de la malla (asignaturaVisibleParalelo),
//   - código (número) de paralelo,
//   - profesor (asignado, no nulo),
//   - sala: la misma, o ninguna de las dos con sala (en planificación la sala suele asignarse al
//     final; una con sala y la otra sin sala NO son la misma clase),
//   - día y bloque.
// Se usa para no marcarlas como tope entre sí (se destacan con el color de "paralelos en más de
// un curso", preferencia de cada usuario) y para contarlas una sola vez en portada, pantalla
// pública, agenda/carga del profesor e informes. Sin profesor asignado no son la misma clase:
// cada sesión cuenta por separado.
//
// Topes: solo hay tope cuando dos sesiones de la misma celda comparten profesor y/o sala y NO
// son la misma clase. Sin profesor ni sala asignados no hay tope posible.

// Lo mínimo de un paralelo para identificar su clase.
export type ParaleloClase = {
   id: number
   codigo: string
   asignaturaPlan: { asignatura: { codigo: string } }
   asignaturaEquivalente?: { codigo: string } | null
}

// Clave de "misma clase" SIN la celda (día/bloque, fecha/hora): cada uso le agrega la parte de
// tiempo que corresponda (día + bloque en sesiones, fecha + hora en reservas). Sin profesor la
// clase solo es igual a sí misma (clave por id de paralelo, que además sirve para
// juntar los bloques contiguos de una misma clase de varias horas). Úsala siempre en vez de
// armar la clave a mano, para que todos los criterios de la app queden iguales.
export function claveClase(paralelo: ParaleloClase, profesorId: number | null, salaCodigo: string | null) {
   if (profesorId === null) return `paralelo-${paralelo.id}`
   const asignatura = asignaturaVisibleParalelo(paralelo).codigo
   // Sin sala: compatible solo con otra sesión también sin sala.
   return `conjunta|${asignatura}|${paralelo.codigo}|${profesorId}|${salaCodigo || 'sin-sala'}`
}

// Una ocurrencia de un paralelo en una celda de tiempo: `celda` es "día-bloque" para sesiones o
// "fecha-hora" para reservas — lo que haga falta para que dos ocurrencias coincidan en tiempo.
export type OcurrenciaClase = {
   paralelo: ParaleloClase
   profesorId: number | null
   salaCodigo: string | null
   celda: string
}

// Para conteos que juntan los bloques contiguos de una clase de varias horas (portada, pantalla
// pública): devuelve, para cada paralelo, el id del paralelo que representa a su clase conjunta
// (el menor id entre los paralelos con los que coincide como misma clase en alguna celda), o su
// propio id si no forma parte de ninguna. Agrupar por representante (y no por `claveClase`)
// evita partir en dos una misma clase cuyos bloques tienen asignación incompleta (p. ej. sala en
// un bloque y no en el otro).
export function representanteClaseConjunta(ocurrencias: OcurrenciaClase[]) {
   const menorPorClave = new Map<string, number>()
   const claves = ocurrencias.map((o) => {
      const clase = claveClase(o.paralelo, o.profesorId, o.salaCodigo)
      return clase.startsWith('conjunta|') ? `${clase}@${o.celda}` : null
   })
   ocurrencias.forEach((o, i) => {
      const clave = claves[i]
      if (!clave) return
      menorPorClave.set(clave, Math.min(menorPorClave.get(clave) ?? o.paralelo.id, o.paralelo.id))
   })
   const representante = new Map<number, number>()
   ocurrencias.forEach((o, i) => {
      const clave = claves[i]
      const candidato = clave ? (menorPorClave.get(clave) ?? o.paralelo.id) : o.paralelo.id
      representante.set(o.paralelo.id, Math.min(representante.get(o.paralelo.id) ?? o.paralelo.id, candidato))
   })
   return (paraleloId: number) => representante.get(paraleloId) ?? paraleloId
}
