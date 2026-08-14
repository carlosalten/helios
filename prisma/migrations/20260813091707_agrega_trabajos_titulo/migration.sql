-- Módulo de propuestas de trabajo de título: 11 tablas nuevas (prefijo tt_), independientes
-- del login unificado de Persona (ver comentario en schema.prisma).

-- CreateTable
CREATE TABLE "tt_proceso" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,

    CONSTRAINT "tt_proceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tt_grupo" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "proceso_id" INTEGER NOT NULL,

    CONSTRAINT "tt_grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tt_estudiante" (
    "email" VARCHAR(50) NOT NULL,
    "run" VARCHAR(10) NOT NULL,
    "password" VARCHAR(60) NOT NULL,
    "nombres" VARCHAR(50) NOT NULL,
    "apellido_paterno" VARCHAR(50) NOT NULL,
    "apellido_materno" VARCHAR(50) NOT NULL,
    "proceso_id" INTEGER NOT NULL,
    "grupo_id" INTEGER,

    CONSTRAINT "tt_estudiante_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "tt_profesor" (
    "email" VARCHAR(50) NOT NULL,
    "run" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(30) NOT NULL,
    "apellido" VARCHAR(30) NOT NULL,
    "es_guia" BOOLEAN NOT NULL,
    "es_investigador" BOOLEAN NOT NULL,

    CONSTRAINT "tt_profesor_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "tt_linea_investigacion" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,

    CONSTRAINT "tt_linea_investigacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tt_linea_investigacion_profesor" (
    "linea_investigacion_id" INTEGER NOT NULL,
    "profesor_email" VARCHAR(50) NOT NULL,

    CONSTRAINT "tt_linea_investigacion_profesor_pkey" PRIMARY KEY ("linea_investigacion_id","profesor_email")
);

-- CreateTable
CREATE TABLE "tt_rol" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(30) NOT NULL,
    "descripcion" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tt_rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tt_propuesta" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(250) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "modalidad" VARCHAR(20) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "inv_motivacion" TEXT NOT NULL,
    "inv_experiencia" TEXT NOT NULL,
    "cla_problema" TEXT NOT NULL,
    "cla_objetivo" TEXT NOT NULL,
    "hay_cambios" BOOLEAN NOT NULL DEFAULT false,
    "rol_id" INTEGER NOT NULL,
    "estudiante_email" VARCHAR(50) NOT NULL,
    "linea_investigacion_id" INTEGER NOT NULL,

    CONSTRAINT "tt_propuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tt_estado" (
    "id" SERIAL NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "comentario" TEXT,
    "propuesta_id" INTEGER NOT NULL,

    CONSTRAINT "tt_estado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tt_comision" (
    "propuesta_id" INTEGER NOT NULL,
    "profesor_email" VARCHAR(50) NOT NULL,
    "rol" VARCHAR(20) NOT NULL,

    CONSTRAINT "tt_comision_pkey" PRIMARY KEY ("propuesta_id","profesor_email")
);

-- CreateIndex
CREATE INDEX "tt_grupo_proceso_id_idx" ON "tt_grupo"("proceso_id");

-- CreateIndex
CREATE INDEX "tt_estudiante_proceso_id_idx" ON "tt_estudiante"("proceso_id");

-- CreateIndex
CREATE INDEX "tt_estudiante_grupo_id_idx" ON "tt_estudiante"("grupo_id");

-- CreateIndex
CREATE INDEX "tt_linea_investigacion_profesor_profesor_email_idx" ON "tt_linea_investigacion_profesor"("profesor_email");

-- CreateIndex
CREATE INDEX "tt_propuesta_rol_id_idx" ON "tt_propuesta"("rol_id");

-- CreateIndex
CREATE INDEX "tt_propuesta_estudiante_email_idx" ON "tt_propuesta"("estudiante_email");

-- CreateIndex
CREATE INDEX "tt_propuesta_linea_investigacion_id_idx" ON "tt_propuesta"("linea_investigacion_id");

-- CreateIndex
CREATE INDEX "tt_estado_propuesta_id_idx" ON "tt_estado"("propuesta_id");

-- CreateIndex
CREATE INDEX "tt_comision_profesor_email_idx" ON "tt_comision"("profesor_email");

-- AddForeignKey
ALTER TABLE "tt_grupo" ADD CONSTRAINT "tt_grupo_proceso_id_fkey" FOREIGN KEY ("proceso_id") REFERENCES "tt_proceso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tt_estudiante" ADD CONSTRAINT "tt_estudiante_proceso_id_fkey" FOREIGN KEY ("proceso_id") REFERENCES "tt_proceso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tt_estudiante" ADD CONSTRAINT "tt_estudiante_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "tt_grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tt_linea_investigacion_profesor" ADD CONSTRAINT "tt_linea_investigacion_profesor_linea_investigacion_id_fkey" FOREIGN KEY ("linea_investigacion_id") REFERENCES "tt_linea_investigacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tt_linea_investigacion_profesor" ADD CONSTRAINT "tt_linea_investigacion_profesor_profesor_email_fkey" FOREIGN KEY ("profesor_email") REFERENCES "tt_profesor"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tt_propuesta" ADD CONSTRAINT "tt_propuesta_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "tt_rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tt_propuesta" ADD CONSTRAINT "tt_propuesta_estudiante_email_fkey" FOREIGN KEY ("estudiante_email") REFERENCES "tt_estudiante"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tt_propuesta" ADD CONSTRAINT "tt_propuesta_linea_investigacion_id_fkey" FOREIGN KEY ("linea_investigacion_id") REFERENCES "tt_linea_investigacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tt_estado" ADD CONSTRAINT "tt_estado_propuesta_id_fkey" FOREIGN KEY ("propuesta_id") REFERENCES "tt_propuesta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tt_comision" ADD CONSTRAINT "tt_comision_propuesta_id_fkey" FOREIGN KEY ("propuesta_id") REFERENCES "tt_propuesta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tt_comision" ADD CONSTRAINT "tt_comision_profesor_email_fkey" FOREIGN KEY ("profesor_email") REFERENCES "tt_profesor"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

