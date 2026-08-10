-- Se agrega NOT NULL con DEFAULT 1 para backfillear los registros existentes, y luego
-- se quita el default: las inserciones nuevas deben indicar el valor explícitamente.
ALTER TABLE "asignatura_plan" ADD COLUMN "semestre" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "asignatura_plan" ALTER COLUMN "semestre" DROP DEFAULT;

-- El semestre siempre debe ser >= 1.
ALTER TABLE "asignatura_plan" ADD CONSTRAINT "asignatura_plan_semestre_positivo" CHECK ("semestre" >= 1);
