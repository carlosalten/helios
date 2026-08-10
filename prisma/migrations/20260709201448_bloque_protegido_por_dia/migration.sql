-- AlterTable
ALTER TABLE "bloque" DROP COLUMN "protegido";

-- CreateTable
CREATE TABLE "bloque_protegido" (
    "bloque_id" INTEGER NOT NULL,
    "dia_semana" SMALLINT NOT NULL,

    CONSTRAINT "bloque_protegido_pkey" PRIMARY KEY ("bloque_id","dia_semana")
);

-- AddForeignKey
ALTER TABLE "bloque_protegido" ADD CONSTRAINT "bloque_protegido_bloque_id_fkey" FOREIGN KEY ("bloque_id") REFERENCES "bloque"("id") ON DELETE CASCADE ON UPDATE CASCADE;
