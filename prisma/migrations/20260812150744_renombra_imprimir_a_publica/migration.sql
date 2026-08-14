-- Renombra `imprimir` a `publica`: el campo ahora también controla si la reserva se
-- muestra en la pantalla pública (/pantallas/<codigo>), no solo en la vista impresa.
ALTER TABLE "reserva" RENAME COLUMN "imprimir" TO "publica";
