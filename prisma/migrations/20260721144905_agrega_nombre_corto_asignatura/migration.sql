-- AlterTable
ALTER TABLE "asignatura" ADD COLUMN "nombre_corto" VARCHAR(30);

-- Backfill: se recorta el nombre completo como punto de partida (el admin puede
-- afinarlo por asignatura desde /asignaturas).
UPDATE "asignatura" SET "nombre_corto" = LEFT("nombre", 30);

ALTER TABLE "asignatura" ALTER COLUMN "nombre_corto" SET NOT NULL;
