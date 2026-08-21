// Alterna si las personas de un rol aparecen en el panel "Profesores" de /horario
// (Rol.mostrarEnHorarioProfesores). A diferencia del toggle de exención de topes, no hay
// alcance por carrera que chequear: los roles son globales.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/configuracion', 'editar')

   const id = Number(getRouterParam(event, 'id'))
   if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'ID inválido' })

   const rol = await prisma.rol.findUnique({ where: { id } })
   if (!rol) throw createError({ statusCode: 404, message: 'Rol no encontrado' })

   const actualizado = await prisma.rol.update({
      where: { id },
      data: { mostrarEnHorarioProfesores: !rol.mostrarEnHorarioProfesores },
      select: { mostrarEnHorarioProfesores: true },
   })

   return { mostrarEnHorarioProfesores: actualizado.mostrarEnHorarioProfesores }
})
