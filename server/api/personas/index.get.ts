// La lista de personas la consume /personas/gestion (para administrarlas) y, de solo
// lectura, otras páginas que necesitan poblar un selector de persona: /carreras (elegir
// jefe de carrera), /horario y /horario/profesor (elegir profesor) y /reservas/horario
// (elegir responsable de una reserva). El hash de la contraseña nunca sale de acá (se pide
// solo para calcular `tieneContrasena` y se descarta antes de responder), así que ampliar el
// acceso de lectura no expone nada más sensible de lo que ya se ve en el resto de la app.
export default defineEventHandler(async (event) => {
   await requiereAlgunPermiso(event, [
      ['/personas/gestion', 'ver'],
      ['/carreras', 'ver'],
      ['/horario', 'ver'],
      ['/horario/profesor', 'ver'],
      ['/reservas/horario', 'ver'],
   ])

   const personas = await prisma.persona.findMany({
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      include: { rol: true },
      omit: { password: false },
   })

   return personas.map(({ password, ...persona }) => ({ ...persona, tieneContrasena: password != null }))
})
