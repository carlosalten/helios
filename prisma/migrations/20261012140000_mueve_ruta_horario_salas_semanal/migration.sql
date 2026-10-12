-- /reservas/horario se movió a la sección Horario como /horario/salas-semanal: los permisos
-- asignados a la ruta antigua pasan tal cual a la nueva (mismos roles y acciones).
UPDATE "permiso" SET "ruta" = '/horario/salas-semanal' WHERE "ruta" = '/reservas/horario';
