// Alta de un Ayudante desde /ayudantias/gestion. A diferencia de POST /api/personas
// (server/api/personas/index.post.ts), acá el rol NUNCA lo elige quien llena el formulario:
// siempre queda fijo en 'Ayudante', para que este permiso (más acotado que
// /personas/gestion) no sirva para crear personas con cualquier otro rol.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/ayudantias/gestion', 'crear')

   const body = await readBody(event)
   const parsed = crearAyudanteSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   const existe = await prisma.persona.findUnique({ where: { email: parsed.data.email } })
   if (existe) throw createError({ statusCode: 409, message: 'Ya existe una persona con ese email' })

   const rolAyudante = await prisma.rol.findFirst({ where: { nombre: 'Ayudante' } })
   if (!rolAyudante)
      throw createError({ statusCode: 409, message: 'No existe el rol Ayudante — créalo en /personas/tipos' })

   const persona = await prisma.persona.create({
      data: { ...parsed.data, rolId: rolAyudante.id, activo: true },
      include: { rol: true },
   })

   return { ...persona, tieneContrasena: false }
})
