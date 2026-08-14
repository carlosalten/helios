-- rol_id solo aplica a la modalidad "Tesina Feria de Software" y linea_investigacion_id solo a
-- "Investigación" — cada propuesta completa a lo más uno de los dos según la modalidad elegida,
-- así que ambos pasan a nullable. ON DELETE SET NULL (antes RESTRICT/NO ACTION implícito): si
-- se borra un rol o línea de investigación referenciada, la propuesta no debe quedar bloqueada
-- por la FK, solo pierde esa referencia.
ALTER TABLE "tt_propuesta" DROP CONSTRAINT "tt_propuesta_linea_investigacion_id_fkey";
ALTER TABLE "tt_propuesta" DROP CONSTRAINT "tt_propuesta_rol_id_fkey";

ALTER TABLE "tt_propuesta" ALTER COLUMN "rol_id" DROP NOT NULL,
ALTER COLUMN "linea_investigacion_id" DROP NOT NULL;

ALTER TABLE "tt_propuesta" ADD CONSTRAINT "tt_propuesta_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "tt_rol"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tt_propuesta" ADD CONSTRAINT "tt_propuesta_linea_investigacion_id_fkey" FOREIGN KEY ("linea_investigacion_id") REFERENCES "tt_linea_investigacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
