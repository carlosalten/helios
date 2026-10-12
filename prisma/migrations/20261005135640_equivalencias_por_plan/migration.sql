-- Equivalencias por plan: reemplaza la tabla global y simétrica asignatura_equivalencia por
-- asignatura_plan_equivalente (dirigida y propia de cada plan).

-- CreateTable
CREATE TABLE "asignatura_plan_equivalente" (
    "id" SERIAL NOT NULL,
    "asignatura_plan_id" INTEGER NOT NULL,
    "asignatura_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,

    CONSTRAINT "asignatura_plan_equivalente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asignatura_plan_equivalente_asignatura_plan_id_idx" ON "asignatura_plan_equivalente"("asignatura_plan_id");

-- CreateIndex
CREATE INDEX "asignatura_plan_equivalente_asignatura_id_idx" ON "asignatura_plan_equivalente"("asignatura_id");

-- CreateIndex
CREATE UNIQUE INDEX "asignatura_plan_equivalente_plan_id_asignatura_id_key" ON "asignatura_plan_equivalente"("plan_id", "asignatura_id");

-- AddForeignKey
ALTER TABLE "asignatura_plan_equivalente" ADD CONSTRAINT "asignatura_plan_equivalente_asignatura_plan_id_fkey" FOREIGN KEY ("asignatura_plan_id") REFERENCES "asignatura_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignatura_plan_equivalente" ADD CONSTRAINT "asignatura_plan_equivalente_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "asignatura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignatura_plan_equivalente" ADD CONSTRAINT "asignatura_plan_equivalente_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copia de datos: cada equivalencia global de una asignatura que está en una malla pasa a ser
-- equivalencia de esa malla. Se omiten las equivalentes que ya son asignaturas de la misma
-- malla (no pueden ser equivalentes de otra), y si un código quedara equivalente a dos
-- asignaturas del mismo plan se conserva solo la primera (una por plan).
INSERT INTO "asignatura_plan_equivalente" ("asignatura_plan_id", "asignatura_id", "plan_id")
SELECT ap."id", ae."equivalente_id", ap."plan_id"
FROM "asignatura_equivalencia" ae
JOIN "asignatura_plan" ap ON ap."asignatura_id" = ae."asignatura_id"
WHERE NOT EXISTS (
    SELECT 1 FROM "asignatura_plan" x
    WHERE x."plan_id" = ap."plan_id" AND x."asignatura_id" = ae."equivalente_id"
)
ORDER BY ap."plan_id", ap."id", ae."equivalente_id"
ON CONFLICT ("plan_id", "asignatura_id") DO NOTHING;

-- DropTable (arrastra sus FKs y la constraint asignatura_equivalencia_no_refleja)
DROP TABLE "asignatura_equivalencia";
