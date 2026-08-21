export type JornadaLaboral = 'COMPLETA' | 'PARCIAL'

export const JORNADAS_LABORALES: { valor: JornadaLaboral; label: string }[] = [
   { valor: 'COMPLETA', label: 'Jornada completa' },
   { valor: 'PARCIAL', label: 'Jornada parcial' },
]

export interface Rol {
   id: number
   nombre: string
   // Mayor número = más alto en la jerarquía. Ver SesionUsuario.jerarquiaRol.
   jerarquia: number
   // Si las personas de este rol aparecen en el panel "Profesores" de /horario — administrable
   // desde /configuracion. Ver app/pages/horario/index.vue.
   mostrarEnHorarioProfesores: boolean
}

export interface PersonaBase {
   id: number
   email: string
   nombre: string
   apellido: string
   activo: boolean
   rolId: number
   jornadaLaboral: JornadaLaboral | null
   rol: Rol | null
   // Nulo: sin emoji asignado. Ver SesionUsuario.emoji.
   emoji: string | null
}

export interface Persona extends PersonaBase {
   // Solo lo devuelve GET/POST /api/personas: indica si la persona tiene contraseña
   // asignada (cuenta de acceso), sin exponer nunca el hash.
   tieneContrasena: boolean
}
