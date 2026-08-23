-- Invariante: una propuesta no puede tener más de un profesor guía asignado simultáneamente
-- (sí puede tener varias filas de comisión con otros roles — presidente, revisor, etc.). No se
-- puede modelar como CHECK (compara filas entre sí), así que es un índice único parcial, igual
-- que bloque_un_ultimo_manana_por_semestre.
CREATE UNIQUE INDEX "tt_comision_propuesta_id_guia_key" ON "tt_comision"("propuesta_id") WHERE "rol" = 'Guía';
