-- "Cancelar reserva" deja de ser un cambio de estado (soft-delete) y pasa a borrar la fila
-- directamente. Antes de quitar la columna, se borran las reservas que ya estaban
-- canceladas (ya no ocupaban horario, así que no se pierde nada visible).
DELETE FROM "reserva" WHERE "estado" = 'CANCELADA';

-- La exclusión de solapamiento filtraba por estado != 'CANCELADA'; sin esa columna, todas
-- las filas que quedan son activas, así que la exclusión aplica sin condición.
ALTER TABLE "reserva" DROP CONSTRAINT "reserva_sin_solapamiento";

ALTER TABLE "reserva" DROP COLUMN "estado";

DROP TYPE "estado_reserva";

ALTER TABLE "reserva" ADD CONSTRAINT reserva_sin_solapamiento
  EXCLUDE USING gist (
    sala_codigo WITH =,
    fecha WITH =,
    tsrange(fecha + inicio, fecha + fin, '[)') WITH &&
  );
