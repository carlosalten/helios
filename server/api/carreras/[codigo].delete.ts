export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/carreras', 'borrar')
   const carrerasPermitidas = await resolverCarrerasJefe(usuario.rol, usuario.email)

   const codigo = Number(getRouterParam(event, 'codigo'))
   if (!Number.isInteger(codigo)) throw createError({ statusCode: 400, message: 'Código inválido' })

   const existe = await prisma.carrera.findUnique({ where: { codigo } })
   if (!existe) throw createError({ statusCode: 404, message: 'Carrera no encontrada' })
   if (carrerasPermitidas && !carrerasPermitidas.includes(codigo)) {
      throw createError({ statusCode: 404, message: 'Carrera no encontrada' })
   }

   const tienePlanes = await prisma.plan.findFirst({ where: { carreraCodigo: codigo } })
   if (tienePlanes) {
      throw createError({ statusCode: 409, message: 'No se puede eliminar: la carrera tiene planes asociados' })
   }

   await prisma.carrera.delete({ where: { codigo } })
   return { ok: true }
})
