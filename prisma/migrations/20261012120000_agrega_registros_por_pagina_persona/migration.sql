-- AlterTable: las filas existentes quedan con el default (20).
ALTER TABLE "persona" ADD COLUMN "registros_por_pagina" SMALLINT NOT NULL DEFAULT 20;

-- CHECK a mano (Prisma no modela CHECK): mismas opciones que OPCIONES_REGISTROS_POR_PAGINA
-- en app/types/preferencias.ts.
ALTER TABLE "persona" ADD CONSTRAINT "persona_registros_por_pagina_valido"
   CHECK ("registros_por_pagina" IN (10, 20, 30, 40, 50));
