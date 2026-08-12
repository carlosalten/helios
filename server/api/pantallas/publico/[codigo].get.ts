// Endpoint PÚBLICO — sin sesión ni permiso — a propósito: alimenta la pantalla física
// /pantallas/<codigo> que se instala en un hall o pasillo, sin que nadie inicie sesión ahí.
// Solo GET, de solo lectura. No se valida `requierePermiso` ni se acota por CSRF
// (server/middleware/origen.ts solo protege métodos que mutan). Por eso el código es lo único
// que actúa como "llave" de la pantalla — ver pantallasPublicas.schemas.ts para el formato
// aceptado.
//
// Muestra qué clases están EN CURSO y cuáles están PRÓXIMAS A INICIAR (hoy) en las salas de la
// pantalla — no el horario completo de la semana: es una pantalla de "estado actual", como un
// tótem de aeropuerto. Solo reservas de una sesión de clases (`sesionParaleloId` no nulo):
// ayudantías/reuniones sueltas no traen carrera/asignatura/paralelo, que es lo que se muestra.
function aHora(hora: Date) {
   return hora.toISOString().slice(11, 16)
}

interface ClaseResumen {
   id: number
   salaCodigo: string
   carreraNombre: string
   asignaturaCodigo: string
   asignaturaNombre: string
   paraleloCodigo: string
   inicio: string
   fin: string
   profesor: string | null
   color: string | null
}

export default defineEventHandler(async (event) => {
   const codigo = getRouterParam(event, 'codigo')
   if (!codigo) throw createError({ statusCode: 400, message: 'Código inválido' })

   const pantalla = await prisma.pantallaPublica.findUnique({
      where: { codigo },
      include: { salas: true },
   })
   if (!pantalla) throw createError({ statusCode: 404, message: 'Pantalla no encontrada' })

   const respuestaBase = {
      pantalla: { nombre: pantalla.nombre, codigo: pantalla.codigo, segundosPorSlide: pantalla.segundosPorSlide },
   }

   const salaCodigos = pantalla.salas.map((ps) => ps.salaCodigo)
   if (!salaCodigos.length) return { ...respuestaBase, hoy: null, enCurso: [], proximas: [] }

   // Reloj y fecha del SERVIDOR: a diferencia de /dashboard o /reservas/horario, acá no hay una
   // persona logueada cuyo huso horario importe — es una pantalla física fija, así que "hoy" y
   // "ahora" son los del servidor (se asume misma zona horaria que la institución, igual que el
   // resto de las horas de la app: bloques y reservas se guardan como hora de pared, sin
   // conversión de huso). `getHours`/`getMonth` (locales, no UTC) para que calcen con cómo
   // Bloque/Reserva.inicio se leen ya en server/api/dashboard.get.ts y compañía.
   const ahora = new Date()
   const hoyISO = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
   const hoy = new Date(`${hoyISO}T00:00:00.000Z`)
   const ahoraHHMM = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`

   const reservas = await prisma.reserva.findMany({
      where: { salaCodigo: { in: salaCodigos }, fecha: hoy, sesionParaleloId: { not: null } },
      include: {
         persona: { select: { nombre: true, apellido: true } },
         sesionParalelo: {
            include: {
               paralelo: {
                  include: { asignaturaPlan: { include: { asignatura: true, plan: { include: { carrera: true } } } } },
               },
            },
         },
      },
      orderBy: { inicio: 'asc' },
   })

   // El mismo paralelo dictado en otro curso (ver server/utils/sesionesEspejo.ts) genera una
   // reserva por curso sobre la MISMA sala a la misma hora — es una sola clase física. Se
   // deduplica por sala+asignatura+paralelo+inicio, mismo criterio que /api/dashboard.
   const vistas = new Set<string>()
   const enCurso: ClaseResumen[] = []
   const proximas: ClaseResumen[] = []

   for (const r of reservas) {
      const sesion = r.sesionParalelo
      if (!sesion) continue
      const { paralelo } = sesion
      const inicio = aHora(r.inicio)
      const fin = aHora(r.fin)

      const clave = `${r.salaCodigo}-${paralelo.asignaturaPlan.asignaturaId}-${paralelo.codigo}-${inicio}`
      if (vistas.has(clave)) continue
      vistas.add(clave)

      const resumen: ClaseResumen = {
         id: r.id,
         salaCodigo: r.salaCodigo,
         carreraNombre: paralelo.asignaturaPlan.plan.carrera.nombre,
         asignaturaCodigo: paralelo.asignaturaPlan.asignatura.codigo,
         asignaturaNombre: paralelo.asignaturaPlan.asignatura.nombre,
         paraleloCodigo: paralelo.codigo,
         inicio,
         fin,
         profesor: r.persona ? `${r.persona.nombre} ${r.persona.apellido}` : null,
         color: paralelo.color,
      }

      if (inicio <= ahoraHHMM && fin > ahoraHHMM) enCurso.push(resumen)
      else if (inicio > ahoraHHMM) proximas.push(resumen)
   }

   const porInicioYSala = (a: ClaseResumen, b: ClaseResumen) =>
      a.inicio.localeCompare(b.inicio) || a.salaCodigo.localeCompare(b.salaCodigo)
   enCurso.sort(porInicioYSala)
   proximas.sort(porInicioYSala)

   return { ...respuestaBase, hoy: hoyISO, enCurso, proximas }
})
