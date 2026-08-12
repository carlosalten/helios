-- CreateTable
CREATE TABLE "pantalla_publica" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "segundos_por_slide" INTEGER NOT NULL DEFAULT 15,

    CONSTRAINT "pantalla_publica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pantalla_publica_sala" (
    "id" SERIAL NOT NULL,
    "pantalla_id" INTEGER NOT NULL,
    "sala_codigo" VARCHAR(20) NOT NULL,

    CONSTRAINT "pantalla_publica_sala_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pantalla_publica_codigo_key" ON "pantalla_publica"("codigo");

-- CreateIndex
CREATE INDEX "pantalla_publica_sala_sala_codigo_idx" ON "pantalla_publica_sala"("sala_codigo");

-- CreateIndex
CREATE UNIQUE INDEX "pantalla_publica_sala_pantalla_id_sala_codigo_key" ON "pantalla_publica_sala"("pantalla_id", "sala_codigo");

-- AddForeignKey
ALTER TABLE "pantalla_publica_sala" ADD CONSTRAINT "pantalla_publica_sala_pantalla_id_fkey" FOREIGN KEY ("pantalla_id") REFERENCES "pantalla_publica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pantalla_publica_sala" ADD CONSTRAINT "pantalla_publica_sala_sala_codigo_fkey" FOREIGN KEY ("sala_codigo") REFERENCES "sala"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
