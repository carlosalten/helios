-- Fusiona Usuario (cuentas de acceso, antes auth-service) en Persona (agenda académica,
-- antes horario-service): el login pasa a hacerse contra Persona. rol_persona pasa a
-- llamarse "rol" y queda como único concepto de rol, usado tanto para clasificar a la
-- persona como para el control de acceso (permiso.rol referencia rol.nombre).
--
-- Se truncan las tablas dependientes de persona/usuario/carrera/rol_persona: proyecto en
-- desarrollo sin datos de producción, y el remodelado de FKs no es viable preservando filas
-- (persona pierde su rol anterior de solo-agenda y usuario desaparece por completo).

TRUNCATE TABLE
   "persona",
   "usuario",
   "carrera",
   "rol_persona"
RESTART IDENTITY CASCADE;

-- Persona gana password: nullable porque no toda persona tiene cuenta de acceso, solo
-- las que necesitan iniciar sesión.
ALTER TABLE "persona" ADD COLUMN "password" VARCHAR(60);

-- rol_persona -> rol
ALTER TABLE "rol_persona" RENAME TO "rol";
ALTER TABLE "rol" RENAME CONSTRAINT "rol_persona_pkey" TO "rol_pkey";

-- persona.rol_persona_id -> persona.rol_id
ALTER TABLE "persona" RENAME COLUMN "rol_persona_id" TO "rol_id";
ALTER TABLE "persona" RENAME CONSTRAINT "persona_rol_persona_id_fkey" TO "persona_rol_id_fkey";
ALTER INDEX "persona_rol_persona_id_idx" RENAME TO "persona_rol_id_idx";

-- El login ahora se hace contra Persona: usuario deja de existir.
DROP TABLE "usuario";

-- Los roles fijos que antes eran solo un enum en la app (ROLES_USUARIO) pasan a ser filas
-- administrables de `rol`, igual que cualquier otro tipo de persona.
INSERT INTO "rol" ("nombre") VALUES
   ('Administrador'),
   ('Director Departamento'),
   ('Jefe de Carrera'),
   ('Profesor'),
   ('Apoyo Docente');

-- /usuarios deja de existir como ruta propia: su gestión (contraseña, cambiar rol,
-- activar/bloquear) se fusiona dentro de /personas/gestion.
DELETE FROM "permiso" WHERE "ruta" = '/usuarios';

-- Seed: replica en /personas/gestion el acceso total por defecto que tenían las acciones
-- finas de /usuarios, para los 4 roles no-Administrador.
INSERT INTO "permiso" ("rol", "ruta", "accion")
SELECT rol.nombre, '/personas/gestion', accion.valor
FROM (VALUES ('Director Departamento'), ('Jefe de Carrera'), ('Profesor'), ('Apoyo Docente')) AS rol(nombre)
CROSS JOIN (VALUES ('contrasena'), ('cambiarrol'), ('activar')) AS accion(valor)
ON CONFLICT ("rol", "ruta", "accion") DO NOTHING;
