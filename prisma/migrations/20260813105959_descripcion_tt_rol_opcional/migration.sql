-- Descripción de un rol de propuesta pasa a ser opcional.
ALTER TABLE "tt_rol" ALTER COLUMN "descripcion" DROP NOT NULL;
