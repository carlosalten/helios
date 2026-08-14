-- Marca de "visto" del estudiante sobre un cambio de estado de su propuesta. Nulo = no visto.
ALTER TABLE "tt_estado" ADD COLUMN "visto_fecha_hora" TIMESTAMP(3);
