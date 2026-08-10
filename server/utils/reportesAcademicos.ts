// Usado por el selector de carrera/plan/semestre de /reportes/asignaturas-plan.
// Autocontenido (no reusa /api/planes ni /api/semestres): así un rol con 'ver' solo en la
// ruta del reporte puede usarlo sin necesitar además 'ver' en /planes (que sí lo exige —
// ver server/api/planes/index.get.ts).
export async function obtenerPlanesYSemestres() {
   const [planes, semestres] = await Promise.all([
      prisma.plan.findMany({ orderBy: [{ carreraCodigo: 'asc' }, { numero: 'asc' }], include: { carrera: true } }),
      prisma.semestre.findMany({ orderBy: { fechaInicio: 'desc' } }),
   ])
   return { planes, semestres }
}

export function horaLocal(hora: Date): string {
   return hora.toISOString().slice(11, 16)
}
