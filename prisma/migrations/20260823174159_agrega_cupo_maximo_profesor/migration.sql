-- AlterTable
ALTER TABLE "tt_profesor" ADD COLUMN     "cupo_maximo" INTEGER NOT NULL DEFAULT 6;

-- CreateInvariant: cupo_maximo >= 1 (documentado en CLAUDE.md).
ALTER TABLE "tt_profesor" ADD CONSTRAINT "tt_profesor_cupo_maximo_positivo" CHECK ("cupo_maximo" >= 1);
