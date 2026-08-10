-- Seed: acceso de lectura por defecto a la nueva página /paralelos/asignacion (malla +
-- paneles de curso para crear paralelos arrastrando asignaturas) para los 4 roles
-- no-Administrador. Crear un paralelo desde ahí sigue dependiendo del permiso 'crear' ya
-- existente en /paralelos (mismo endpoint POST /api/paralelos que usa la página clásica).
INSERT INTO "permiso" ("rol", "ruta", "accion")
SELECT rol.nombre, '/paralelos/asignacion', 'ver'
FROM (VALUES ('Director Departamento'), ('Jefe de Carrera'), ('Profesor'), ('Apoyo Docente')) AS rol(nombre)
ON CONFLICT ("rol", "ruta", "accion") DO NOTHING;
