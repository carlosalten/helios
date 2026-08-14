// Contraseña inicial autogenerada para un estudiante creado por carga masiva (ver
// server/api/titulaciones/estudiantes/carga-masiva.post.ts): primera letra del apellido
// paterno en mayúscula, primera letra de los nombres en mayúscula, los primeros 5 dígitos del
// RUN (la parte antes del guion) y el símbolo "#". Determinística — no pasa por
// `passwordSchema` (esa política es para contraseñas elegidas por una persona, no derivadas).
export function generarPasswordEstudiante(run: string, apellidoPaterno: string, nombres: string) {
   const digitos = run.split('-')[0]!.slice(0, 5)
   return `${apellidoPaterno.charAt(0).toUpperCase()}${nombres.charAt(0).toUpperCase()}${digitos}#`
}
