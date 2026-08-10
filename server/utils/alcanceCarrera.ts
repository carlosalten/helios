// Códigos de carrera de los que una Persona (rol 'Jefe de Carrera') es jefe, vía
// Carrera.jefePersonaId.
//
// Devuelve:
//   - null      → sin restricción (cualquier rol distinto de 'Jefe de Carrera')
//   - number[]  → códigos de carrera permitidos (puede ser [] si el email no
//                 corresponde a ninguna Persona que sea jefe de alguna carrera)
export async function resolverCarrerasJefe(rol: string, email: string): Promise<number[] | null> {
   if (rol !== 'Jefe de Carrera') return null

   const persona = await prisma.persona.findUnique({ where: { email } })
   if (!persona) return []

   const carreras = await prisma.carrera.findMany({
      where: { jefePersonaId: persona.id },
      select: { codigo: true },
   })
   return carreras.map((c) => c.codigo)
}

// Códigos de carrera a las que una Persona (rol 'Jefe de Carrera') está asociada: de las
// que es jefe (Carrera.jefePersonaId) o a las que fue asignada explícitamente
// (CarreraPersona), sin más allá del jefe único. Usado donde "ver" debe alcanzar a todas
// las carreras con las que la persona tiene alguna relación, no solo aquella que gestiona
// como jefe.
//
// Devuelve:
//   - null      → sin restricción (cualquier rol distinto de 'Jefe de Carrera')
//   - number[]  → códigos de carrera permitidos (puede ser [] si no hay ninguna)
export async function resolverCarrerasAsignadas(rol: string, email: string): Promise<number[] | null> {
   if (rol !== 'Jefe de Carrera') return null

   const persona = await prisma.persona.findUnique({ where: { email } })
   if (!persona) return []

   const [comoJefe, asignadas] = await Promise.all([
      prisma.carrera.findMany({ where: { jefePersonaId: persona.id }, select: { codigo: true } }),
      prisma.carreraPersona.findMany({ where: { personaId: persona.id }, select: { carreraCodigo: true } }),
   ])

   const codigos = new Set([...comoJefe.map((c) => c.codigo), ...asignadas.map((a) => a.carreraCodigo)])
   return Array.from(codigos)
}

// Alcance para crear/editar/borrar cursos: 'Jefe de Carrera' solo en la carrera que
// dirige (Carrera.jefePersonaId); 'Director Departamento' solo en las carreras a las que
// está asociado (CarreraPersona). 'Administrador' y el resto de roles no se restringen
// acá — el resto de roles ya queda bloqueado antes por requierePermiso (sin fila
// crear/editar/borrar en `permiso` para /cursos).
//
// Devuelve:
//   - null      → sin restricción (Administrador y roles no contemplados arriba)
//   - number[]  → códigos de carrera permitidos (puede ser [] si no hay ninguna)
export async function resolverCarrerasCursos(rol: string, email: string): Promise<number[] | null> {
   if (rol === 'Jefe de Carrera') return resolverCarrerasJefe(rol, email)
   if (rol !== 'Director Departamento') return null

   const persona = await prisma.persona.findUnique({ where: { email } })
   if (!persona) return []

   const asignadas = await prisma.carreraPersona.findMany({
      where: { personaId: persona.id },
      select: { carreraCodigo: true },
   })
   return asignadas.map((a) => a.carreraCodigo)
}
