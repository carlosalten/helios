-- CreateTable
CREATE TABLE "feriado" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TIME,
    "hora_termino" TIME,
    "semestre_id" INTEGER NOT NULL,

    CONSTRAINT "feriado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feriado_semestre_id_idx" ON "feriado"("semestre_id");

-- AddForeignKey
ALTER TABLE "feriado" ADD CONSTRAINT "feriado_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateCheck: hora_inicio y hora_termino van ambos null (feriado de día completo) o ambos
-- con valor y hora_termino posterior a hora_inicio (feriado parcial).
ALTER TABLE "feriado" ADD CONSTRAINT "feriado_horas_validas" CHECK (
    ("hora_inicio" IS NULL AND "hora_termino" IS NULL)
    OR ("hora_inicio" IS NOT NULL AND "hora_termino" IS NOT NULL AND "hora_termino" > "hora_inicio")
);
