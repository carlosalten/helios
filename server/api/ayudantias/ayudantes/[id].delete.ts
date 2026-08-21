import { Prisma } from '../../../../generated/prisma/client'

// Borra un Ayudante. Mismo guarda que [id].patch.ts (solo personas cuyo rol actual es
// 'Ayudante') y mismo borrado en cascada que DELETE /api/personas/[id] — Reserva/EncargadoSala/
// CarreraPersona no tienen ON DELETE CASCADE, así que hay que borrarlos primero.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/ayudantias/gestion', 'borrar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.persona.findUnique({ where: { id }, include: { rol: true } })
   if (!existe || existe.rol.nombre !== 'Ayudante') {
      throw createError({ statusCode: 404, message: 'Ayudante no encontrado' })
   }

   try {
      await prisma.$transaction([
         prisma.reserva.deleteMany({ where: { personaId: id } }),
         prisma.encargadoSala.deleteMany({ where: { personaId: id } }),
         prisma.carreraPersona.deleteMany({ where: { personaId: id } }),
         prisma.persona.delete({ where: { id } }),
      ])
   } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
         throw createError({ statusCode: 409, message: 'No se puede eliminar: la persona está asociada a otros datos' })
      }
      throw e
   }

   return { ok: true }
})
