-- Agrupa las ocurrencias de una reserva recurrente (semanal): todas comparten el mismo
-- serie_id. Una reserva no recurrente tiene serie_id null.
ALTER TABLE "reserva" ADD COLUMN "serie_id" UUID;
CREATE INDEX "reserva_serie_id_idx" ON "reserva"("serie_id");
