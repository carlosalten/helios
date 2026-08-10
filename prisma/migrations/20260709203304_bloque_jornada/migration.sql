-- CreateEnum
CREATE TYPE "jornada" AS ENUM ('DIURNA', 'VESPERTINA');

-- AlterTable
ALTER TABLE "bloque" ADD COLUMN     "jornada" "jornada" NOT NULL DEFAULT 'DIURNA';
