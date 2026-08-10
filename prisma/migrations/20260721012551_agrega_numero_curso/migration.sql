-- AlterTable
ALTER TABLE "curso" ADD COLUMN "numero" INTEGER;

-- Backfill: los nombres existentes ya usan la convención "<numero>-<algo>" (p. ej.
-- "1-300", "2-301"); se toma el entero inicial como numero, o 1 si no matchea.
UPDATE "curso" SET "numero" = COALESCE(substring("nombre" from '^\d+')::int, 1);

ALTER TABLE "curso" ALTER COLUMN "numero" SET NOT NULL;

-- CreateInvariant: numero siempre >= 1 (documentado en CLAUDE.md, no representado en
-- schema.prisma porque Prisma no modela CHECK).
ALTER TABLE "curso" ADD CONSTRAINT "curso_numero_positivo" CHECK ("numero" >= 1);
