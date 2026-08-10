import type { Prisma } from '../../generated/prisma/client'

// Include común para devolver una sesión con todo lo que la UI necesita.
export const incluirSesion = {
   paralelo: {
      include: {
         asignaturaPlan: { include: { asignatura: true, plan: { include: { carrera: true } } } },
         curso: true,
      },
   },
   bloques: { include: { bloque: true } },
   sala: true,
   // omit explícito para que el tipo estático coincida con el omit global de
   // password en server/utils/prisma.ts (Prisma no lo infiere solo desde el cliente).
   profesor: { include: { rol: true }, omit: { password: true } },
} satisfies Prisma.SesionParaleloInclude

type SesionConInclude = Prisma.SesionParaleloGetPayload<{ include: typeof incluirSesion }>

// Aplana la relación many-to-many (una sola fila) a un `bloqueId`/`bloque` directo.
export function mapearSesion(sesion: SesionConInclude) {
   const { bloques, ...resto } = sesion
   const primerBloque = bloques[0]?.bloque ?? null
   return {
      ...resto,
      bloqueId: primerBloque?.id ?? null,
      bloque: primerBloque,
   }
}
