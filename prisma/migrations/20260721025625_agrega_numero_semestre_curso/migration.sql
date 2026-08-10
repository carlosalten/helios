-- AlterTable
ALTER TABLE "curso" ADD COLUMN "numero_semestre" INTEGER;

-- Backfill: hasta ahora "numero" hacía las veces de posición curricular; se copia como
-- punto de partida (el admin puede corregirlo por curso desde /cursos si no aplica).
UPDATE "curso" SET "numero_semestre" = LEAST(GREATEST("numero", 1), 12);

ALTER TABLE "curso" ALTER COLUMN "numero_semestre" SET NOT NULL;

-- CreateInvariant: numero_semestre entre 1 y 12 (documentado en CLAUDE.md).
ALTER TABLE "curso" ADD CONSTRAINT "curso_numero_semestre_rango" CHECK ("numero_semestre" BETWEEN 1 AND 12);
