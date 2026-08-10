-- Una reserva puede no tener responsable designado: es el caso de las reservas generadas
-- por una sesión de clases con sala asignada pero todavía sin profesor. La sala igual queda
-- tomada; al asignar el profesor, la serie se regenera con él como responsable.
ALTER TABLE "reserva" ALTER COLUMN "persona_id" DROP NOT NULL;
