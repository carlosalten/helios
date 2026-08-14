// Permisos del usuario logueado para una ruta dada. 'Administrador' tiene bypass total
// (no se guarda como fila en `permiso`); el resto depende de sus permisos de sesión.
export function usePermiso(ruta: string) {
   const { user } = useUserSession()

   function tienePermiso(accion: string) {
      if (user.value?.rol === 'Administrador') return true
      return user.value?.permisos?.some((p) => p.ruta === ruta && p.acciones.includes(accion)) ?? false
   }

   return {
      puedeVer: computed(() => tienePermiso('ver')),
      puedeCrear: computed(() => tienePermiso('crear')),
      puedeEditar: computed(() => tienePermiso('editar')),
      puedeBorrar: computed(() => tienePermiso('borrar')),
      tienePermiso,
   }
}
