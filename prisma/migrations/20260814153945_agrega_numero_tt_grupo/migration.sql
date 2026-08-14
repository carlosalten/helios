-- Agrega tt_grupo.numero (entero >= 1, único dentro de cada proceso). Los grupos existentes se
-- numeran correlativamente por proceso, en el orden en que fueron creados (por id).
ALTER TABLE "tt_grupo" ADD COLUMN "numero" INTEGER;

UPDATE "tt_grupo" AS g
SET "numero" = t.fila
FROM (
   SELECT id, ROW_NUMBER() OVER (PARTITION BY proceso_id ORDER BY id) AS fila
   FROM "tt_grupo"
) AS t
WHERE g.id = t.id;

ALTER TABLE "tt_grupo" ALTER COLUMN "numero" SET NOT NULL;

ALTER TABLE "tt_grupo" ADD CONSTRAINT "tt_grupo_numero_positivo" CHECK ("numero" >= 1);

-- CreateIndex
CREATE UNIQUE INDEX "tt_grupo_proceso_id_numero_key" ON "tt_grupo"("proceso_id", "numero");
