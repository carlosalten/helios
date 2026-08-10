-- AlterTable
ALTER TABLE "asignatura_plan" ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0;

-- Backfill: como el tablero de /planes/asignacion mostraba las asignaturas en orden
-- alfabético dentro de cada columna, se preserva ese orden inicial para que drag and
-- drop parta desde donde el usuario ya las veía, en vez de todas empatadas en 0.
WITH ordenado AS (
   SELECT ap.id, ROW_NUMBER() OVER (PARTITION BY ap.plan_id, ap.semestre ORDER BY a.nombre) - 1 AS rn
   FROM "asignatura_plan" ap
   JOIN "asignatura" a ON a.id = ap.asignatura_id
)
UPDATE "asignatura_plan" SET "orden" = ordenado.rn
FROM ordenado
WHERE ordenado.id = "asignatura_plan".id;
