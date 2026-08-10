-- CreateTable
CREATE TABLE "tipo_sala" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,

    CONSTRAINT "tipo_sala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sala" (
    "codigo" VARCHAR(20) NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "tipo_sala_id" INTEGER NOT NULL,

    CONSTRAINT "sala_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "sala_usuario" (
    "codigo_sala" VARCHAR(20) NOT NULL,
    "usuario_email" VARCHAR(50) NOT NULL,

    CONSTRAINT "sala_usuario_pkey" PRIMARY KEY ("codigo_sala","usuario_email")
);

-- CreateTable
CREATE TABLE "rol_persona" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(30) NOT NULL,

    CONSTRAINT "rol_persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona" (
    "email" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(20) NOT NULL,
    "apellido" VARCHAR(20) NOT NULL,
    "activo" BOOLEAN NOT NULL,
    "rol_persona_id" INTEGER NOT NULL,

    CONSTRAINT "persona_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "tipo_reserva" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(30) NOT NULL,

    CONSTRAINT "tipo_reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserva" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "inicio" TIME NOT NULL,
    "fin" TIME NOT NULL,
    "codigo_sala" VARCHAR(20) NOT NULL,
    "tipo_reserva_id" INTEGER NOT NULL,
    "persona_email" VARCHAR(50) NOT NULL,

    CONSTRAINT "reserva_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sala" ADD CONSTRAINT "sala_tipo_sala_id_fkey" FOREIGN KEY ("tipo_sala_id") REFERENCES "tipo_sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sala_usuario" ADD CONSTRAINT "sala_usuario_codigo_sala_fkey" FOREIGN KEY ("codigo_sala") REFERENCES "sala"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona" ADD CONSTRAINT "persona_rol_persona_id_fkey" FOREIGN KEY ("rol_persona_id") REFERENCES "rol_persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_codigo_sala_fkey" FOREIGN KEY ("codigo_sala") REFERENCES "sala"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_tipo_reserva_id_fkey" FOREIGN KEY ("tipo_reserva_id") REFERENCES "tipo_reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_persona_email_fkey" FOREIGN KEY ("persona_email") REFERENCES "persona"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
