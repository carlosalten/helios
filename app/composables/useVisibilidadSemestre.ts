import type { Semestre } from '~/types/semestre'

// Un semestre con `visible = false` queda fuera de los selectores internos (cursos, bloques
// horarios, feriados, horario, paralelos, copiar bloques) — salvo que esté marcado como
// `borrador` y la persona pertenezca a un rol con `Rol.verSemestreBorrador` (administrable
// desde /configuracion). 'Administrador' lo ve siempre, igual que /semestres, que nunca filtra
// por `visible`.
export function useVisibilidadSemestre() {
   const { user } = useUserSession()

   const puedeVerSemestreBorrador = computed(
      () => user.value?.rol === 'Administrador' || !!user.value?.puedeVerSemestreBorrador
   )

   function esSemestreSeleccionable(semestre: Semestre) {
      return semestre.visible || (semestre.borrador && puedeVerSemestreBorrador.value)
   }

   // Semestre que preseleccionan los selectores según la preferencia de la persona
   // (SesionUsuario.semestrePorDefecto, elegida en /semestres): el borrador si lo eligió y es
   // seleccionable para ella; si no, el vigente.
   function semestrePorDefecto(semestres: Semestre[]): Semestre | undefined {
      const seleccionables = semestres.filter(esSemestreSeleccionable)
      const vigente = seleccionables.find((s) => s.vigente)
      if (user.value?.semestrePorDefecto === 'BORRADOR') return seleccionables.find((s) => s.borrador) ?? vigente
      return vigente
   }

   return { puedeVerSemestreBorrador, esSemestreSeleccionable, semestrePorDefecto }
}
