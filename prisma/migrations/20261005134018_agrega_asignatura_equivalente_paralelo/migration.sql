-- AlterTable
ALTER TABLE "paralelo" ADD COLUMN     "asignatura_equivalente_id" INTEGER;

-- CreateIndex
CREATE INDEX "paralelo_asignatura_equivalente_id_idx" ON "paralelo"("asignatura_equivalente_id");

-- AddForeignKey
ALTER TABLE "paralelo" ADD CONSTRAINT "paralelo_asignatura_equivalente_id_fkey" FOREIGN KEY ("asignatura_equivalente_id") REFERENCES "asignatura"("id") ON DELETE SET NULL ON UPDATE CASCADE;
