-- AlterTable
ALTER TABLE "asignatura_plan" ADD COLUMN     "es_electiva" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "plan" ADD COLUMN     "tiene_electivos" BOOLEAN NOT NULL DEFAULT false;
