-- CreateEnum
CREATE TYPE "tipo_sesion" AS ENUM ('TEORIA', 'PRACTICA');

-- DropForeignKey
ALTER TABLE "sesion_paralelo" DROP CONSTRAINT "sesion_paralelo_profesor_id_fkey";

-- DropForeignKey
ALTER TABLE "sesion_paralelo" DROP CONSTRAINT "sesion_paralelo_sala_codigo_fkey";

-- AlterTable
ALTER TABLE "sesion_paralelo" ADD COLUMN     "tipo" "tipo_sesion" NOT NULL,
ALTER COLUMN "sala_codigo" DROP NOT NULL,
ALTER COLUMN "profesor_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "sesion_paralelo" ADD CONSTRAINT "sesion_paralelo_sala_codigo_fkey" FOREIGN KEY ("sala_codigo") REFERENCES "sala"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion_paralelo" ADD CONSTRAINT "sesion_paralelo_profesor_id_fkey" FOREIGN KEY ("profesor_id") REFERENCES "persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
