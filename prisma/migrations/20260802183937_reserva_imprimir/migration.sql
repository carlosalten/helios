-- DropForeignKey
ALTER TABLE "reserva" DROP CONSTRAINT "reserva_persona_id_fkey";

-- AlterTable
ALTER TABLE "reserva" ADD COLUMN     "imprimir" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
