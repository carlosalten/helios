-- CreateEnum
CREATE TYPE "estado_reserva" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA');

-- DropForeignKey
ALTER TABLE "reserva" DROP CONSTRAINT "reserva_codigo_sala_fkey";

-- DropForeignKey
ALTER TABLE "reserva" DROP CONSTRAINT "reserva_persona_email_fkey";

-- DropForeignKey
ALTER TABLE "sala_usuario" DROP CONSTRAINT "sala_usuario_codigo_sala_fkey";

-- AlterTable
ALTER TABLE "persona" DROP CONSTRAINT "persona_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ALTER COLUMN "nombre" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "apellido" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "activo" SET DEFAULT true,
ADD CONSTRAINT "persona_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "reserva" DROP COLUMN "codigo_sala",
DROP COLUMN "persona_email",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "estado" "estado_reserva" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "persona_id" INTEGER NOT NULL,
ADD COLUMN     "sala_codigo" VARCHAR(20) NOT NULL,
ADD COLUMN     "sesion_paralelo_id" INTEGER,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "sala_usuario";

-- CreateTable
CREATE TABLE "carrera" (
    "codigo" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "jefe_persona_id" INTEGER NOT NULL,

    CONSTRAINT "carrera_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "plan" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT false,
    "carrera_codigo" INTEGER NOT NULL,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignatura" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "asignatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignatura_plan" (
    "id" SERIAL NOT NULL,
    "asignatura_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,

    CONSTRAINT "asignatura_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paralelo" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "asignatura_plan_id" INTEGER NOT NULL,
    "semestre_id" INTEGER NOT NULL,

    CONSTRAINT "paralelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semestre" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(20) NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "semestre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloque" (
    "id" SERIAL NOT NULL,
    "semestre_id" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "inicio" TIME NOT NULL,
    "fin" TIME NOT NULL,
    "protegido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "bloque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion_paralelo" (
    "id" SERIAL NOT NULL,
    "paralelo_id" INTEGER NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "sala_codigo" VARCHAR(20) NOT NULL,
    "profesor_id" INTEGER NOT NULL,

    CONSTRAINT "sesion_paralelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion_paralelo_bloque" (
    "sesion_paralelo_id" INTEGER NOT NULL,
    "bloque_id" INTEGER NOT NULL,

    CONSTRAINT "sesion_paralelo_bloque_pkey" PRIMARY KEY ("sesion_paralelo_id","bloque_id")
);

-- CreateTable
CREATE TABLE "encargado_sala" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "sala_codigo" VARCHAR(20) NOT NULL,

    CONSTRAINT "encargado_sala_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carrera_jefe_persona_id_idx" ON "carrera"("jefe_persona_id");

-- CreateIndex
CREATE INDEX "plan_carrera_codigo_idx" ON "plan"("carrera_codigo");

-- CreateIndex
CREATE INDEX "asignatura_plan_plan_id_idx" ON "asignatura_plan"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "asignatura_plan_asignatura_id_plan_id_key" ON "asignatura_plan"("asignatura_id", "plan_id");

-- CreateIndex
CREATE INDEX "paralelo_asignatura_plan_id_idx" ON "paralelo"("asignatura_plan_id");

-- CreateIndex
CREATE INDEX "paralelo_semestre_id_idx" ON "paralelo"("semestre_id");

-- CreateIndex
CREATE INDEX "bloque_semestre_id_idx" ON "bloque"("semestre_id");

-- CreateIndex
CREATE UNIQUE INDEX "bloque_semestre_id_numero_key" ON "bloque"("semestre_id", "numero");

-- CreateIndex
CREATE INDEX "sesion_paralelo_paralelo_id_idx" ON "sesion_paralelo"("paralelo_id");

-- CreateIndex
CREATE INDEX "sesion_paralelo_sala_codigo_idx" ON "sesion_paralelo"("sala_codigo");

-- CreateIndex
CREATE INDEX "sesion_paralelo_profesor_id_idx" ON "sesion_paralelo"("profesor_id");

-- CreateIndex
CREATE INDEX "sesion_paralelo_bloque_bloque_id_idx" ON "sesion_paralelo_bloque"("bloque_id");

-- CreateIndex
CREATE INDEX "encargado_sala_sala_codigo_idx" ON "encargado_sala"("sala_codigo");

-- CreateIndex
CREATE UNIQUE INDEX "encargado_sala_persona_id_sala_codigo_key" ON "encargado_sala"("persona_id", "sala_codigo");

-- CreateIndex
CREATE UNIQUE INDEX "persona_email_key" ON "persona"("email");

-- CreateIndex
CREATE INDEX "persona_rol_persona_id_idx" ON "persona"("rol_persona_id");

-- CreateIndex
CREATE INDEX "reserva_sala_codigo_fecha_idx" ON "reserva"("sala_codigo", "fecha");

-- CreateIndex
CREATE INDEX "reserva_persona_id_idx" ON "reserva"("persona_id");

-- CreateIndex
CREATE INDEX "reserva_sesion_paralelo_id_idx" ON "reserva"("sesion_paralelo_id");

-- CreateIndex
CREATE INDEX "reserva_fecha_idx" ON "reserva"("fecha");

-- CreateIndex
CREATE INDEX "sala_tipo_sala_id_idx" ON "sala"("tipo_sala_id");

-- AddForeignKey
ALTER TABLE "carrera" ADD CONSTRAINT "carrera_jefe_persona_id_fkey" FOREIGN KEY ("jefe_persona_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan" ADD CONSTRAINT "plan_carrera_codigo_fkey" FOREIGN KEY ("carrera_codigo") REFERENCES "carrera"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignatura_plan" ADD CONSTRAINT "asignatura_plan_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "asignatura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignatura_plan" ADD CONSTRAINT "asignatura_plan_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paralelo" ADD CONSTRAINT "paralelo_asignatura_plan_id_fkey" FOREIGN KEY ("asignatura_plan_id") REFERENCES "asignatura_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paralelo" ADD CONSTRAINT "paralelo_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloque" ADD CONSTRAINT "bloque_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion_paralelo" ADD CONSTRAINT "sesion_paralelo_paralelo_id_fkey" FOREIGN KEY ("paralelo_id") REFERENCES "paralelo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion_paralelo" ADD CONSTRAINT "sesion_paralelo_sala_codigo_fkey" FOREIGN KEY ("sala_codigo") REFERENCES "sala"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion_paralelo" ADD CONSTRAINT "sesion_paralelo_profesor_id_fkey" FOREIGN KEY ("profesor_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion_paralelo_bloque" ADD CONSTRAINT "sesion_paralelo_bloque_sesion_paralelo_id_fkey" FOREIGN KEY ("sesion_paralelo_id") REFERENCES "sesion_paralelo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion_paralelo_bloque" ADD CONSTRAINT "sesion_paralelo_bloque_bloque_id_fkey" FOREIGN KEY ("bloque_id") REFERENCES "bloque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encargado_sala" ADD CONSTRAINT "encargado_sala_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encargado_sala" ADD CONSTRAINT "encargado_sala_sala_codigo_fkey" FOREIGN KEY ("sala_codigo") REFERENCES "sala"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_sala_codigo_fkey" FOREIGN KEY ("sala_codigo") REFERENCES "sala"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_sesion_paralelo_id_fkey" FOREIGN KEY ("sesion_paralelo_id") REFERENCES "sesion_paralelo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
