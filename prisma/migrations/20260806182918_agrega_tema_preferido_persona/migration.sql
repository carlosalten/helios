-- CreateEnum
CREATE TYPE "tema_preferido" AS ENUM ('CLARO', 'OSCURO');

-- AlterTable
ALTER TABLE "persona" ADD COLUMN     "tema_preferido" "tema_preferido" NOT NULL DEFAULT 'CLARO';
