-- /horario/salas se renombró a /horario/salas-semestral: los permisos asignados a la ruta
-- antigua pasan tal cual a la nueva (mismos roles y acciones).
UPDATE "permiso" SET "ruta" = '/horario/salas-semestral' WHERE "ruta" = '/horario/salas';
