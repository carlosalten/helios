-- CreateEnum
CREATE TYPE "alcance_feriado" AS ENUM ('SOLO_CLASES', 'TOTAL');

-- AlterTable
ALTER TABLE "feriado" ADD COLUMN "alcance" "alcance_feriado" NOT NULL DEFAULT 'TOTAL';
