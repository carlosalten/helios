-- AlterTable
ALTER TABLE "rol" ADD COLUMN     "jerarquia" INTEGER NOT NULL DEFAULT 0;

-- Jerarquía inicial de los roles con seed (20260720140000_fusiona_usuario_en_persona): mayor
-- número = más alto en la jerarquía. Los roles que se creen después quedan en 0 (el default de
-- la columna) hasta que un Administrador les asigne uno mayor desde /personas/tipos.
UPDATE "rol" SET "jerarquia" = 100 WHERE "nombre" = 'Administrador';
UPDATE "rol" SET "jerarquia" = 80 WHERE "nombre" = 'Director Departamento';
UPDATE "rol" SET "jerarquia" = 60 WHERE "nombre" = 'Jefe de Carrera';
UPDATE "rol" SET "jerarquia" = 40 WHERE "nombre" = 'Profesor';
UPDATE "rol" SET "jerarquia" = 30 WHERE "nombre" = 'Apoyo Docente';
UPDATE "rol" SET "jerarquia" = 20 WHERE "nombre" = 'Funcionario';
UPDATE "rol" SET "jerarquia" = 10 WHERE "nombre" = 'Externo';
