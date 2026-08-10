-- CreateTable
CREATE TABLE "usuario" (
    "email" VARCHAR(50) NOT NULL,
    "password" VARCHAR(60) NOT NULL,
    "nombre" VARCHAR(20) NOT NULL,
    "apellido" VARCHAR(20) NOT NULL,
    "activo" BOOLEAN NOT NULL,
    "rol" VARCHAR(30) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("email")
);

-- Seed: acceso total a /usuarios para los 4 roles no-Administrador (replica el estado
-- por defecto que traía auth-service al consolidarse en la app única). El rol
-- Administrador tiene bypass hardcodeado en requierePermiso y no necesita filas.
INSERT INTO "permiso" ("rol", "ruta", "accion")
SELECT rol.nombre, '/usuarios', accion.valor
FROM (VALUES ('Director Departamento'), ('Jefe de Carrera'), ('Profesor'), ('Apoyo Docente')) AS rol(nombre)
CROSS JOIN (VALUES ('ver'), ('crear'), ('editar'), ('contrasena'), ('cambiarrol'), ('activar'), ('borrar')) AS accion(valor)
ON CONFLICT ("rol", "ruta", "accion") DO NOTHING;
