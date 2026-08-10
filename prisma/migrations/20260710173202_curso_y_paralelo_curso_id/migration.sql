-- CreateTable
CREATE TABLE "curso" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "plan_id" INTEGER NOT NULL,

    CONSTRAINT "curso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "curso_plan_id_idx" ON "curso"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "curso_plan_id_nombre_key" ON "curso"("plan_id", "nombre");

-- AddForeignKey
ALTER TABLE "curso" ADD CONSTRAINT "curso_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: un curso "Sin asignar" por cada plan que ya tenga paralelos.
INSERT INTO "curso" ("nombre", "plan_id")
SELECT DISTINCT 'Sin asignar', ap."plan_id"
FROM "paralelo" p
JOIN "asignatura_plan" ap ON ap."id" = p."asignatura_plan_id";

-- AlterTable (nullable primero para poder rellenar los paralelos existentes)
ALTER TABLE "paralelo" ADD COLUMN "curso_id" INTEGER;

UPDATE "paralelo" p
SET "curso_id" = c."id"
FROM "asignatura_plan" ap
JOIN "curso" c ON c."plan_id" = ap."plan_id" AND c."nombre" = 'Sin asignar'
WHERE ap."id" = p."asignatura_plan_id";

ALTER TABLE "paralelo" ALTER COLUMN "curso_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "paralelo_curso_id_idx" ON "paralelo"("curso_id");

-- AddForeignKey
ALTER TABLE "paralelo" ADD CONSTRAINT "paralelo_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
