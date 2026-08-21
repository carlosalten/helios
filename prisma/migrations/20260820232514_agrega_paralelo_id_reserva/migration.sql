-- AlterTable
ALTER TABLE "reserva" ADD COLUMN     "paralelo_id" INTEGER;

-- CreateIndex
CREATE INDEX "reserva_paralelo_id_idx" ON "reserva"("paralelo_id");

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_paralelo_id_fkey" FOREIGN KEY ("paralelo_id") REFERENCES "paralelo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
