import type { TIPOS_SESION } from './sesiones.schemas'

// Un mismo paralelo (misma asignatura, mismo código de paralelo y mismo semestre) puede estar
// repetido en varios cursos: es la misma clase física dictada a más de una cohorte/plan. Por
// eso sus sesiones tienen que ser idénticas —misma sala, profesor, día y bloque— y toda alta,
// asignación, movimiento o baja se replica en las copias. Como cada sesión genera su propia
// reserva de sala (ver reservasSesion.ts), replicar la sesión arrastra también su reserva.
//
// La copia de una sesión se identifica por su celda: (tipo, diaSemana, bloqueId). Si los
// paralelos están sincronizados, cada sesión tiene su gemela justo ahí. Un paralelo que quedó
// desincronizado (datos anteriores a esta regla) simplemente no tiene gemela y se omite en vez
// de hacer fallar la operación del usuario sobre el paralelo que sí eligió.

type TipoSesion = (typeof TIPOS_SESION)[number]

// Lo mínimo para reconocer "el mismo paralelo" en otro curso.
export type ParaleloIdentidad = {
   id: number
   codigo: string
   curso: { semestreId: number }
   asignaturaPlan: { asignatura: { codigo: string } }
}

// Celda de la matriz de horario que ocupa una sesión.
type CeldaSesion = {
   tipo: TipoSesion
   diaSemana: number
   bloqueId: number
}

export function paralelosEspejoDe(paralelo: ParaleloIdentidad) {
   return prisma.paralelo.findMany({
      where: {
         id: { not: paralelo.id },
         codigo: paralelo.codigo,
         curso: { semestreId: paralelo.curso.semestreId },
         asignaturaPlan: { asignatura: { codigo: paralelo.asignaturaPlan.asignatura.codigo } },
      },
      select: { id: true },
   })
}

function buscarSesionEnCelda(paraleloId: number, celda: CeldaSesion) {
   return prisma.sesionParalelo.findFirst({
      where: {
         paraleloId,
         tipo: celda.tipo,
         diaSemana: celda.diaSemana,
         bloques: { some: { bloqueId: celda.bloqueId } },
      },
   })
}

// Un paralelo no puede tener dos sesiones en la misma celda, sea cual sea su tipo — es la misma
// regla que aplica POST /api/sesiones. Ojo: acá el tipo NO entra en la búsqueda, a diferencia de
// `buscarSesionEnCelda`, que sí lo usa para reconocer a la gemela de una sesión concreta.
function celdaOcupada(paraleloId: number, diaSemana: number, bloqueId: number, exceptoId?: number) {
   return prisma.sesionParalelo.findFirst({
      where: {
         paraleloId,
         diaSemana,
         bloques: { some: { bloqueId } },
         ...(exceptoId !== undefined && { NOT: { id: exceptoId } }),
      },
   })
}

// Alta: crea la misma sesión en cada paralelo espejo. Si el espejo ya tiene una sesión en esa
// celda, se deja como está (la replicación es idempotente). La sesión nace sin sala ni
// profesor, así que todavía no hay reserva que generar.
export async function replicarCrearSesion(paralelo: ParaleloIdentidad, celda: CeldaSesion) {
   for (const espejo of await paralelosEspejoDe(paralelo)) {
      if (await celdaOcupada(espejo.id, celda.diaSemana, celda.bloqueId)) continue
      await prisma.sesionParalelo.create({
         data: {
            paraleloId: espejo.id,
            diaSemana: celda.diaSemana,
            tipo: celda.tipo,
            bloques: { create: { bloqueId: celda.bloqueId } },
         },
      })
   }
}

// Asignar/quitar sala o profesor: la gemela queda en la misma celda, solo cambian sus datos.
// Como comparten asignatura y código de paralelo, el título de la reserva es el mismo, igual
// que el bloque y el semestre: se reusan los de la sesión de origen.
export async function replicarAsignarSesion(
   paralelo: ParaleloIdentidad,
   celda: CeldaSesion,
   datos: { salaCodigo: string | null; profesorId: number | null },
   bloque: { inicio: Date; fin: Date },
   semestre: { id: number; fechaInicio: Date; fechaFin: Date },
   titulo: string,
   hoy: Date
) {
   for (const espejo of await paralelosEspejoDe(paralelo)) {
      const gemela = await buscarSesionEnCelda(espejo.id, celda)
      if (!gemela) continue
      const actualizada = await prisma.sesionParalelo.update({ where: { id: gemela.id }, data: datos })
      await regenerarReservaSesion(actualizada, bloque, semestre, titulo, actualizada.profesorId, hoy)
   }
}

// Mover a otro día/bloque: la gemela se busca en la celda ANTERIOR (la de origen ya se movió)
// y se manda a la nueva. Si el espejo ya tiene otra sesión ocupando la celda destino, se omite:
// mover la gemela ahí dejaría dos sesiones del mismo paralelo en la misma celda.
export async function replicarMoverSesion(
   paralelo: ParaleloIdentidad,
   celdaAnterior: CeldaSesion,
   celdaNueva: { diaSemana: number; bloqueId: number },
   bloque: { inicio: Date; fin: Date },
   semestre: { id: number; fechaInicio: Date; fechaFin: Date },
   titulo: string,
   hoy: Date
) {
   for (const espejo of await paralelosEspejoDe(paralelo)) {
      const gemela = await buscarSesionEnCelda(espejo.id, celdaAnterior)
      if (!gemela) continue

      if (await celdaOcupada(espejo.id, celdaNueva.diaSemana, celdaNueva.bloqueId, gemela.id)) continue

      const actualizada = await prisma.$transaction(async (tx) => {
         await tx.sesionParaleloBloque.deleteMany({ where: { sesionParaleloId: gemela.id } })
         await tx.sesionParaleloBloque.create({
            data: { sesionParaleloId: gemela.id, bloqueId: celdaNueva.bloqueId },
         })
         return tx.sesionParalelo.update({
            where: { id: gemela.id },
            data: { diaSemana: celdaNueva.diaSemana },
         })
      })

      if (actualizada.salaCodigo) {
         await regenerarReservaSesion(actualizada, bloque, semestre, titulo, actualizada.profesorId, hoy)
      }
   }
}

// Baja: borra la gemela y, como en el endpoint de borrado, la parte de su reserva de sala que
// todavía no ocurrió (no cae en cascada) — la que ya ocurrió queda como registro histórico.
export async function replicarBorrarSesion(paralelo: ParaleloIdentidad, celda: CeldaSesion, hoy: Date) {
   for (const espejo of await paralelosEspejoDe(paralelo)) {
      const gemela = await buscarSesionEnCelda(espejo.id, celda)
      if (!gemela) continue
      await prisma.$transaction([
         prisma.reserva.deleteMany({ where: { sesionParaleloId: gemela.id, fecha: { gte: hoy } } }),
         prisma.sesionParalelo.delete({ where: { id: gemela.id } }),
      ])
   }
}
