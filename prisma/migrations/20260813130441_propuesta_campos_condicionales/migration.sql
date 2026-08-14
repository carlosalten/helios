-- Modalidad ("Investigación" / "Tesina Feria de Software" / "Proyecto Propio") se ensancha a
-- VarChar(30): "Tesina Feria de Software" (24 caracteres) no entraba en el VarChar(20)
-- original. inv_motivacion/inv_experiencia/cla_problema/cla_objetivo pasan a nullable: solo se
-- completan según la modalidad elegida (inv_* en "Investigación", cla_* en "Proyecto Propio"),
-- nulos en cualquier otro caso.
ALTER TABLE "tt_propuesta" ALTER COLUMN "modalidad" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "inv_motivacion" DROP NOT NULL,
ALTER COLUMN "inv_experiencia" DROP NOT NULL,
ALTER COLUMN "cla_problema" DROP NOT NULL,
ALTER COLUMN "cla_objetivo" DROP NOT NULL;
