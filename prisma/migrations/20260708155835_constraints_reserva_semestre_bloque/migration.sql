-- Granularidad de 5 min en reservas
ALTER TABLE reserva ADD CONSTRAINT reserva_granularidad_5min
  CHECK (
    EXTRACT(MINUTE FROM inicio)::int % 5 = 0
    AND EXTRACT(MINUTE FROM fin)::int % 5 = 0
  );

-- fin > inicio
ALTER TABLE reserva ADD CONSTRAINT reserva_fin_mayor_inicio CHECK (fin > inicio);
ALTER TABLE semestre ADD CONSTRAINT semestre_fin_mayor_inicio CHECK (fecha_fin > fecha_inicio);
ALTER TABLE bloque   ADD CONSTRAINT bloque_fin_mayor_inicio   CHECK (fin > inicio);

-- Sin solapamiento de reservas activas en la misma sala/fecha
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE reserva ADD CONSTRAINT reserva_sin_solapamiento
  EXCLUDE USING gist (
    sala_codigo WITH =,
    fecha WITH =,
    tsrange(fecha + inicio, fecha + fin, '[)') WITH &&
  ) WHERE (estado != 'CANCELADA');
