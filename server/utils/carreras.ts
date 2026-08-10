export async function validarJefeCarrera(personaId: number) {
   const jefe = await prisma.persona.findUnique({
      where: { id: personaId },
      include: { rol: true },
   })
   if (!jefe) throw createError({ statusCode: 404, message: 'Persona no encontrada' })
   if (jefe.rol?.nombre !== 'Jefe de Carrera') {
      throw createError({ statusCode: 422, message: 'El jefe de carrera debe ser una persona con rol Profesor' })
   }
}
