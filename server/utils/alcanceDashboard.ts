// Alcance de la portada (`/`). Hay dos formas del dashboard:
//
//  - 'global'   — indicadores de todo el sistema. Solo el Administrador lo ve.
//  - 'personal' — acotado a las carreras y salas con las que la persona tiene relación.
//                 Lo usan todos los demás roles (Director Departamento, Jefe de Carrera,
//                 Apoyo Docente, Funcionario, Profesor, Externo).
//
// El Administrador arranca en 'global' pero puede cambiarse a 'personal' (`?modo=personal`)
// para ver la portada tal como la ve un Director de Departamento. Nadie más puede pedir
// 'global': el modo no se toma del cliente sin validar contra el rol.
//
// Las carreras del alcance personal son la UNIÓN de las que la persona dirige
// (Carrera.jefePersonaId) y las que tiene asignadas (CarreraPersona) — mismo criterio que
// `resolverCarrerasAsignadas`, pero aplicado a cualquier rol y no solo a 'Jefe de Carrera'.
// Un Jefe de Carrera ve así las carreras que administra (marcadas con `esJefe`) sin quedarse
// con la portada en blanco si además está asignado a otra.

export type ModoDashboard = 'global' | 'personal'

export interface AlcanceDashboard {
   modo: ModoDashboard
   // Si el usuario puede alternar entre ambas formas (solo el Administrador).
   puedeCambiarModo: boolean
   personaId: number | null
   // `null` = sin restricción (modo global). En modo personal siempre es una lista, que puede
   // ser vacía si la persona no tiene ninguna asociación.
   carreras: number[] | null
   salas: string[] | null
   // Códigos de las carreras que la persona dirige, para distinguirlas de las asignadas.
   carrerasQueDirige: number[]
   // Salas a cargo de la persona (EncargadoSala) SIEMPRE, sin importar el modo: a diferencia
   // de `salas`, esto no acota los indicadores sino que alimenta la sección de próximas clases,
   // que es personal incluso en la portada global del Administrador.
   salasACargo: string[]
}

export async function resolverAlcanceDashboard(
   usuario: { email: string; rol: string },
   modoPedido: string | undefined
): Promise<AlcanceDashboard> {
   const esAdministrador = usuario.rol === 'Administrador'
   const modo: ModoDashboard = esAdministrador && modoPedido !== 'personal' ? 'global' : 'personal'

   const persona = await prisma.persona.findUnique({ where: { email: usuario.email }, select: { id: true } })
   const personaId = persona?.id ?? null

   if (!personaId) {
      return {
         modo,
         puedeCambiarModo: esAdministrador,
         personaId,
         carreras: modo === 'global' ? null : [],
         salas: modo === 'global' ? null : [],
         carrerasQueDirige: [],
         salasACargo: [],
      }
   }

   const [comoJefe, asignadas, encargado] = await Promise.all([
      prisma.carrera.findMany({ where: { jefePersonaId: personaId }, select: { codigo: true } }),
      prisma.carreraPersona.findMany({ where: { personaId }, select: { carreraCodigo: true } }),
      prisma.encargadoSala.findMany({ where: { personaId }, select: { salaCodigo: true } }),
   ])

   const carrerasQueDirige = comoJefe.map((c) => c.codigo)
   const carreras = [...new Set([...carrerasQueDirige, ...asignadas.map((a) => a.carreraCodigo)])]
   const salasACargo = encargado.map((e) => e.salaCodigo)

   return {
      modo,
      puedeCambiarModo: esAdministrador,
      personaId,
      // En modo global los indicadores no se acotan, pero las salas a cargo se resuelven igual
      // para la sección de próximas clases.
      carreras: modo === 'global' ? null : carreras,
      salas: modo === 'global' ? null : salasACargo,
      carrerasQueDirige: modo === 'global' ? [] : carrerasQueDirige,
      salasACargo,
   }
}
