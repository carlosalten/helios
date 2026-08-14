-- "Antecedentes solicitados" (24 caracteres) no entraba en el VarChar(20) original de
-- tt_estado.estado.
ALTER TABLE "tt_estado" ALTER COLUMN "estado" SET DATA TYPE VARCHAR(30);
