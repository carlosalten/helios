// Alterna si las personas de un rol ven el semestre marcado como borrador en los selectores de
// semestre aunque esté oculto (Rol.verSemestreBorrador) — ver Semestre.visible. Igual que el
// toggle de suspenderCualquierReserva, sin alcance por carrera que chequear: los roles son
// globales.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/configuracion', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const rol = await prisma.rol.findUnique({ where: { id } })
   if (!rol) throw createError({ statusCode: 404, message: 'Rol no encontrado' })

   const actualizado = await prisma.rol.update({
      where: { id },
      data: { verSemestreBorrador: !rol.verSemestreBorrador },
      select: { verSemestreBorrador: true },
   })

   return { verSemestreBorrador: actualizado.verSemestreBorrador }
})
