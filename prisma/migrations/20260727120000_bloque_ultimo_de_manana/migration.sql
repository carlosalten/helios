-- AlterTable
ALTER TABLE "bloque" ADD COLUMN     "es_ultimo_manana" BOOLEAN NOT NULL DEFAULT false;

-- CreateInvariant: a lo más un bloque en true por semestre (documentado en CLAUDE.md).
-- Índice único parcial: no representable en Prisma (solo modela columnas/índices simples).
CREATE UNIQUE INDEX "bloque_un_ultimo_manana_por_semestre" ON "bloque"("semestre_id") WHERE "es_ultimo_manana";

-- Backfill: en los semestres existentes, el bloque N° 8 es el último de la mañana
-- (justo antes del bloque 9, con el que empieza la tarde).
UPDATE "bloque" SET "es_ultimo_manana" = true WHERE "numero" = 8;
