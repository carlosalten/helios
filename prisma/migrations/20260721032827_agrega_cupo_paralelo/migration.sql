-- AlterTable
ALTER TABLE "paralelo" ADD COLUMN     "cupo" INTEGER NOT NULL DEFAULT 0;

-- CreateInvariant: cupo entre 0 y 100 (documentado en CLAUDE.md).
ALTER TABLE "paralelo" ADD CONSTRAINT "paralelo_cupo_rango" CHECK ("cupo" BETWEEN 0 AND 100);
