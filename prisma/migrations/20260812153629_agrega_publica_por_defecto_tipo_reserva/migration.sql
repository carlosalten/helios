-- Valor por defecto de Reserva.publica al crear una reserva nueva de este tipo (formulario y
-- generación automática de reservas de sesiones de clases).
ALTER TABLE "tipo_reserva" ADD COLUMN "publica_por_defecto" BOOLEAN NOT NULL DEFAULT true;
