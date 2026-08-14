# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Helios — App única Nuxt

Sistema de gestión de información de un departamento universitario. **Una sola aplicación Nuxt 4** (antes eran tres paquetes: `auth-service`, `horario-service` y un `frontend`, ya consolidados). El frontend, la API y la autenticación viven en el mismo proceso Nitro, contra **una sola base de datos PostgreSQL**.

## Estructura del proyecto

```
helios/
├── app/                  # Frontend Nuxt 4 (pages, components, layouts, types)
│   └── CLAUDE.md         # Patrones Vue/UI/responsive (léelo al tocar el frontend)
├── server/
│   ├── api/              # Endpoints Nitro (auth, personas, salas, planes, permisos, …)
│   ├── utils/            # prisma, permisos, schemas Zod, rateLimit, helpers (auto-importados)
│   └── middleware/
│       └── origen.ts     # CSRF (Origin/Referer)
├── prisma/
│   ├── schema.prisma     # Todos los modelos (Persona + Rol + Permiso + dominio académico)
│   └── migrations/       # Historial único de migraciones
├── generated/prisma/     # Cliente Prisma generado (gitignored)
├── i18n/ · public/ · assets (en app/)
├── nuxt.config.ts · prisma.config.ts · tsconfig.json · package.json
└── .env                  # NUXT_SESSION_PASSWORD, DATABASE_URL
```

## Commands

```bash
npm install        # instala deps + postinstall (prisma generate && nuxt prepare)
npm run dev        # dev server en http://localhost:3000
npm run build      # build de producción
npm run preview    # previsualizar el build
npm run typecheck  # nuxt typecheck (vue-tsc)
npm run migrate    # prisma migrate dev
npm run prisma:generate  # prisma generate
```

No hay scripts de lint ni test configurados aún.

> Las herramientas de PostgreSQL (`psql`, `pg_dump`) de esta máquina están en `/Users/Shared/DBngin/postgresql/17.0/bin` (DBngin), no en el PATH por defecto.

### Servidor de desarrollo

El usuario gestiona el dev server; no lo dejes corriendo "por si acaso" ni lo reinicies sin necesidad. Si necesitas probar algo puntual (smoke test) y no está arriba, puedes levantarlo tú mismo — pero al terminar esa prueba, **bájalo** (`pkill -f "nuxt dev --port 3000"` u otro). No lo dejes corriendo después de usarlo salvo que el usuario te pida explícitamente que quede arriba.

## Arquitectura de comunicación

**No hay proxy ni microservicios.** El browser llama directamente a los endpoints Nitro de la misma app:

```
Browser → app:3000 → server/api/*  (misma sesión, misma BD)
```

- El browser usa `useUserSession()` / `useFetch`/`$fetch` contra `/api/...`.
- En el servidor, la sesión está disponible directamente con `getUserSession(event)` (nuxt-auth-utils). **Ya no existen headers internos (`x-internal-secret`, `x-internal-user`) ni un secreto compartido.**

### URLs en las páginas Vue

```ts
$fetch('/api/personas') // personas: agenda académica + cuentas de acceso (login)
$fetch('/api/salas') // salas, reservas, planes…
$fetch('/api/carreras')
$fetch('/api/permisos') // matriz de permisos por rol
$fetch('/api/auth/login', { method: 'POST', body })
$fetch('/api/auth/logout', { method: 'POST' })
```

Los reportes (`bloques-libres`, `topes-horario`) procesan archivos localmente en el browser con `xlsx` — **no hacen ningún `$fetch`**.

## Base de datos — una sola BD `helios`

Toda la app usa una única base PostgreSQL (`DATABASE_URL` en `.env`), con un solo `prisma/schema.prisma` y un solo historial de migraciones. El cliente se genera en `generated/prisma`.

Singleton Prisma en `server/utils/prisma.ts` (adapter `PrismaPg`). Nuxt carga el `.env` automáticamente.

### Invariantes garantizadas a nivel de BD

Estas reglas viven en PostgreSQL (no en Prisma) vía migraciones manuales con SQL raw. **No las repliques ni las contradigas desde la app; el código puede confiar en que la BD las cumple, pero valida antes en el endpoint para devolver un 422 legible en vez de un 500 de constraint.**

- **`reserva_granularidad_5min`** — `inicio` y `fin` de una reserva en múltiplos de 5 minutos.
- **`reserva_fin_mayor_inicio`** — en `reserva`, `fin > inicio`.
- **`semestre_fin_mayor_inicio`** — en `semestre`, `fecha_fin > fecha_inicio`.
- **`bloque_fin_mayor_inicio`** — en `bloque`, `fin > inicio`.
- **`bloque_un_ultimo_manana_por_semestre`** — índice único parcial en `bloque` (`semestre_id`) `WHERE es_ultimo_manana`: a lo más un bloque por semestre puede marcarse como el último de la mañana.
- **`asignatura_bloques_teoria_no_negativo`** / **`asignatura_bloques_practica_no_negativo`** — `>= 0`.
- **`asignatura_plan_semestre_positivo`** — en `asignatura_plan`, `semestre >= 1`.
- **`plan_cantidad_semestres_rango`** — en `plan`, `cantidad_semestres` entre 4 y 12 (default 4).
- **`curso_numero_positivo`** — en `curso`, `numero >= 1`.
- **`tt_grupo_numero_positivo`** — en `tt_grupo`, `numero >= 1`. Además, `numero` es único junto con `proceso_id` (`tt_grupo_proceso_id_numero_key`): no se puede repetir dentro del mismo proceso, pero sí entre procesos distintos.
- **`curso_numero_semestre_rango`** — en `curso`, `numero_semestre` entre 1 y 12.
- **`paralelo_cupo_rango`** — en `paralelo`, `cupo` entre 0 y 100.
- **`feriado_horas_validas`** — en `feriado`, `hora_inicio`/`hora_termino` van ambos `null` (feriado de día completo) o ambos con valor y `hora_termino > hora_inicio` (feriado parcial).
- **`asignatura_equivalencia_no_refleja`** — en `asignatura_equivalencia`, `asignatura_id <> equivalente_id` (una asignatura no puede ser equivalente a sí misma).

> Estas constraints se crearon con migraciones SQL a mano y **no** están representadas en `schema.prisma` (Prisma no modela CHECK/EXCLUDE). Un `prisma migrate reset` las reconstruye porque siguen en `prisma/migrations/`, pero `prisma migrate diff` contra el datamodel las reporta como "drift" esperado.

> `Reserva` **permite intencionalmente** horario solapado (no existe una constraint `reserva_sin_solapamiento`): en `/reservas/horario`, las reservas que se solapan en el tiempo para una misma sala se agrupan en columnas una al lado de la otra en vez de rechazarse.

> `Reserva.cancelada` (`PATCH /api/reservas/:id/cancelar`) marca una ocurrencia puntual como cancelada **sin borrar la fila** — sigue tomando la sala en la BD, pero se destaca en rojo (`#C8102E`) en `/reservas/horario` (grilla interactiva e impresión) y en la pantalla pública (`/pantallas/<codigo>`, con la etiqueta "Cancelada"). Solo afecta esa ocurrencia: no tiene el flujo "esta y las siguientes" que sí tienen editar/borrar — cancelar una serie recurrente completa es ocurrencia por ocurrencia. Borrar (`DELETE /api/reservas/:id`) sigue siendo una operación aparte, que sí elimina la fila.

> `Reserva.publica` (default `true`) controla si la reserva se muestra en vistas de cara al público: la vista impresa de `/reservas/horario` y la pantalla pública (`/pantallas/<codigo>`). En `false` la reserva sigue tomando la sala en la BD y se ve igual que cualquier otra en la grilla interactiva de `/reservas/horario`, pero queda fuera del reporte en papel y de `/pantallas/<codigo>` — para bloqueos internos (p. ej. mantenimiento) que no corresponde anunciar.

## Backend — API Nitro

- Rutas en `server/api/`.
- Middleware CSRF en `server/middleware/origen.ts` (rechaza 403 mutaciones cuyo `Origin`/`Referer` no coincida con el host).
- Singleton Prisma en `server/utils/prisma.ts`.
- Validación de cuerpo en `server/utils/*.schemas.ts` con Zod v4.
- Guard de sesión + rol vía `requierePermiso(event, ruta, accion)` en `server/utils/permisos.ts`.

### Control de acceso por rol (real)

Hay control de acceso por rol basado en la tabla `permiso` (`rol` + `ruta` + `accion`):

```ts
export async function requierePermiso(event, ruta, accion) {
   const { user } = await getUserSession(event)
   if (!user) throw createError({ statusCode: 401 })
   const usuario = user as { email: string; rol: string }
   if (usuario.rol === 'Administrador') return usuario // bypass total
   const permiso = await prisma.permiso.findUnique({
      where: { rol_ruta_accion: { rol: usuario.rol, ruta, accion } },
   })
   if (!permiso) throw createError({ statusCode: 403 })
   return usuario
}
```

- **`Administrador`** tiene bypass hardcodeado (nunca se guarda como fila en `permiso`), para no quedar bloqueado por un seed o borrado accidental.
- El resto de roles (`Director Departamento`, `Jefe de Carrera`, `Profesor`, `Apoyo Docente`) necesitan una fila `(rol, ruta, accion)` para cada acción. El Administrador administra esto desde la página `/permisos`.
- `'/permisos'` es una ruta protegida pero **no asignable**: solo el Administrador la ve.
- Acciones: `ver`, `crear`, `editar`, `borrar` (genéricas) y, solo para `/personas/gestion`, las finas `contrasena`, `cambiarrol`, `activar` (gestionan la cuenta de acceso, no solo los datos de la persona).
- El **login se hace contra `Persona`** (`server/api/auth/login.post.ts`): `Persona.password` es nullable — una persona sin contraseña no tiene cuenta de acceso, solo agenda/reservas. `usuario.rol` en `requierePermiso`/sesión es el nombre de la fila de `Rol` asociada (`persona.rol.nombre`), no un enum fijo en TS.
- Al hacer login se calculan `permisos` (agrupados por ruta) y, si el rol es `Jefe de Carrera`, `carrerasJefe` (vía `resolverCarrerasJefe`). Ambos se guardan en la sesión Nuxt y se usan en el frontend para ocultar navegación y páginas.

### Alcance por carrera (Jefe de Carrera)

`resolverCarrerasJefe(rol, email)` (en `server/utils/carreras.ts`... ver `alcanceCarrera.ts`) devuelve `null` (sin restricción) para todo rol distinto de `Jefe de Carrera`, o `number[]` con los códigos de carrera de los que la persona es jefe. Los endpoints de horario filtran/validan contra ese `carrerasPermitidas`.

### Reglas obligatorias al crear endpoints

- **Todo endpoint (GET y mutaciones)** valida la sesión y el permiso con `requierePermiso(event, ruta, accion)` como primera línea. Los únicos endpoints "solo sesión" (sin chequeo de tabla) son `permisos/mios.get` y `permisos/carreras-jefe.get` (un usuario necesita leer sus propios permisos aunque no tenga `ver` en `/permisos`).
- Las excepciones públicas son `auth/login` y `auth/logout` (manejan la sesión Nuxt directamente; login es público).
- **Nunca uses GET para mutar datos** — `SameSite=Lax` solo protege contra CSRF en métodos no-GET.

## Frontend — Nuxt 4

Directorio `app/` (layout Nuxt 4). Detalles de Vue/UI/responsive en **[app/CLAUDE.md](app/CLAUDE.md)**.

- **`app/pages/`** — Rutas por archivo.
- **`app/layouts/`** — `default.vue` (app) y `auth.vue` (login).
- **`app/components/`** — Compartidos auto-importados (`ConfirmModal`, `EmptyState`, `TableSkeleton`, …).
- **`app/middleware/auth.global.ts`** — Redirige a `/login` sin sesión y a `/` si el rol no tiene `ver` para la ruta.
- **`app/types/`** — Interfaces de dominio.
- **`server/api/auth/`** — Login y logout (crean/destruyen la sesión Nuxt).
- **`nuxt.config.ts`** — Módulos, `runtimeConfig.session`, i18n.

### `runtimeConfig`

```ts
runtimeConfig: {
   session: { maxAge: 60 * 60 * 8, cookie: { httpOnly: true, sameSite: 'lax', secure: NODE_ENV==='production' } },
   public: {},
}
```

`DATABASE_URL` lo lee `prisma.ts` desde `process.env` (Nuxt carga `.env`); no va en `runtimeConfig`.

## Defensas de seguridad (no romper)

- **Cookie de sesión**: `sameSite: 'lax'`, `httpOnly`, `secure` (prod), `maxAge: 8h`.
- **Middleware CSRF** (`server/middleware/origen.ts`): rechaza (403) mutaciones cuyo `Origin`/`Referer` no coincida con el host.
- **Rate-limit** en `server/utils/rateLimit.ts`, usado en el login: por IP (5 intentos / 15 min) y por email (10 fallos / 15 min) → 429.
- **Control de acceso por rol** vía `requierePermiso` + tabla `permiso`.

## Dependencias clave

- **Nuxt 4 + Vue 3**, **@nuxt/ui v4** (requiere `<UApp>` en la raíz), **Tailwind CSS v4** (config en CSS puro).
- **nuxt-auth-utils** — Sesiones. `useUserSession()` en pages/components; `getUserSession(event)`/`setUserSession(event, …)` en server routes.
- **Prisma v7** (adapter `PrismaPg`) + **pg**.
- **Zod v4** — en v4 usar `error:` en lugar de `required_error`/`invalid_type_error`.
- **bcryptjs** — hash de contraseñas (login).
- **xlsx** — reportes client-side.

## Code Style

- ES modules (no CommonJS).
- Nombres en español para constantes, variables, objetos y métodos.
- Exports nombrados en lugar de default (excepto donde el framework lo exige, p. ej. `export default defineEventHandler(...)`).

## TypeScript Rules

- **`strict: true` siempre.** **Nunca usar `any`.** Preferir tipos específicos, interfaces o genéricos.

## Code Templates

Templates de página y modal (Vue) en [app/CLAUDE.md](app/CLAUDE.md). Los de abajo son para endpoints Nitro.

### Endpoint GET (`server/api/entidades/index.get.ts`)

```ts
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/entidades', 'ver')
   return prisma.entidad.findMany({ orderBy: { nombre: 'asc' } })
})
```

### Endpoint POST con validación (`server/api/entidades/index.post.ts`)

```ts
export default defineEventHandler(async (event) => {
   await requierePermiso(event, '/entidades', 'crear')

   const body = await readBody(event)
   const parsed = crearEntidadSchema.safeParse(body)
   if (!parsed.success) {
      throw createError({ statusCode: 422, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
   }

   return prisma.entidad.create({ data: parsed.data })
})
```

### Zod Schema (`server/utils/entidades.schemas.ts`)

```ts
import { z } from 'zod'

export const crearEntidadSchema = z.object({
   nombre: z.string({ error: 'El nombre es requerido' }).min(1),
})

export type CrearEntidadInput = z.infer<typeof crearEntidadSchema>
```

## Convenciones de nombres de archivos

| Tipo                    | Ubicación               | Ejemplo                                      |
| ----------------------- | ----------------------- | -------------------------------------------- |
| Página                  | `app/pages/`            | `personas/gestion.vue`, `carreras/index.vue` |
| Componente reutilizable | `app/components/`       | `ConfirmModal.vue`                           |
| Tipo de dominio         | `app/types/`            | `persona.ts`                                 |
| Schema Zod              | `server/utils/`         | `personas.schemas.ts`                        |
| API GET lista           | `server/api/<recurso>/` | `index.get.ts`                               |
| API POST crear          | `server/api/<recurso>/` | `index.post.ts`                              |
| API PATCH/DELETE por id | `server/api/<recurso>/` | `[id].patch.ts`, `[id].delete.ts`            |
