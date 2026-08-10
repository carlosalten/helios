// Ocupación de salas y profesores del semestre, sin acotar por carrerasPermitidas: ambos
// son recursos compartidos del departamento (una sala o un profesor no pueden estar en dos
// sesiones a la vez), así que detectar choques de horario (mismo recurso + día + bloque)
// debe ver las sesiones de todas las carreras, no solo las del Jefe de Carrera que
// consulta. Solo exige sesión + permiso de ver /horario, igual que el resto.
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/horario', 'ver')

   const query = getQuery(event)
   const semestreId = query.semestreId ? Number(query.semestreId) : undefined
   if (semestreId !== undefined && !Number.isInteger(semestreId)) {
      throw createError({ statusCode: 400, message: 'semestreId inválido' })
   }

   const sesiones = await prisma.sesionParalelo.findMany({
      where: {
         OR: [{ salaCodigo: { not: null } }, { profesorId: { not: null } }],
         ...(semestreId !== undefined && { paralelo: { curso: { semestreId } } }),
      },
      include: incluirSesion,
   })

   return sesiones.map(mapearSesion)
})
