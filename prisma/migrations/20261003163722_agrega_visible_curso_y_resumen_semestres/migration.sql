-- AlterTable
ALTER TABLE "curso" ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT true;

-- Acceso inicial a /semestres/resumen para Jefe de Carrera (administrable después desde /permisos).
INSERT INTO "permiso" ("rol", "ruta", "accion") VALUES
   ('Jefe de Carrera', '/semestres/resumen', 'ver'),
   ('Jefe de Carrera', '/semestres/resumen', 'editar')
ON CONFLICT ("rol", "ruta", "accion") DO NOTHING;
