-- CreateEnum
CREATE TYPE "semestre_por_defecto" AS ENUM ('VIGENTE', 'BORRADOR');

-- AlterTable
ALTER TABLE "persona" ADD COLUMN "semestre_por_defecto" "semestre_por_defecto" NOT NULL DEFAULT 'VIGENTE';
