import { Prisma } from '../../../../generated/prisma/client'

export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/personas/gestion', 'borrar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const existe = await prisma.persona.findUnique({ where: { id }, include: { rol: true } })
   if (!existe) throw createError({ statusCode: 404, message: 'Persona no encontrada' })
   // Un rol inferior no puede borrar a uno superior, ni dejar el sistema sin Administrador.
   verificarJerarquiaSobre(usuario, existe.rol.jerarquia)
   await protegerUltimoAdministrador(id)

   try {
      await prisma.$transaction([
         prisma.reserva.deleteMany({ where: { personaId: id } }),
         prisma.encargadoSala.deleteMany({ where: { personaId: id } }),
         prisma.carreraPersona.deleteMany({ where: { personaId: id } }),
         prisma.persona.delete({ where: { id } }),
      ])
   } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
         throw createError({
            statusCode: 409,
            message: 'No se puede eliminar: la persona está asociada a paralelos o carreras',
         })
      }
      throw e
   }

   publicarEventoHorario({
      tipo: 'profesor',
      accion: 'borrar',
      semestreId: null,
      cursoId: null,
      descripcion: `${existe.nombre} ${existe.apellido}`,
      autorEmail: usuario.email,
      autorNombre: `${usuario.nombre} ${usuario.apellido}`,
   })

   return { ok: true }
})
