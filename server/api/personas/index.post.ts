export default defineEventHandler(async (event) => {
   const usuario = await requierePermiso(event, '/personas/gestion', 'crear')

   const body = await readBody(event)
   const parsed = crearPersonaSchema.safeParse(body)
   if (!parsed.success)
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })

   const existe = await prisma.persona.findUnique({ where: { email: parsed.data.email } })
   if (existe) throw createError({ statusCode: 409, message: 'Ya existe una persona con ese email' })

   const rol = await prisma.rol.findUnique({ where: { id: parsed.data.rolId } })
   if (!rol) throw createError({ statusCode: 404, message: 'Rol no encontrado' })
   // Solo se pueden asignar roles de jerarquía igual o menor a la propia. Administrador
   // tiene bypass total, igual que en requierePermiso.
   if (usuario.rol !== 'Administrador' && rol.jerarquia > usuario.jerarquiaRol) {
      throw createError({ statusCode: 403, message: 'No puedes asignar un rol de mayor jerarquía que el tuyo' })
   }

   const persona = await prisma.persona.create({
      data: { ...parsed.data, activo: true },
      include: { rol: true },
   })

   // La persona aparece en el panel de profesores de /horario, desde donde se arrastra
   // sobre una sesión: recurso global, sin semestre ni curso asociado.
   publicarEventoHorario({
      tipo: 'profesor',
      accion: 'crear',
      semestreId: null,
      cursoId: null,
      descripcion: `${persona.nombre} ${persona.apellido}`,
      autorEmail: usuario.email,
      autorNombre: `${usuario.nombre} ${usuario.apellido}`,
   })

   return { ...persona, tieneContrasena: false }
})
