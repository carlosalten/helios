-- CreateIndex: un mismo semestre no puede tener dos feriados en la misma fecha.
CREATE UNIQUE INDEX "feriado_semestre_id_fecha_key" ON "feriado"("semestre_id", "fecha");
