-- CreateTable
CREATE TABLE "asignatura_equivalencia" (
    "asignatura_id" INTEGER NOT NULL,
    "equivalente_id" INTEGER NOT NULL,

    CONSTRAINT "asignatura_equivalencia_pkey" PRIMARY KEY ("asignatura_id","equivalente_id")
);

-- CreateIndex
CREATE INDEX "asignatura_equivalencia_equivalente_id_idx" ON "asignatura_equivalencia"("equivalente_id");

-- AddForeignKey
ALTER TABLE "asignatura_equivalencia" ADD CONSTRAINT "asignatura_equivalencia_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "asignatura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignatura_equivalencia" ADD CONSTRAINT "asignatura_equivalencia_equivalente_id_fkey" FOREIGN KEY ("equivalente_id") REFERENCES "asignatura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Una asignatura no puede ser equivalente a sí misma (Prisma no modela CHECK; ver CLAUDE.md).
ALTER TABLE "asignatura_equivalencia"
   ADD CONSTRAINT "asignatura_equivalencia_no_refleja" CHECK ("asignatura_id" <> "equivalente_id");
