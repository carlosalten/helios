-- CreateEnum
CREATE TYPE "jornada_laboral" AS ENUM ('COMPLETA', 'PARCIAL');

-- AlterTable
ALTER TABLE "persona" ADD COLUMN     "jornada_laboral" "jornada_laboral";
