-- NOT NULL con DEFAULT 4: backfillea los planes existentes y queda como valor por
-- defecto para las inserciones nuevas que no lo indiquen explícitamente.
ALTER TABLE "plan" ADD COLUMN "cantidad_semestres" INTEGER NOT NULL DEFAULT 4;

-- Debe estar siempre entre 4 y 12.
ALTER TABLE "plan" ADD CONSTRAINT "plan_cantidad_semestres_rango" CHECK ("cantidad_semestres" BETWEEN 4 AND 12);
