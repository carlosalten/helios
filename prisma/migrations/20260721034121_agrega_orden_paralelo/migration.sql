-- AlterTable
ALTER TABLE "paralelo" ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0;

-- Backfill: se preserva el orden alfabético por código dentro de cada curso, que es como
-- se venían mostrando, en vez de dejar todo empatado en 0.
WITH ordenado AS (
   SELECT id, ROW_NUMBER() OVER (PARTITION BY curso_id ORDER BY codigo) - 1 AS rn
   FROM "paralelo"
)
UPDATE "paralelo" SET "orden" = ordenado.rn
FROM ordenado
WHERE ordenado.id = "paralelo".id;
