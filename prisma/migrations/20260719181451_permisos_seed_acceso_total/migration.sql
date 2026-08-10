-- CreateTable
CREATE TABLE "permiso" (
    "id" SERIAL NOT NULL,
    "rol" VARCHAR(30) NOT NULL,
    "ruta" VARCHAR(50) NOT NULL,
    "accion" VARCHAR(10) NOT NULL,

    CONSTRAINT "permiso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permiso_rol_idx" ON "permiso"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_rol_ruta_accion_key" ON "permiso"("rol", "ruta", "accion");

-- Seed: replicar el comportamiento actual ("cualquier usuario logueado puede todo")
-- otorgando a los 4 roles no-Administrador acceso total a todas las (ruta, accion)
-- ya conocidas por este servicio. Administrador no necesita filas (bypass hardcodeado
-- en requierePermiso). El Administrador puede luego restringir acceso desde /permisos.
INSERT INTO "permiso" ("rol", "ruta", "accion")
SELECT rol.nombre, ruta.valor, accion.valor
FROM (VALUES ('Director Departamento'), ('Jefe de Carrera'), ('Profesor'), ('Apoyo Docente')) AS rol(nombre)
CROSS JOIN (VALUES
    ('/asignaturas'), ('/bloques'), ('/bloques/copiar'), ('/carreras'), ('/cursos'),
    ('/horario'), ('/paralelos'), ('/personas/gestion'), ('/personas/tipos'), ('/planes'),
    ('/planes/asignacion'), ('/reservas/tipos'), ('/salas/asignacion'), ('/salas/gestion'),
    ('/salas/tipos'), ('/semestres')
) AS ruta(valor)
CROSS JOIN (VALUES ('ver'), ('crear'), ('editar'), ('borrar')) AS accion(valor)
ON CONFLICT ("rol", "ruta", "accion") DO NOTHING;
