-- AlterTable
ALTER TABLE "reserva" ADD COLUMN "titulo" VARCHAR(50);

-- Backfill: usa el nombre del tipo de reserva como punto de partida para las reservas ya
-- creadas (el usuario puede afinarlo después).
UPDATE "reserva" r SET "titulo" = tr."nombre" FROM "tipo_reserva" tr WHERE tr."id" = r."tipo_reserva_id";

ALTER TABLE "reserva" ALTER COLUMN "titulo" SET NOT NULL;
