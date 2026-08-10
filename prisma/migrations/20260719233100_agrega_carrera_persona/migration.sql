-- CreateTable
CREATE TABLE "carrera_persona" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "carrera_codigo" INTEGER NOT NULL,

    CONSTRAINT "carrera_persona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carrera_persona_carrera_codigo_idx" ON "carrera_persona"("carrera_codigo");

-- CreateIndex
CREATE UNIQUE INDEX "carrera_persona_persona_id_carrera_codigo_key" ON "carrera_persona"("persona_id", "carrera_codigo");

-- AddForeignKey
ALTER TABLE "carrera_persona" ADD CONSTRAINT "carrera_persona_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrera_persona" ADD CONSTRAINT "carrera_persona_carrera_codigo_fkey" FOREIGN KEY ("carrera_codigo") REFERENCES "carrera"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
