-- Se agregan NOT NULL con DEFAULT 1 para backfillear las asignaturas existentes,
-- y luego se quita el default: las inserciones nuevas deben indicar el valor explícitamente.
ALTER TABLE "asignatura" ADD COLUMN "bloques_teoria" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "asignatura" ADD COLUMN "bloques_practica" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "asignatura" ALTER COLUMN "bloques_teoria" DROP DEFAULT;
ALTER TABLE "asignatura" ALTER COLUMN "bloques_practica" DROP DEFAULT;

-- Ambos campos deben ser siempre >= 0.
ALTER TABLE "asignatura" ADD CONSTRAINT "asignatura_bloques_teoria_no_negativo" CHECK ("bloques_teoria" >= 0);
ALTER TABLE "asignatura" ADD CONSTRAINT "asignatura_bloques_practica_no_negativo" CHECK ("bloques_practica" >= 0);
