// Guardias compartidos para la gestión de cuentas de otras personas (cambiar contraseña,
// cambiar rol, activar/bloquear, borrar). Centralizan las dos invariantes de seguridad que
// deben cumplir TODOS esos endpoints, para que ninguno las olvide:
//
//   1. Jerarquía: un usuario solo puede gestionar a personas cuyo rol tenga jerarquía menor o
//      igual a la suya (Rol.jerarquia). Sin esto, un rol inferior con el permiso fino
//      'contrasena'/'activar'/'borrar' podía tomar o bloquear la cuenta de un Administrador.
//   2. Último Administrador: bloquear, borrar o degradar al único Administrador activo se
//      rechaza, para no dejar el sistema sin superusuario.
//
// El Administrador tiene bypass de la regla de jerarquía (igual que en requierePermiso).

interface UsuarioGestor {
   rol: string
   jerarquiaRol: number
}

// Rechaza (403) si `objetivoJerarquia` supera la jerarquía del usuario. Administrador exento.
export function verificarJerarquiaSobre(usuario: UsuarioGestor, objetivoJerarquia: number) {
   if (usuario.rol === 'Administrador') return
   if (objetivoJerarquia > usuario.jerarquiaRol) {
      throw createError({
         statusCode: 403,
         message: 'No puedes gestionar a una persona de mayor jerarquía que la tuya',
      })
   }
}

// Rechaza (409) si la acción dejaría al sistema sin ningún Administrador activo. Se llama
// antes de bloquear, borrar o degradar a `personaId` — solo actúa si esa persona es un
// Administrador activo y es el último que queda.
export async function protegerUltimoAdministrador(personaId: number) {
   const persona = await prisma.persona.findUnique({ where: { id: personaId }, include: { rol: true } })
   if (!persona || !persona.activo || persona.rol.nombre !== 'Administrador') return

   const administradoresActivos = await prisma.persona.count({
      where: { activo: true, rol: { nombre: 'Administrador' } },
   })
   if (administradoresActivos <= 1) {
      throw createError({ statusCode: 409, message: 'No se puede dejar el sistema sin un Administrador activo' })
   }
}
