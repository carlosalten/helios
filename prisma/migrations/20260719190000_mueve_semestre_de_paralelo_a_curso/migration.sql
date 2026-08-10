-- Mueve la FK de semestre desde `paralelo` hacia `curso`: un curso ahora pertenece a
-- un semestre específico, y los paralelos heredan el semestre a través de su curso.
--
-- Antes de dropear `paralelo.semestre_id`, se preservan los datos existentes:
--   1. cada curso se asigna al semestre mínimo entre los de sus paralelos actuales;
--   2. si un curso tenía paralelos en más de un semestre distinto, se duplica el curso
--      por cada semestre adicional y se re-apuntan esos paralelos al curso duplicado
--      (dos paralelos del mismo curso ya no pueden convivir en semestres distintos);
--   3. cursos sin paralelos quedan en el semestre vigente (o, si no hay vigente, el más
--      reciente por fecha de inicio).

-- AlterTable: agrega la columna nullable primero para poder rellenarla.
ALTER TABLE "curso" ADD COLUMN "semestre_id" INTEGER;

-- 1. Cada curso existente hereda el semestre mínimo de sus paralelos.
UPDATE "curso" c
SET "semestre_id" = sub.min_semestre
FROM (
    SELECT "curso_id", MIN("semestre_id") AS min_semestre
    FROM "paralelo"
    GROUP BY "curso_id"
) sub
WHERE c."id" = sub."curso_id";

-- 2. Cursos sin paralelos: caen en el semestre vigente, o el más reciente si no hay vigente.
UPDATE "curso"
SET "semestre_id" = (
    SELECT "id" FROM "semestre" ORDER BY "vigente" DESC, "fecha_inicio" DESC LIMIT 1
)
WHERE "semestre_id" IS NULL;

-- 3. Duplica el curso por cada semestre adicional que sus paralelos referenciaban, y
--    re-apunta esos paralelos al curso duplicado.
DO $$
DECLARE
    fila RECORD;
    nuevo_id INTEGER;
BEGIN
    FOR fila IN
        SELECT DISTINCT p."curso_id" AS curso_id_original, p."semestre_id" AS semestre_id_extra
        FROM "paralelo" p
        JOIN "curso" c ON c."id" = p."curso_id"
        WHERE p."semestre_id" <> c."semestre_id"
    LOOP
        INSERT INTO "curso" ("nombre", "plan_id", "semestre_id")
        SELECT "nombre", "plan_id", fila.semestre_id_extra FROM "curso" WHERE "id" = fila.curso_id_original
        RETURNING "id" INTO nuevo_id;

        UPDATE "paralelo"
        SET "curso_id" = nuevo_id
        WHERE "curso_id" = fila.curso_id_original AND "semestre_id" = fila.semestre_id_extra;
    END LOOP;
END $$;

-- AlterTable: ya sin filas nulas, se puede exigir NOT NULL.
ALTER TABLE "curso" ALTER COLUMN "semestre_id" SET NOT NULL;

-- DropForeignKey / DropIndex / DropColumn: quita la FK de semestre en `paralelo`.
ALTER TABLE "paralelo" DROP CONSTRAINT "paralelo_semestre_id_fkey";
DROP INDEX "paralelo_semestre_id_idx";
ALTER TABLE "paralelo" DROP COLUMN "semestre_id";

-- DropIndex: el unique de curso pasa a incluir el semestre.
DROP INDEX "curso_plan_id_nombre_key";
CREATE UNIQUE INDEX "curso_plan_id_semestre_id_nombre_key" ON "curso"("plan_id", "semestre_id", "nombre");

-- CreateIndex
CREATE INDEX "curso_semestre_id_idx" ON "curso"("semestre_id");

-- AddForeignKey
ALTER TABLE "curso" ADD CONSTRAINT "curso_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
