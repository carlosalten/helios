-- El RUN debe ser único tanto entre estudiantes como entre profesores del módulo de
-- titulaciones (ver server/utils/titulaciones.schemas.ts).

-- CreateIndex
CREATE UNIQUE INDEX "tt_estudiante_run_key" ON "tt_estudiante"("run");

-- CreateIndex
CREATE UNIQUE INDEX "tt_profesor_run_key" ON "tt_profesor"("run");

