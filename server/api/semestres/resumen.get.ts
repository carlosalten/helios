import type {
   ConteoCarreraResumen,
   ModoResumenSemestres,
   ResumenSemestres,
   TarjetaSemestreResumen,
} from '~/types/semestre'

// Cantidad de cursos y paralelos del semestre vigente y del borrador, acotada según `?modo=`:
//   - Administrador: 'todas' (todo el sistema, por defecto) o 'mias' (carreras que dirige o
//     tiene asignadas).
//   - Resto de los roles: 'dirige' (Carrera.jefePersonaId, por defecto si dirige alguna) o
//     'asignadas' (CarreraPersona).
// El modo pedido se valida contra los disponibles para el rol: un no-Administrador no puede
// pedir 'todas'.

const ETIQUETAS_MODO: Record<ModoResumenSemestres, string> = {
   todas: 'Todo el sistema',
   mias: 'Mis carreras',
   dirige: 'Carreras que administro',
   asignadas: 'Carreras asignadas',
}

interface SemestreBase {
   id: number
   nombre: string
   fechaInicio: Date
   fechaFin: Date
   visible: boolean
}

async function armarTarjeta(semestre: SemestreBase, carreras: number[] | null): Promise<TarjetaSemestreResumen> {
   const [cursos, carrerasDelAlcance] = await Promise.all([
      prisma.curso.findMany({
         where: { semestreId: semestre.id, ...(carreras ? { plan: { carreraCodigo: { in: carreras } } } : {}) },
         select: {
            visible: true,
            plan: { select: { carrera: { select: { codigo: true, nombre: true } } } },
            _count: { select: { paralelos: true } },
         },
      }),
      // Con alcance acotado se listan todas sus carreras, aunque aún no tengan cursos en este
      // semestre (p. ej. el borrador recién creado).
      carreras ? prisma.carrera.findMany({ where: { codigo: { in: carreras } } }) : Promise.resolve([]),
   ])

   const porCarrera = new Map<number, ConteoCarreraResumen>()
   for (const c of carrerasDelAlcance) {
      porCarrera.set(c.codigo, { codigo: c.codigo, nombre: c.nombre, cursos: 0, cursosVisibles: 0, paralelos: 0 })
   }
   for (const curso of cursos) {
      const { codigo, nombre } = curso.plan.carrera
      const conteo = porCarrera.get(codigo) ?? { codigo, nombre, cursos: 0, cursosVisibles: 0, paralelos: 0 }
      conteo.cursos++
      if (curso.visible) conteo.cursosVisibles++
      conteo.paralelos += curso._count.paralelos
      porCarrera.set(codigo, conteo)
   }
   const listaCarreras = [...porCarrera.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))

   return {
      id: semestre.id,
      nombre: semestre.nombre,
      fechaInicio: semestre.fechaInicio.toISOString(),
      fechaFin: semestre.fechaFin.toISOString(),
      visible: semestre.visible,
      cursos: cursos.length,
      cursosVisibles: cursos.filter((c) => c.visible).length,
      paralelos: cursos.reduce((total, c) => total + c._count.paralelos, 0),
      carreras: listaCarreras,
   }
}

export default defineEventHandler(async (event): Promise<ResumenSemestres> => {
   const usuario = await requierePermiso(event, '/semestres/resumen', 'ver')
   const esAdministrador = usuario.rol === 'Administrador'

   const persona = await prisma.persona.findUnique({ where: { email: usuario.email }, select: { id: true } })
   const [dirigidas, asignadas] = persona
      ? await Promise.all([
           prisma.carrera.findMany({ where: { jefePersonaId: persona.id }, select: { codigo: true } }),
           prisma.carreraPersona.findMany({ where: { personaId: persona.id }, select: { carreraCodigo: true } }),
        ])
      : [[], []]
   const codigosDirige = dirigidas.map((c) => c.codigo)
   const codigosAsignadas = asignadas.map((a) => a.carreraCodigo)

   const modosDisponibles: ModoResumenSemestres[] = esAdministrador ? ['todas', 'mias'] : ['dirige', 'asignadas']
   const modoPedido = getQuery(event).modo
   const modo =
      modosDisponibles.find((m) => m === modoPedido) ??
      (esAdministrador ? 'todas' : codigosDirige.length ? 'dirige' : 'asignadas')

   const carreras: number[] | null =
      modo === 'todas'
         ? null
         : modo === 'mias'
           ? [...new Set([...codigosDirige, ...codigosAsignadas])]
           : modo === 'dirige'
             ? codigosDirige
             : codigosAsignadas

   const [semestreVigente, semestreBorrador] = await Promise.all([
      prisma.semestre.findFirst({ where: { vigente: true } }),
      prisma.semestre.findFirst({ where: { borrador: true } }),
   ])

   const [vigente, borrador] = await Promise.all([
      semestreVigente ? armarTarjeta(semestreVigente, carreras) : null,
      semestreBorrador ? armarTarjeta(semestreBorrador, carreras) : null,
   ])

   return {
      modo,
      opcionesModo: modosDisponibles.map((m) => ({ label: ETIQUETAS_MODO[m], value: m })),
      puedeGestionarVisibilidad: modo === 'dirige' && codigosDirige.length > 0 && borrador !== null,
      vigente,
      borrador,
   }
})
