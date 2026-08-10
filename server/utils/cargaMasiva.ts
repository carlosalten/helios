import { randomUUID } from 'node:crypto'
import type { TIPOS_SESION } from './sesiones.schemas'

// Carga masiva del horario de un plan a partir del CSV de programación académica que exporta
// el sistema institucional. El archivo trae todas las carreras y campus juntos: acá se filtra
// por el campus de Viña del Mar y por la carrera del plan que eligió el usuario.
//
// El flujo tiene dos pasos, ambos sobre el mismo `analizarCargaMasiva`:
//   1. validar  → solo devuelve el reporte (qué falta, qué se borraría, qué se crearía).
//   2. cargar   → vuelve a analizar y, si no hay errores, ejecuta `ejecutarCargaMasiva`.
// Analizar dos veces es barato comparado con el riesgo de ejecutar un análisis viejo: entre la
// validación y la confirmación del usuario la BD pudo cambiar (una sala borrada, un profesor
// desactivado), y el segundo análisis lo detecta.

type TipoSesion = (typeof TIPOS_SESION)[number]

// Índices 0-based de las columnas del CSV. El enunciado las numera desde 1; acá va -1.
const COLUMNA = {
   asignatura: 1, // 2  · código de asignatura
   paralelo: 4, // 5  · número de paralelo
   departamento: 5, // 6  · departamento que dicta
   campus: 6, // 7  · campus
   sala: 7, // 8  · código de sala (puede venir como "H106 (AF:28)")
   cupo: 11, // 12 · cupo del paralelo
   dia: 17, // 18 · día de la sesión
   bloqueInicio: 18, // 19 · bloque de inicio
   bloqueFin: 19, // 20 · bloque de término
   tipo: 21, // 22 · Cátedra (teoría) o Práctico (práctica)
   carrera: 23, // 24 · código de carrera
   profesor: 27, // 28 · email del profesor
} as const

const COLUMNAS_MINIMAS = COLUMNA.profesor + 1

const CAMPUS_ACEPTADO = 'VINA DEL MAR'
const DEPARTAMENTO_PROPIO = 'ELECTROTECNIA E INFORMATICA'
const UNA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000
const LOTE_INSERCION = 2000

// ============================================================
// Parseo del CSV
// ============================================================

// Quita tildes/diéresis, espacios sobrantes y pasa a mayúsculas, para comparar textos del CSV
// (campus, departamento, día, tipo) sin depender de cómo vengan escritos.
function normalizar(valor: string | undefined) {
   return (valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()
}

function contarFueraDeComillas(linea: string, delimitador: string) {
   let cuenta = 0
   let enComillas = false
   for (const caracter of linea) {
      if (caracter === '"') enComillas = !enComillas
      else if (caracter === delimitador && !enComillas) cuenta++
   }
   return cuenta
}

// El export puede venir separado por ';' (habitual en Excel es-CL) o ',': se elige el
// delimitador que más columnas produce en la primera línea con contenido.
function detectarDelimitador(texto: string) {
   const primeraLinea = texto.split(/\r?\n/).find((linea) => linea.trim().length > 0) ?? ''
   let mejor = ';'
   let mejorCuenta = -1
   for (const candidato of [';', ',', '\t', '|']) {
      const cuenta = contarFueraDeComillas(primeraLinea, candidato)
      if (cuenta > mejorCuenta) {
         mejor = candidato
         mejorCuenta = cuenta
      }
   }
   return mejor
}

// Parser CSV con soporte de campos entrecomillados (y comillas escapadas como ""), saltos de
// línea dentro de comillas y finales de línea CRLF/LF.
export function parsearCsv(texto: string): string[][] {
   const limpio = texto.replace(/^\uFEFF/, '')
   const delimitador = detectarDelimitador(limpio)

   const filas: string[][] = []
   let fila: string[] = []
   let campo = ''
   let enComillas = false

   for (let i = 0; i < limpio.length; i++) {
      const caracter = limpio[i]!
      if (enComillas) {
         if (caracter !== '"') campo += caracter
         else if (limpio[i + 1] === '"') {
            campo += '"'
            i++
         } else enComillas = false
      } else if (caracter === '"') enComillas = true
      else if (caracter === delimitador) {
         fila.push(campo)
         campo = ''
      } else if (caracter === '\n') {
         fila.push(campo)
         campo = ''
         filas.push(fila)
         fila = []
      } else if (caracter !== '\r') campo += caracter
   }
   if (campo.length > 0 || fila.length > 0) {
      fila.push(campo)
      filas.push(fila)
   }

   return filas
}

const DIAS_SEMANA: Record<string, number> = {
   L: 1,
   LU: 1,
   LUN: 1,
   LUNES: 1,
   M: 2,
   MA: 2,
   MAR: 2,
   MARTES: 2,
   MI: 3,
   MIE: 3,
   MIER: 3,
   MIERC: 3,
   MIERCOLES: 3,
   X: 3,
   W: 3,
   J: 4,
   JU: 4,
   JUE: 4,
   JUEVES: 4,
   V: 5,
   VI: 5,
   VIE: 5,
   VIERNES: 5,
   S: 6,
   SA: 6,
   SAB: 6,
   SABADO: 6,
   D: 7,
   DO: 7,
   DOM: 7,
   DOMINGO: 7,
   '1': 1,
   '2': 2,
   '3': 3,
   '4': 4,
   '5': 5,
   '6': 6,
   '7': 7,
}

function interpretarDia(valor: string) {
   return DIAS_SEMANA[normalizar(valor)] ?? null
}

function interpretarTipo(valor: string): TipoSesion | null {
   const texto = normalizar(valor)
   if (texto.includes('CATEDRA') || texto.includes('TEORIA')) return 'TEORIA'
   if (texto.includes('PRACTIC')) return 'PRACTICA'
   return null
}

// Valores de la columna de sala que no son un código real: la sesión no tiene sala asignada.
// 'SALS' y 'LABS' son los marcadores que usa el sistema institucional para eso.
const SIN_SALA = new Set(['', '-', 'SALS', 'LABS'])

// El código de sala puede traer un dato entre paréntesis que no forma parte del código
// ("H106 (AF:28)" → "H106"). Devuelve '' cuando la sesión no tiene sala.
export function limpiarCodigoSala(bruto: string) {
   const codigo = (bruto.split('(')[0] ?? '').trim()
   return SIN_SALA.has(codigo.toUpperCase()) ? '' : codigo
}

function interpretarEntero(valor: string | undefined) {
   const numero = Number.parseInt((valor ?? '').trim(), 10)
   return Number.isFinite(numero) ? numero : null
}

// ============================================================
// Tipos del análisis
// ============================================================

// Fila del CSV ya interpretada: representa un rango de bloques (bloqueInicio..bloqueFin) de
// clases de un paralelo en un día.
interface FilaHorario {
   linea: number
   asignatura: string
   paralelo: string
   departamento: string
   sala: string
   cupo: number | null
   diaSemana: number
   bloqueInicio: number
   bloqueFin: number
   tipo: TipoSesion
   profesorEmail: string
}

// Lo que el plan define para una asignatura, indexado por código. `codigoPlan` es el código
// tal como está en el plan: difiere del código del CSV cuando la fila entró por una
// equivalencia (ver AsignaturaEquivalencia en schema.prisma).
interface DatosAsignaturaPlan {
   asignaturaPlanId: number
   semestre: number
   esElectiva: boolean
   bloquesTeoria: number
   bloquesPractica: number
   codigoPlan: string
}

export interface ErrorCargaMasiva {
   titulo: string
   detalles: string[]
}

export interface ReporteCargaMasiva {
   lectura: {
      filasArchivo: number
      filasIgnoradasFormato: number
      filasOtroCampus: number
      filasOtraCarrera: number
      filasOtroTipo: number
      filasConsideradas: number
   }
   errores: ErrorCargaMasiva[]
   advertencias: string[]
   aEliminar: { cursos: number; paralelos: number; sesiones: number; reservas: number }
   aCrear: {
      cursosNuevos: string[]
      paralelos: number
      sesiones: number
      reservas: number
   }
}

interface SesionPlaneada {
   diaSemana: number
   bloqueId: number
   tipo: TipoSesion
   salaCodigo: string | null
   profesorId: number | null
}

interface ParaleloPlaneado {
   codigo: string
   cupo: number
   asignaturaCodigo: string
   asignaturaPlanId: number
   cursoNombre: string
   sesiones: SesionPlaneada[]
}

interface CursoPlaneado {
   nombre: string
   numero: number
   numeroSemestre: number
}

// Todo lo que `ejecutarCargaMasiva` necesita, ya resuelto contra la BD (ids, no códigos).
export interface EjecucionCargaMasiva {
   planId: number
   semestreId: number
   cursos: CursoPlaneado[]
   paralelos: ParaleloPlaneado[]
}

export interface AnalisisCargaMasiva {
   reporte: ReporteCargaMasiva
   // null cuando el reporte trae errores: no hay nada que ejecutar.
   ejecucion: EjecucionCargaMasiva | null
}

// Agrupación intermedia (antes de resolver a qué curso va cada paralelo).
interface ParaleloAgrupado {
   codigo: string
   // Primer código tal como vino en el CSV (para los mensajes: es lo que el usuario ve en su
   // archivo) y código de la asignatura del plan bajo la que realmente se va a guardar. Son
   // distintos cuando la asignatura entró por una equivalencia.
   asignaturaCodigo: string
   codigoPlan: string
   // Todos los códigos del CSV que cayeron en este paralelo: más de uno significa que una
   // asignatura y su equivalente traían el mismo número de paralelo y se fusionaron.
   codigosCsv: Set<string>
   cupo: number
   propio: boolean
   // Asignatura electiva en este plan (AsignaturaPlan.esElectiva): en vez de ir a un curso de
   // un semestre puntual, va a un curso "Electivos-<código>" — ver la resolución más abajo.
   esElectiva: boolean
   asignaturaPlanId: number
   semestreCurricular: number
   sesiones: SesionPlaneada[]
}

function ordenarNumerico(a: string, b: string) {
   const na = Number.parseInt(a, 10)
   const nb = Number.parseInt(b, 10)
   if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
   return a.localeCompare(b)
}

// ============================================================
// Plan y semestre destino
// ============================================================

// Resuelve y valida el destino de la carga. El alcance por carrera es el mismo que usan crear,
// editar y borrar cursos (`resolverCarrerasCursos`): la carga masiva es una mutación sobre los
// cursos del plan, así que un Jefe de Carrera solo puede correrla sobre la carrera que dirige.
export async function resolverPlanYSemestreCarga(
   usuario: { email: string; rol: string },
   planId: number,
   semestreId: number
) {
   const carrerasPermitidas = await resolverCarrerasCursos(usuario.rol, usuario.email)

   const [plan, semestre] = await Promise.all([
      prisma.plan.findUnique({ where: { id: planId }, include: { carrera: true } }),
      prisma.semestre.findUnique({ where: { id: semestreId } }),
   ])
   if (!plan) throw createError({ statusCode: 404, message: 'Plan no encontrado' })
   if (!semestre) throw createError({ statusCode: 404, message: 'Semestre no encontrado' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(plan.carreraCodigo)) {
      throw createError({ statusCode: 404, message: 'Plan no encontrado' })
   }

   return { plan, semestre }
}

// ============================================================
// Análisis
// ============================================================

export async function analizarCargaMasiva(
   csv: string,
   planId: number,
   semestreId: number,
   carreraCodigo: number
): Promise<AnalisisCargaMasiva> {
   const filasCrudas = parsearCsv(csv)

   const errores: ErrorCargaMasiva[] = []
   const advertencias: string[] = []

   /* ── Lectura y filtrado por campus + carrera ──────────────────────────── */
   const filas: FilaHorario[] = []
   const diasDesconocidos = new Set<string>()
   const tiposIgnorados = new Set<string>()
   const bloquesIlegibles: string[] = []
   let filasIgnoradasFormato = 0
   let filasOtroCampus = 0
   let filasOtraCarrera = 0
   let filasOtroTipo = 0

   filasCrudas.forEach((columnas, indice) => {
      const linea = indice + 1
      if (columnas.every((valor) => valor.trim() === '')) return

      // Cabecera y filas truncadas caen acá: sin código de carrera numérico no hay nada que leer.
      if (columnas.length < COLUMNAS_MINIMAS || interpretarEntero(columnas[COLUMNA.carrera]) === null) {
         filasIgnoradasFormato++
         return
      }
      if (normalizar(columnas[COLUMNA.campus]) !== CAMPUS_ACEPTADO) {
         filasOtroCampus++
         return
      }
      if (interpretarEntero(columnas[COLUMNA.carrera]) !== carreraCodigo) {
         filasOtraCarrera++
         return
      }

      // El horario del sistema solo modela clases de teoría y de práctica. Todo lo demás que
      // traiga el archivo (ayudantías, evaluaciones, actividades…) se descarta sin bloquear.
      const tipo = interpretarTipo(columnas[COLUMNA.tipo] ?? '')
      if (tipo === null) {
         tiposIgnorados.add((columnas[COLUMNA.tipo] ?? '').trim() || '(vacío)')
         filasOtroTipo++
         return
      }

      const diaSemana = interpretarDia(columnas[COLUMNA.dia] ?? '')
      const bloqueInicio = interpretarEntero(columnas[COLUMNA.bloqueInicio])
      const bloqueFin = interpretarEntero(columnas[COLUMNA.bloqueFin])

      if (diaSemana === null) diasDesconocidos.add((columnas[COLUMNA.dia] ?? '').trim() || '(vacío)')
      if (bloqueInicio === null || bloqueFin === null || bloqueFin < bloqueInicio) {
         bloquesIlegibles.push(
            `Línea ${linea}: "${(columnas[COLUMNA.bloqueInicio] ?? '').trim()}" a "${(columnas[COLUMNA.bloqueFin] ?? '').trim()}"`
         )
      }
      if (diaSemana === null || bloqueInicio === null || bloqueFin === null || bloqueFin < bloqueInicio) {
         return
      }

      const asignatura = (columnas[COLUMNA.asignatura] ?? '').trim()
      const paralelo = (columnas[COLUMNA.paralelo] ?? '').trim()
      if (!asignatura || !paralelo) {
         filasIgnoradasFormato++
         return
      }

      filas.push({
         linea,
         asignatura,
         paralelo,
         departamento: normalizar(columnas[COLUMNA.departamento]),
         sala: limpiarCodigoSala(columnas[COLUMNA.sala] ?? ''),
         cupo: interpretarEntero(columnas[COLUMNA.cupo]),
         diaSemana,
         bloqueInicio,
         bloqueFin,
         tipo,
         profesorEmail: (columnas[COLUMNA.profesor] ?? '').trim(),
      })
   })

   if (diasDesconocidos.size) {
      errores.push({
         titulo: 'Días de la semana que no se pudieron interpretar (columna 18)',
         detalles: [...diasDesconocidos].sort(),
      })
   }
   if (filasOtroTipo) {
      advertencias.push(
         `${filasOtroTipo} fila(s) se ignoraron por no ser Cátedra ni Práctico (columna 22): ${[...tiposIgnorados].sort().join(', ')}.`
      )
   }
   if (bloquesIlegibles.length) {
      errores.push({
         titulo: 'Rangos de bloques inválidos (columnas 19 y 20)',
         detalles: bloquesIlegibles.slice(0, 30),
      })
   }

   const lectura = {
      filasArchivo: filasCrudas.filter((f) => f.some((v) => v.trim() !== '')).length,
      filasIgnoradasFormato,
      filasOtroCampus,
      filasOtraCarrera,
      filasOtroTipo,
      filasConsideradas: filas.length,
   }

   /* ── Contraste contra la base de datos ────────────────────────────────── */
   const codigosAsignatura = [...new Set(filas.map((f) => f.asignatura))]
   const codigosSala = [...new Set(filas.map((f) => f.sala).filter(Boolean))]
   const emailsProfesor = [...new Set(filas.map((f) => f.profesorEmail).filter(Boolean))]

   const [asignaturasDelPlan, asignaturasExistentes, salas, personas, bloques, protegidos, tipoClase] =
      await Promise.all([
         prisma.asignaturaPlan.findMany({
            where: { planId },
            include: {
               asignatura: {
                  include: { equivalencias: { select: { equivalente: { select: { codigo: true } } } } },
               },
            },
         }),
         prisma.asignatura.findMany({ where: { codigo: { in: codigosAsignatura } }, select: { codigo: true } }),
         prisma.sala.findMany({ select: { codigo: true } }),
         prisma.persona.findMany({ select: { id: true, email: true, activo: true } }),
         prisma.bloque.findMany({ where: { semestreId }, select: { id: true, numero: true } }),
         prisma.bloqueProtegido.findMany({ where: { bloque: { semestreId } } }),
         prisma.tipoReserva.findFirst({ where: { nombre: 'Clase' }, select: { id: true } }),
      ])

   // Los índices comparan sin distinguir mayúsculas: el CSV no siempre respeta el casing de la BD.
   const porAsignaturaPlan = new Map<string, DatosAsignaturaPlan>(
      asignaturasDelPlan.map((ap) => [
         ap.asignatura.codigo.toUpperCase(),
         {
            asignaturaPlanId: ap.id,
            semestre: ap.semestre,
            esElectiva: ap.esElectiva,
            bloquesTeoria: ap.asignatura.bloquesTeoria,
            bloquesPractica: ap.asignatura.bloquesPractica,
            codigoPlan: ap.asignatura.codigo,
         },
      ])
   )

   // Una asignatura equivalente a una del plan (ver AsignaturaEquivalencia en schema.prisma) se
   // acepta como si fuera la del plan: sus paralelos cuelgan de la AsignaturaPlan del código que
   // sí está en el plan. Esto cubre el caso de un plan con HCW100_T al que un semestre le
   // programan HCW100. Un código que ya está en el plan por derecho propio nunca se pisa.
   const porEquivalencia = new Map<string, DatosAsignaturaPlan>()
   const equivalenciasAmbiguas = new Map<string, Set<string>>()
   for (const ap of asignaturasDelPlan) {
      const datos = porAsignaturaPlan.get(ap.asignatura.codigo.toUpperCase())!
      for (const { equivalente } of ap.asignatura.equivalencias) {
         const codigo = equivalente.codigo.toUpperCase()
         if (porAsignaturaPlan.has(codigo)) continue
         const previo = porEquivalencia.get(codigo)
         if (previo && previo.asignaturaPlanId !== datos.asignaturaPlanId) {
            // El mismo código equivale a dos asignaturas distintas de este plan: no hay forma de
            // saber a cuál corresponde el paralelo, así que se reporta en vez de elegir una.
            const conflicto = equivalenciasAmbiguas.get(codigo) ?? new Set([previo.codigoPlan])
            conflicto.add(datos.codigoPlan)
            equivalenciasAmbiguas.set(codigo, conflicto)
            continue
         }
         porEquivalencia.set(codigo, datos)
      }
   }

   // Datos de plan de un código del CSV: primero por código propio, si no por equivalencia.
   const resolverAsignaturaPlan = (codigo: string) =>
      porAsignaturaPlan.get(codigo.toUpperCase()) ?? porEquivalencia.get(codigo.toUpperCase()) ?? null

   const asignaturasEnBd = new Set(asignaturasExistentes.map((a) => a.codigo.toUpperCase()))
   const porSala = new Map(salas.map((s) => [s.codigo.toUpperCase(), s.codigo]))
   const porEmail = new Map(personas.map((p) => [p.email.toLowerCase(), p]))
   const porBloque = new Map(bloques.map((b) => [b.numero, b.id]))
   const celdasProtegidas = new Set(protegidos.map((p) => `${p.bloqueId}-${p.diaSemana}`))

   const asignaturasFaltantes = codigosAsignatura.filter((c) => !asignaturasEnBd.has(c.toUpperCase()))
   const asignaturasAmbiguas = codigosAsignatura.filter((c) => equivalenciasAmbiguas.has(c.toUpperCase()))
   const asignaturasFueraDelPlan = codigosAsignatura.filter(
      (c) =>
         asignaturasEnBd.has(c.toUpperCase()) &&
         !resolverAsignaturaPlan(c) &&
         !equivalenciasAmbiguas.has(c.toUpperCase())
   )
   const salasFaltantes = codigosSala.filter((c) => !porSala.has(c.toUpperCase()))
   const profesoresFaltantes = emailsProfesor.filter((e) => !porEmail.has(e.toLowerCase()))
   const bloquesFaltantes = [
      ...new Set(
         filas.flatMap((f) => {
            const numeros: number[] = []
            for (let n = f.bloqueInicio; n <= f.bloqueFin; n++) if (!porBloque.has(n)) numeros.push(n)
            return numeros
         })
      ),
   ].sort((a, b) => a - b)

   if (asignaturasFaltantes.length) {
      errores.push({ titulo: 'Asignaturas que no existen en el sistema', detalles: asignaturasFaltantes.sort() })
   }
   if (asignaturasFueraDelPlan.length) {
      errores.push({
         titulo: 'Asignaturas que existen pero no están asociadas al plan (ni son equivalentes a una del plan)',
         detalles: asignaturasFueraDelPlan.sort(),
      })
   }
   if (asignaturasAmbiguas.length) {
      errores.push({
         titulo: 'Asignaturas equivalentes a más de una asignatura de este plan',
         detalles: asignaturasAmbiguas
            .sort()
            .map((c) => `${c} → ${[...equivalenciasAmbiguas.get(c.toUpperCase())!].sort().join(', ')}`),
      })
   }
   if (salasFaltantes.length) {
      errores.push({ titulo: 'Salas que no existen en el sistema', detalles: salasFaltantes.sort() })
   }
   if (profesoresFaltantes.length) {
      errores.push({ titulo: 'Profesores que no existen en el sistema', detalles: profesoresFaltantes.sort() })
   }
   if (bloquesFaltantes.length) {
      errores.push({
         titulo: 'Bloques horarios que no existen en el semestre seleccionado',
         detalles: bloquesFaltantes.map((n) => `Bloque ${n}`),
      })
   }
   if (!tipoClase) {
      errores.push({
         titulo: 'Falta el tipo de reserva "Clase"',
         detalles: [
            'Créalo en Reservas → Tipos antes de cargar el horario: sin él no se pueden generar las reservas de sala.',
         ],
      })
   }

   const profesoresInactivos = emailsProfesor.filter((e) => porEmail.get(e.toLowerCase())?.activo === false)
   if (profesoresInactivos.length) {
      advertencias.push(`Profesores marcados como inactivos: ${profesoresInactivos.sort().join(', ')}.`)
   }

   // Deja constancia de qué códigos del archivo no están en el plan y entraron por equivalencia:
   // sus paralelos van a quedar guardados bajo el código del plan, no bajo el del archivo.
   const aceptadasPorEquivalencia = codigosAsignatura.filter(
      (c) => !porAsignaturaPlan.has(c.toUpperCase()) && porEquivalencia.has(c.toUpperCase())
   )
   if (aceptadasPorEquivalencia.length) {
      advertencias.push(
         `Asignaturas aceptadas por equivalencia (se cargan como la del plan): ${aceptadasPorEquivalencia
            .sort()
            .map((c) => `${c} → ${porEquivalencia.get(c.toUpperCase())!.codigoPlan}`)
            .join(', ')}.`
      )
   }

   /* ── Qué se va a eliminar ─────────────────────────────────────────────── */
   const cursosExistentes = await prisma.curso.findMany({ where: { planId, semestreId }, select: { id: true } })
   const idsCursoExistentes = cursosExistentes.map((c) => c.id)
   const paralelosExistentes = await prisma.paralelo.findMany({
      where: { cursoId: { in: idsCursoExistentes } },
      select: { id: true },
   })
   const idsParaleloExistentes = paralelosExistentes.map((p) => p.id)
   const sesionesExistentes = await prisma.sesionParalelo.findMany({
      where: { paraleloId: { in: idsParaleloExistentes } },
      select: { id: true },
   })
   const idsSesionExistentes = sesionesExistentes.map((s) => s.id)
   const reservasExistentes = await prisma.reserva.count({ where: { sesionParaleloId: { in: idsSesionExistentes } } })

   const aEliminar = {
      cursos: idsCursoExistentes.length,
      paralelos: idsParaleloExistentes.length,
      sesiones: idsSesionExistentes.length,
      reservas: reservasExistentes,
   }

   const reporteVacio: ReporteCargaMasiva = {
      lectura,
      errores,
      advertencias,
      aEliminar,
      aCrear: { cursosNuevos: [], paralelos: 0, sesiones: 0, reservas: 0 },
   }

   if (errores.length) return { reporte: reporteVacio, ejecucion: null }
   if (!filas.length) {
      errores.push({
         titulo: 'El archivo no tiene filas para esta carrera',
         detalles: [
            `Ninguna fila del CSV cumple a la vez campus "${CAMPUS_ACEPTADO}", código de carrera ${carreraCodigo} y tipo Cátedra o Práctico.`,
         ],
      })
      return { reporte: reporteVacio, ejecucion: null }
   }

   /* ── Agrupación en paralelos y expansión de los rangos de bloques ─────── */
   const agrupados = new Map<string, ParaleloAgrupado>()
   const celdasVistas = new Set<string>()
   let sesionesDuplicadas = 0

   for (const fila of filas) {
      const datosAsignatura = resolverAsignaturaPlan(fila.asignatura)!
      // Se agrupa por la asignatura *del plan*, no por el código del archivo: si el CSV trae a
      // la vez una asignatura del plan y su equivalente con el mismo número de paralelo, las dos
      // son el mismo paralelo (mismo curso, misma AsignaturaPlan) y sus sesiones se juntan en
      // vez de crear un duplicado.
      const clave = `${datosAsignatura.asignaturaPlanId}|${fila.paralelo}`

      let paralelo = agrupados.get(clave)
      if (!paralelo) {
         paralelo = {
            codigo: fila.paralelo,
            asignaturaCodigo: fila.asignatura,
            codigoPlan: datosAsignatura.codigoPlan,
            codigosCsv: new Set(),
            cupo: 0,
            propio: fila.departamento === DEPARTAMENTO_PROPIO,
            esElectiva: datosAsignatura.esElectiva,
            asignaturaPlanId: datosAsignatura.asignaturaPlanId,
            semestreCurricular: datosAsignatura.semestre,
            sesiones: [],
         }
         agrupados.set(clave, paralelo)
      }
      paralelo.codigosCsv.add(fila.asignatura.toUpperCase())
      // El cupo se repite en cada fila del paralelo; si difiere, gana el mayor.
      if (fila.cupo !== null) paralelo.cupo = Math.max(paralelo.cupo, fila.cupo)
      if (fila.departamento === DEPARTAMENTO_PROPIO) paralelo.propio = true

      const salaCodigo = fila.sala ? (porSala.get(fila.sala.toUpperCase()) ?? null) : null
      const profesorId = fila.profesorEmail ? (porEmail.get(fila.profesorEmail.toLowerCase())?.id ?? null) : null

      for (let numero = fila.bloqueInicio; numero <= fila.bloqueFin; numero++) {
         const bloqueId = porBloque.get(numero)!
         const celda = `${clave}|${fila.diaSemana}|${bloqueId}`
         if (celdasVistas.has(celda)) {
            sesionesDuplicadas++
            continue
         }
         celdasVistas.add(celda)
         paralelo.sesiones.push({ diaSemana: fila.diaSemana, bloqueId, tipo: fila.tipo, salaCodigo, profesorId })
      }
   }

   if (sesionesDuplicadas) {
      advertencias.push(
         `${sesionesDuplicadas} sesión(es) repetida(s) en el archivo (mismo paralelo, día y bloque) se ignoraron; se conservó la primera aparición.`
      )
   }

   const paralelos = [...agrupados.values()]

   for (const paralelo of paralelos) {
      if (paralelo.codigo.length > 10) {
         errores.push({
            titulo: 'Códigos de paralelo demasiado largos (máximo 10 caracteres)',
            detalles: [`${paralelo.asignaturaCodigo} · ${paralelo.codigo}`],
         })
      }
      if (paralelo.cupo > 100) {
         advertencias.push(
            `El paralelo ${paralelo.asignaturaCodigo} · ${paralelo.codigo} trae cupo ${paralelo.cupo}; se guardará como 100 (máximo permitido).`
         )
         paralelo.cupo = 100
      }
      if (paralelo.cupo < 0) paralelo.cupo = 0

      if (paralelo.codigosCsv.size > 1) {
         advertencias.push(
            `El paralelo ${paralelo.codigo} llegó con códigos equivalentes entre sí (${[...paralelo.codigosCsv].sort().join(', ')}); sus sesiones se juntaron en un solo paralelo de ${paralelo.codigoPlan}.`
         )
      }

      const datos = resolverAsignaturaPlan(paralelo.asignaturaCodigo)!
      const teoria = paralelo.sesiones.filter((s) => s.tipo === 'TEORIA').length
      const practica = paralelo.sesiones.filter((s) => s.tipo === 'PRACTICA').length
      if (teoria > datos.bloquesTeoria) {
         advertencias.push(
            `${paralelo.asignaturaCodigo} · ${paralelo.codigo}: el archivo trae ${teoria} bloques de teoría y la asignatura define ${datos.bloquesTeoria}.`
         )
      }
      if (practica > datos.bloquesPractica) {
         advertencias.push(
            `${paralelo.asignaturaCodigo} · ${paralelo.codigo}: el archivo trae ${practica} bloques de práctica y la asignatura define ${datos.bloquesPractica}.`
         )
      }
      const enProtegido = paralelo.sesiones.filter((s) => celdasProtegidas.has(`${s.bloqueId}-${s.diaSemana}`)).length
      if (enProtegido) {
         advertencias.push(
            `${paralelo.asignaturaCodigo} · ${paralelo.codigo}: ${enProtegido} sesión(es) caen en bloques protegidos; se cargan igual.`
         )
      }
   }

   if (errores.length) return { reporte: reporteVacio, ejecucion: null }

   /* ── Resolución del curso de cada paralelo ────────────────────────────── */
   const cursos = new Map<string, CursoPlaneado>()
   const planeados: ParaleloPlaneado[] = []

   // Paso 1: los paralelos no electivos del departamento crean (o reutilizan) su propio curso.
   for (const paralelo of paralelos
      .filter((p) => p.propio && !p.esElectiva)
      .sort((a, b) => ordenarNumerico(a.codigo, b.codigo))) {
      const nombre = `${paralelo.semestreCurricular}º Sem-${paralelo.codigo}`
      if (!cursos.has(nombre)) {
         const numero = Number.parseInt(paralelo.codigo, 10)
         cursos.set(nombre, {
            nombre,
            numero: Number.isFinite(numero) && numero >= 1 ? numero : 1,
            numeroSemestre: paralelo.semestreCurricular,
         })
      }
      planeados.push({
         codigo: paralelo.codigo,
         cupo: paralelo.cupo,
         asignaturaCodigo: paralelo.codigoPlan,
         asignaturaPlanId: paralelo.asignaturaPlanId,
         cursoNombre: nombre,
         sesiones: paralelo.sesiones,
      })
   }

   // Paso 2: los paralelos no electivos de otros departamentos no crean cursos; se reparten
   // entre los cursos del semestre que les toca según el plan, emparejando por orden de número
   // de paralelo.
   const cursosPorSemestre = new Map<number, CursoPlaneado[]>()
   for (const curso of cursos.values()) {
      const lista = cursosPorSemestre.get(curso.numeroSemestre) ?? []
      lista.push(curso)
      cursosPorSemestre.set(curso.numeroSemestre, lista)
   }
   for (const lista of cursosPorSemestre.values()) lista.sort((a, b) => a.numero - b.numero)

   // Agrupados por la asignatura del plan (no por el código del CSV): si una asignatura y su
   // equivalente traen paralelos distintos, todos se reparten como una sola lista entre los
   // cursos del semestre, en vez de repartirse dos veces y chocar en el mismo curso.
   const ajenosPorAsignatura = new Map<number, ParaleloAgrupado[]>()
   for (const paralelo of paralelos.filter((p) => !p.propio && !p.esElectiva)) {
      const lista = ajenosPorAsignatura.get(paralelo.asignaturaPlanId) ?? []
      lista.push(paralelo)
      ajenosPorAsignatura.set(paralelo.asignaturaPlanId, lista)
   }

   for (const lista of ajenosPorAsignatura.values()) {
      lista.sort((a, b) => ordenarNumerico(a.codigo, b.codigo))
      const semestre = lista[0]!.semestreCurricular
      const destinos = cursosPorSemestre.get(semestre) ?? []

      if (!destinos.length) {
         advertencias.push(
            `${lista[0]!.asignaturaCodigo}: no hay cursos del semestre ${semestre} (ningún paralelo de ${DEPARTAMENTO_PROPIO} los creó), así que sus ${lista.length} paralelo(s) quedaron sin cargar.`
         )
         continue
      }
      if (lista.length > destinos.length) {
         advertencias.push(
            `${lista[0]!.asignaturaCodigo}: hay ${lista.length} paralelo(s) y solo ${destinos.length} curso(s) en el semestre ${semestre}; los sobrantes se asignaron al curso ${destinos[destinos.length - 1]!.nombre}.`
         )
      }

      lista.forEach((paralelo, indice) => {
         const destino = destinos[Math.min(indice, destinos.length - 1)]!
         planeados.push({
            codigo: paralelo.codigo,
            cupo: paralelo.cupo,
            asignaturaCodigo: paralelo.codigoPlan,
            asignaturaPlanId: paralelo.asignaturaPlanId,
            cursoNombre: destino.nombre,
            sesiones: paralelo.sesiones,
         })
      })
   }

   // Paso 3: las asignaturas electivas no van a un curso de un semestre puntual (se pueden
   // dictar a estudiantes de cualquier semestre — ver AsignaturaPlan.esElectiva). Cada número de
   // paralelo electivo tiene su propio curso "Electivos-<código>", compartido entre todas las
   // asignaturas electivas que usen ese número (sea cual sea el departamento que las dicte). Va
   // al final para no contaminar con estos cursos el agrupamiento por semestre del Paso 2.
   for (const paralelo of paralelos.filter((p) => p.esElectiva).sort((a, b) => ordenarNumerico(a.codigo, b.codigo))) {
      const nombre = `Electivos-${paralelo.codigo}`
      if (!cursos.has(nombre)) {
         const numero = Number.parseInt(paralelo.codigo, 10)
         cursos.set(nombre, {
            nombre,
            numero: Number.isFinite(numero) && numero >= 1 ? numero : 1,
            // Sin semestre real: 1 es un valor de relleno (exigido por la constraint de BD) sin
            // efecto funcional, igual que en AsignaturaPlan.semestre para una electiva.
            numeroSemestre: 1,
         })
      }
      planeados.push({
         codigo: paralelo.codigo,
         cupo: paralelo.cupo,
         asignaturaCodigo: paralelo.codigoPlan,
         asignaturaPlanId: paralelo.asignaturaPlanId,
         cursoNombre: nombre,
         sesiones: paralelo.sesiones,
      })
   }

   const sesionesTotales = planeados.reduce((total, p) => total + p.sesiones.length, 0)
   const reservasEstimadas = await estimarReservas(planeados, semestreId)

   return {
      reporte: {
         lectura,
         errores,
         advertencias,
         aEliminar,
         aCrear: {
            cursosNuevos: [...cursos.keys()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
            paralelos: planeados.length,
            sesiones: sesionesTotales,
            reservas: reservasEstimadas,
         },
      },
      ejecucion: { planId, semestreId, cursos: [...cursos.values()], paralelos: planeados },
   }
}

// ============================================================
// Fechas de las reservas
// ============================================================

// Primera fecha, a partir de `desde` (inclusive), cuyo día ISO (1=lunes…7=domingo) es `diaSemana`.
function primeraFechaDelDia(desde: Date, diaSemana: number) {
   const fecha = new Date(desde)
   const diaActual = fecha.getUTCDay() === 0 ? 7 : fecha.getUTCDay()
   fecha.setUTCDate(fecha.getUTCDate() + ((diaSemana - diaActual + 7) % 7))
   return fecha
}

// Fechas de clase de cada celda (día + bloque) del semestre, ya sin los días en que un feriado
// cubre el bloque — misma regla que `regenerarReservaSesion` en reservasSesion.ts, pero
// calculada una sola vez para toda la carga en vez de una consulta por sesión.
async function calcularFechasPorCelda(semestreId: number) {
   const [semestre, bloques, feriados] = await Promise.all([
      prisma.semestre.findUniqueOrThrow({ where: { id: semestreId } }),
      prisma.bloque.findMany({ where: { semestreId }, select: { id: true, inicio: true, fin: true } }),
      prisma.feriado.findMany({ where: { semestreId } }),
   ])

   const feriadosPorFecha = new Map(feriados.map((f) => [f.fecha.getTime(), f]))
   const fechasPorDia = new Map<number, Date[]>()
   for (let dia = 1; dia <= 7; dia++) {
      const fechas: Date[] = []
      for (
         let fecha = primeraFechaDelDia(semestre.fechaInicio, dia);
         fecha <= semestre.fechaFin;
         fecha = new Date(fecha.getTime() + UNA_SEMANA_MS)
      ) {
         fechas.push(fecha)
      }
      fechasPorDia.set(dia, fechas)
   }

   const porCelda = new Map<string, Date[]>()
   const horarioBloque = new Map<number, { inicio: Date; fin: Date }>()
   for (const bloque of bloques) {
      horarioBloque.set(bloque.id, { inicio: bloque.inicio, fin: bloque.fin })
      for (let dia = 1; dia <= 7; dia++) {
         const fechas = (fechasPorDia.get(dia) ?? []).filter((fecha) => {
            const feriado = feriadosPorFecha.get(fecha.getTime())
            return !feriado || !feriadoCubreBloque(feriado, bloque)
         })
         porCelda.set(`${dia}-${bloque.id}`, fechas)
      }
   }

   return { porCelda, horarioBloque }
}

async function estimarReservas(paralelos: ParaleloPlaneado[], semestreId: number) {
   const { porCelda } = await calcularFechasPorCelda(semestreId)
   let total = 0
   for (const paralelo of paralelos) {
      for (const sesion of paralelo.sesiones) {
         if (!sesion.salaCodigo) continue
         total += porCelda.get(`${sesion.diaSemana}-${sesion.bloqueId}`)?.length ?? 0
      }
   }
   return total
}

// ============================================================
// Ejecución
// ============================================================

export interface ResultadoCargaMasiva {
   cursosCreados: number
   paralelosCreados: number
   sesionesCreadas: number
   reservasCreadas: number
   eliminados: { cursos: number; paralelos: number; sesiones: number; reservas: number }
}

export async function ejecutarCargaMasiva(ejecucion: EjecucionCargaMasiva): Promise<ResultadoCargaMasiva> {
   const { planId, semestreId } = ejecucion

   const tipoClase = await prisma.tipoReserva.findFirst({ where: { nombre: 'Clase' }, select: { id: true } })
   if (!tipoClase) {
      throw createError({
         statusCode: 422,
         message: 'No existe un tipo de reserva "Clase". Créalo en Reservas → Tipos antes de cargar el horario.',
      })
   }

   const { porCelda, horarioBloque } = await calcularFechasPorCelda(semestreId)

   // Todo en una sola transacción: si algo falla a mitad de camino, el plan queda como estaba
   // en vez de con el horario anterior borrado y el nuevo a medio cargar. El timeout es amplio
   // porque una carga real crea miles de reservas.
   return prisma.$transaction(
      async (tx) => {
         /* ── Borrado del horario anterior del plan en este semestre ──────── */
         const cursosPrevios = await tx.curso.findMany({ where: { planId, semestreId }, select: { id: true } })
         const idsCurso = cursosPrevios.map((c) => c.id)
         const paralelosPrevios = await tx.paralelo.findMany({
            where: { cursoId: { in: idsCurso } },
            select: { id: true },
         })
         const idsParalelo = paralelosPrevios.map((p) => p.id)
         const sesionesPrevias = await tx.sesionParalelo.findMany({
            where: { paraleloId: { in: idsParalelo } },
            select: { id: true },
         })
         const idsSesion = sesionesPrevias.map((s) => s.id)

         const reservasBorradas = await tx.reserva.deleteMany({ where: { sesionParaleloId: { in: idsSesion } } })
         await tx.sesionParalelo.deleteMany({ where: { id: { in: idsSesion } } })
         await tx.paralelo.deleteMany({ where: { id: { in: idsParalelo } } })
         await tx.curso.deleteMany({ where: { id: { in: idsCurso } } })

         const eliminados = {
            cursos: idsCurso.length,
            paralelos: idsParalelo.length,
            sesiones: idsSesion.length,
            reservas: reservasBorradas.count,
         }

         /* ── Cursos ───────────────────────────────────────────────────────── */
         const cursosCreados = await tx.curso.createManyAndReturn({
            data: ejecucion.cursos.map((curso) => ({
               nombre: curso.nombre,
               numero: curso.numero,
               numeroSemestre: curso.numeroSemestre,
               planId,
               semestreId,
            })),
            select: { id: true, nombre: true },
         })
         const idPorCurso = new Map(cursosCreados.map((c) => [c.nombre, c.id]))

         /* ── Paralelos ────────────────────────────────────────────────────── */
         // `orden` es la posición dentro del curso en el tablero de /paralelos/asignacion.
         const ordenPorCurso = new Map<number, number>()
         const datosParalelos = ejecucion.paralelos.map((paralelo) => {
            const cursoId = idPorCurso.get(paralelo.cursoNombre)!
            const orden = ordenPorCurso.get(cursoId) ?? 0
            ordenPorCurso.set(cursoId, orden + 1)
            return {
               codigo: paralelo.codigo,
               cupo: paralelo.cupo,
               orden,
               asignaturaPlanId: paralelo.asignaturaPlanId,
               cursoId,
            }
         })
         const paralelosCreados = await tx.paralelo.createManyAndReturn({
            data: datosParalelos,
            select: { id: true },
         })

         /* ── Sesiones ─────────────────────────────────────────────────────── */
         // `createManyAndReturn` sobre PostgreSQL devuelve las filas en el orden en que se
         // insertaron, así que la posición en el arreglo alcanza para reasociar cada sesión con
         // el paralelo y los datos que la originaron.
         const datosSesiones = ejecucion.paralelos.flatMap((paralelo, indice) =>
            paralelo.sesiones.map((sesion) => ({
               paraleloId: paralelosCreados[indice]!.id,
               diaSemana: sesion.diaSemana,
               tipo: sesion.tipo,
               salaCodigo: sesion.salaCodigo,
               profesorId: sesion.profesorId,
            }))
         )
         const contexto = ejecucion.paralelos.flatMap((paralelo) =>
            paralelo.sesiones.map((sesion) => ({ paralelo, sesion }))
         )
         const sesionesCreadas = await tx.sesionParalelo.createManyAndReturn({
            data: datosSesiones,
            select: { id: true },
         })

         await tx.sesionParaleloBloque.createMany({
            data: sesionesCreadas.map((sesion, indice) => ({
               sesionParaleloId: sesion.id,
               bloqueId: contexto[indice]!.sesion.bloqueId,
            })),
         })

         /* ── Reservas de sala (recurrentes, una serie por sesión) ─────────── */
         const datosReservas: {
            salaCodigo: string
            titulo: string
            fecha: Date
            inicio: Date
            fin: Date
            tipoReservaId: number
            personaId: number | null
            sesionParaleloId: number
            serieId: string
         }[] = []

         sesionesCreadas.forEach((creada, indice) => {
            const { paralelo, sesion } = contexto[indice]!
            if (!sesion.salaCodigo) return
            const fechas = porCelda.get(`${sesion.diaSemana}-${sesion.bloqueId}`) ?? []
            if (!fechas.length) return
            const horario = horarioBloque.get(sesion.bloqueId)!
            const serieId = randomUUID()
            const titulo = `${paralelo.asignaturaCodigo} · ${paralelo.codigo}`.slice(0, 50)
            for (const fecha of fechas) {
               datosReservas.push({
                  salaCodigo: sesion.salaCodigo,
                  titulo,
                  fecha,
                  inicio: horario.inicio,
                  fin: horario.fin,
                  tipoReservaId: tipoClase.id,
                  personaId: sesion.profesorId,
                  sesionParaleloId: creada.id,
                  serieId,
               })
            }
         })

         for (let i = 0; i < datosReservas.length; i += LOTE_INSERCION) {
            await tx.reserva.createMany({ data: datosReservas.slice(i, i + LOTE_INSERCION) })
         }

         return {
            cursosCreados: cursosCreados.length,
            paralelosCreados: paralelosCreados.length,
            sesionesCreadas: sesionesCreadas.length,
            reservasCreadas: datosReservas.length,
            eliminados,
         }
      },
      { timeout: 300_000, maxWait: 30_000 }
   )
}
