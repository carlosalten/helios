-- AlterTable
ALTER TABLE "tipo_reserva" ADD COLUMN "color" VARCHAR(7);

-- Backfill: un color distinto por tipo existente, tomado en orden de la misma paleta fija
-- de 20 colores que ofrece el formulario (ver COLORES_RESERVA en app/types/reserva.ts). Si
-- hubiera más de 20 tipos, se repiten cíclicamente.
WITH paleta(orden, hex) AS (
    VALUES
        (0, '#EF4444'), (1, '#F97316'), (2, '#F59E0B'), (3, '#EAB308'), (4, '#84CC16'),
        (5, '#22C55E'), (6, '#10B981'), (7, '#14B8A6'), (8, '#06B6D4'), (9, '#0EA5E9'),
        (10, '#3B82F6'), (11, '#6366F1'), (12, '#8B5CF6'), (13, '#A855F7'), (14, '#D946EF'),
        (15, '#EC4899'), (16, '#F43F5E'), (17, '#92400E'), (18, '#6B7280'), (19, '#1E293B')
),
numerado AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY id) - 1) % 20 AS orden FROM "tipo_reserva"
)
UPDATE "tipo_reserva" tr
SET "color" = p.hex
FROM numerado n
JOIN paleta p ON p.orden = n.orden
WHERE tr.id = n.id;

ALTER TABLE "tipo_reserva" ALTER COLUMN "color" SET NOT NULL;
