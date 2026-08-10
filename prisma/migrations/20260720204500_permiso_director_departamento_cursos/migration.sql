-- 'Director Departamento' puede crear/editar/borrar cursos, acotado en el endpoint a las
-- carreras a las que está asociado (server/utils/alcanceCarrera.ts, resolverCarrerasCursos).
-- Antes solo tenía 'ver' en /cursos, igual que Profesor y Apoyo Docente (que no deben
-- poder crear/editar/borrar cursos).
INSERT INTO "permiso" ("rol", "ruta", "accion")
SELECT 'Director Departamento', '/cursos', accion.valor
FROM (VALUES ('crear'), ('editar'), ('borrar')) AS accion(valor)
ON CONFLICT ("rol", "ruta", "accion") DO NOTHING;
