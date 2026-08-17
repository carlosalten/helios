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

// Alcance para VER el horario (`/horario`): 'Administrador' y 'Jefe de Carrera' ven el de
// todas las carreras (un Jefe de Carrera puede revisar cómo va otra, igual que con /paralelos,
// /cursos, /planes y /carreras — ver useAlcanceCarrera.ts). El resto de los roles con permiso
// de ver /horario (Director Departamento, Profesor, Apoyo Docente, Funcionario, Externo, o
// cualquier rol nuevo) solo ve las carreras que dirige (Carrera.jefePersonaId) o a las que fue
// asignado explícitamente (CarreraPersona) — mismo criterio que el alcance "personal" del
// dashboard (ver resolverAlcanceDashboard).
//
// Devuelve:
//   - null      → sin restricción (Administrador, Jefe de Carrera)
//   - number[]  → códigos de carrera permitidos (puede ser [] si no hay ninguna)
export async function resolverCarrerasAsignadas(rol: string, email: string): Promise<number[] | null> {
   if (rol === 'Administrador' || rol === 'Jefe de Carrera') return null

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
