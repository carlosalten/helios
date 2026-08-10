-- Se permite agendar reservas con horario solapado a propósito: la UI de /reservas/horario
-- ahora reparte las reservas solapadas en columnas dentro de la misma celda en vez de
-- rechazarlas.
ALTER TABLE "reserva" DROP CONSTRAINT "reserva_sin_solapamiento";
