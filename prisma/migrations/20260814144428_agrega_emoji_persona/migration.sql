-- Agrega el campo opcional "emoji" a Persona: un emoji (posiblemente una secuencia ZWJ de
-- varios codepoints) elegido de https://unicode.org/emoji/charts/full-emoji-list.html, que se
-- muestra flotando sobre el círculo de iniciales en el navbar cuando está definido.
ALTER TABLE "persona" ADD COLUMN "emoji" VARCHAR(32);
