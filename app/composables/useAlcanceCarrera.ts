// Un Jefe de Carrera ve la información de todas las carreras (cursos, paralelos, planes),
// pero solo puede crear/editar/borrar en la(s) que dirige (Carrera.jefePersonaId, ver
// resolverCarrerasJefe en el backend) — la sesión ya trae esa lista calculada al iniciar
// sesión (SesionUsuario.carrerasJefe). El resto de los roles con permiso de mutar el
// recurso (Administrador, y cualquier otro rol al que se le asigne ese permiso) no tiene
// esta restricción adicional por carrera: el backend tampoco se la aplica (ver
// resolverCarrerasJefe), así que el frontend debe reflejar exactamente lo mismo.
export function useAlcanceCarrera() {
   const { user } = useUserSession()

   function tieneAlcanceSobreCarrera(carreraCodigo: number) {
      if (user.value?.rol !== 'Jefe de Carrera') return true
      return user.value.carrerasJefe?.includes(carreraCodigo) ?? false
   }

   return { tieneAlcanceSobreCarrera }
}
