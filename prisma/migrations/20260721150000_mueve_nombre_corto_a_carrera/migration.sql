-- Corrige un error: "nombre_corto" era para carrera, no para asignatura.

-- Revierte la migración 20260721144905_agrega_nombre_corto_asignatura.
ALTER TABLE "asignatura" DROP COLUMN "nombre_corto";

-- Agrega nombre_corto a carrera.
ALTER TABLE "carrera" ADD COLUMN "nombre_corto" VARCHAR(30);

-- Backfill: se recorta el nombre completo como punto de partida (el admin puede
-- afinarlo por carrera desde /carreras).
UPDATE "carrera" SET "nombre_corto" = LEFT("nombre", 30);

ALTER TABLE "carrera" ALTER COLUMN "nombre_corto" SET NOT NULL;
