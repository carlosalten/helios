# CLAUDE.md — app (frontend)

Guía del frontend Nuxt 4 (`app/`). La fuente de verdad de la arquitectura (API Nitro, BD, sesión, permisos, reglas de endpoints) está en el **[CLAUDE.md raíz](../CLAUDE.md)** — este archivo cubre solo lo específico del frontend. Helios es **una sola app Nuxt**: el frontend y la API viven en el mismo proyecto.

## Commands

```bash
npm run dev        # dev server en http://localhost:3000
npm run build      # build de producción
npm run preview    # previsualizar el build
npm run typecheck  # nuxt typecheck (requiere vue-tsc)
```

No hay scripts de lint ni test configurados aún.

## Arquitectura

Layout `app/` de **Nuxt 4**:

- **`app/pages/`** — Rutas basadas en archivos. `index.vue` → `/`.
- **`app/layouts/`** — `default.vue` (app) y `auth.vue` (login), vía `<NuxtLayout>` en `app.vue`.
- **`app/components/`** — Componentes compartidos auto-importados (`ConfirmModal`, `EmptyState`, `TableSkeleton`, …).
- **`app/middleware/`** — `auth.global.ts` redirige a `/login` sin sesión y a `/` si el rol no tiene `ver` para la ruta.
- **`app/types/`** — Interfaces de dominio (`Persona`, `Sala`, `SesionUsuario`, …).
- **`app/app.vue`** — Raíz; envuelve todo en `<UApp>` (requerido por Nuxt UI) y `<NuxtLayout>`.
- **`server/api/`** (en la raíz del proyecto, no bajo `app/`) — Endpoints Nitro que las páginas consumen directamente.
- **`nuxt.config.ts`** — Módulos, `runtimeConfig` (incluida la config de `session`), i18n.
- **`app/assets/css/main.css`** — Tailwind CSS v4 (CSS-first, sin `tailwind.config.js`).

### Llamadas a datos

Las páginas llaman directamente a los endpoints Nitro de la misma app (no hay proxy ni microservicios):

```ts
useFetch<Persona[]>('/api/personas')
$fetch('/api/salas', { method: 'POST', body })
$fetch('/api/auth/login', { method: 'POST', body })
```

Los reportes (`bloques-libres`, `topes-horario`) procesan archivos en el browser con `xlsx` — **no hacen ningún `$fetch`**.

## Sesión y acceso

- Sesión con **nuxt-auth-utils**: `useUserSession()` en pages/components; `getUserSession(event)` en server routes.
- El objeto de sesión (`User`) extiende `SesionUsuario` (`app/types/auth.ts` + `auth.d.ts`): `{ email, nombre, apellido, activo, rol, permisos, carrerasJefe }`. Se calcula en el login a partir de una `Persona` con contraseña (ver [CLAUDE.md raíz](../CLAUDE.md)).
- **Hay control de acceso por rol** (ver [CLAUDE.md raíz](../CLAUDE.md)). El login guarda en la sesión `permisos` (agrupados por ruta) y, para `Jefe de Carrera`, `carrerasJefe`. El navbar y `auth.global.ts` los usan para ocultar navegación y bloquear páginas. `Administrador` ve todo (bypass).
- `SesionUsuario.rol` es el nombre de una fila de la tabla `Rol` (administrable desde `/personas/tipos`, `app/types/persona.ts`), no un enum fijo en TS. Los roles con seed inicial son `Administrador`, `Director Departamento`, `Jefe de Carrera`, `Profesor`, `Apoyo Docente`, pero un Administrador puede agregar más.
- Cookie de sesión (`nuxt.config.ts` → `runtimeConfig.session`): `sameSite: 'lax'`, `httpOnly`, `secure`, `maxAge: 8h`. **No mover fuera de `runtimeConfig`** (nuxt-auth-utils la lee desde ahí).

### Rutas públicas (sin sesión)

Casi toda la app exige sesión (`auth.global.ts`). Las excepciones son `/login` y `/pantallas/<codigo>` (pantalla física en un hall/pasillo que muestra el horario de una sala — ver `app/pages/pantallas/[codigo].vue`), esta última comparada por prefijo porque el código es dinámico. Si se agrega otra ruta pública:

- `app/middleware/auth.global.ts` — agregarla a `rutasPublicas` (o al chequeo de prefijo, si es dinámica).
- El/los endpoint(s) que consume esa página **no** deben llamar a `requierePermiso`/`requiereAlgunPermiso` — documentar en el propio archivo por qué es intencional (ver `server/api/pantallas/publico/[codigo].get.ts`).
- Layout propio sin sidebar/topbar vía `definePageMeta({ layout: '...' })` (ver `app/layouts/pantalla.vue`): el layout `default.vue` da por hecho que hay una sesión (nombre, rol, logout).
- El middleware CSRF (`server/middleware/origen.ts`) no necesita cambios si el endpoint público es solo GET.

## Dependencias clave

- **@nuxt/ui v4** — Componentes `U*`. Requiere `<UApp>` en la raíz.
- **Tailwind CSS v4** — Config 100% en CSS (`@import`/`@theme` en `app/assets/css/main.css`), sin JS config.
- **nuxt-auth-utils** — Sesiones.
- **@nuxtjs/i18n**, **@nuxt/image**, **xlsx** (reportes client-side).

## UI Patterns

- **UModal**: `#body` para el formulario y `#footer` para los botones. `:ui="{ footer: 'justify-end' }"` para alinear a la derecha.
- **UForm + UModal**: `<UForm id="form-id">` en `#body`; el submit va en `#footer` con `form="form-id"`.
- **@click que solo asigna**: usa `@click="() => { abierto = false }"` (no `@click="abierto = false"`) — el handler debe devolver `void`, no `boolean`, o Nuxt UI marca error de tipos.
- **USelect sentinel**: Radix reserva `''` para limpiar — usa `'__todos__'` para "Todos".
- **USelect items**: `{ label: string, value: T }[]`.
- **UTable columns**: `TableColumn<T>[]`; `accessorKey` para datos, `id` para columnas custom. Datos en cell slots vía `row.original`.
- **UTable acciones**: todo `UButton` de acción en la columna `acciones` va envuelto en `UTooltip` con el mismo texto que su `aria-label`. Patrón:
  ```vue
  <UTooltip text="Editar">
     <UButton icon="i-lucide-pen" color="neutral" variant="ghost" size="xs"
        aria-label="Editar" @click="abrirEditar(row.original)" />
  </UTooltip>
  ```
- **UTable paginación**: toda `UTable` pagina de a 10 items usando el composable `usePaginacion` (`app/composables/usePaginacion.ts`). Nunca pasar el array completo/filtrado directo a `:data` ni reimplementar el slicing a mano. Patrón:
  ```ts
  const { paginaActual, itemsPagina, porPagina } = usePaginacion(entidadesFiltradas)
  ```
  ```vue
  <UTable :data="itemsPagina" :columns="columnas">...</UTable>

  <div v-if="entidadesFiltradas.length > porPagina" class="flex justify-center">
     <UPagination v-model:page="paginaActual" :total="entidadesFiltradas.length" :items-per-page="porPagina" />
  </div>
  ```
  `usePaginacion` recibe un `Ref`/`ComputedRef<T[]>` (la lista ya filtrada/buscada) y devuelve `itemsPagina` (la página actual, para `:data`), `paginaActual` (para `v-model:page`) y `porPagina` (10). Resetea la página a 1 automáticamente cuando cambia el total de items (p. ej. al filtrar).

## Componentes compartidos (siempre usar — nunca inline)

- **`ConfirmModal`** — confirmaciones destructivas. Props: `v-model:open`, `title`, `confirm-label`, `confirm-color`, `confirm-icon`, `loading`. Emite `@confirm`.
- **`EmptyState`** — listas vacías / placeholders. Props: `icon`, `message`, `action?`. Emite `@action`.
- **`TableSkeleton`** — mientras `status === 'pending'`. Prop: `rows`.

## Indicadores de carga

Hay dos niveles, y no se pisan:

- **Navegación entre páginas** — automática, no hay que hacer nada. `app/app.vue` monta `<NuxtLoadingIndicator>` (barra de progreso superior) y `layouts/default.vue` atenúa el `<main>` con un velo y un badge "Cargando…" mientras dura. Hace falta porque las páginas resuelven sus `useFetch` con `await` en `<script setup>`: Nuxt suspende la navegación y deja la página anterior en pantalla hasta que llegan los datos. Ambos comparten el estado de `useLoadingIndicator()` (throttle de 200 ms, así que una navegación instantánea no alcanza a mostrar nada).
- **Carga inicial de una lista** — `TableSkeleton` con `status === 'pending'`, como siempre.
- **Refresco de datos con la página ya montada** (un `refresh()` tras guardar, un filtro que vuelve a pedir al servidor) — `useIndicadorCarga`, que reutiliza el mismo indicador global de la navegación:

   ```ts
   const { conIndicador } = useIndicadorCarga()

   async function recargar() {
      await conIndicador(() => refresh())
   }
   ```

   Apaga el indicador aunque la operación falle, y deja pasar la excepción para que el llamador maneje el error como siempre.

## Responsive Design

- Todas las vistas responsivas (móvil, tablet, escritorio). Breakpoints Tailwind: `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280.
- Patrón: en móvil se apila; en desktop se organiza en columnas con `lg:grid` / `lg:flex`. Sin scroll horizontal.

## Code Style

- Clases TailwindCSS — nunca CSS raw, IDs ni selectores de tag.
- ES modules. Nombres en español para constantes, variables, objetos y métodos.
- Exports nombrados en vez de default.
- En componentes Vue: bloque `<script setup>` primero, luego `<template>`.

TypeScript Rules (`strict`, sin `any`) en el [CLAUDE.md raíz](../CLAUDE.md) — aplican igual aquí.

## Code Templates

### Página (`app/pages/seccion/nombre-pagina.vue`)

```vue
<script setup lang="ts">
import type { Persona } from '~/types/persona'

const { data: personas, refresh } = await useFetch<Persona[]>('/api/personas')
const guardando = ref(false)

async function crear(body: Record<string, unknown>) {
  guardando.value = true
  try {
    await $fetch('/api/personas', { method: 'POST', body })
    await refresh()
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 class="text-lg font-semibold text-usm-text dark:text-white">Título</h2>
      <UButton icon="i-lucide-plus" @click="abrirModal">Nuevo</UButton>
    </div>
    <!-- contenido -->
  </div>
</template>
```

### Modal con formulario

```vue
<template>
  <UModal v-model:open="modalAbierto" title="Nueva entidad" :ui="{ footer: 'justify-end' }">
    <template #body>
      <UForm id="form-entidad" :state="form" @submit="guardar" class="space-y-4">
        <UFormField label="Nombre" name="nombre">
          <UInput v-model="form.nombre" class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <UButton variant="ghost" color="neutral" @click="() => { modalAbierto = false }">Cancelar</UButton>
      <UButton type="submit" form="form-entidad" :loading="guardando">Guardar</UButton>
    </template>
  </UModal>
</template>
```

### Convenciones de nombres de archivos

| Tipo | Ubicación | Ejemplo |
|---|---|---|
| Página | `app/pages/` | `personas/gestion.vue` |
| Componente reutilizable | `app/components/` | `ConfirmModal.vue` |
| Tipo de dominio | `app/types/` | `persona.ts` |

> Los schemas Zod y los endpoints viven en `server/` (en la raíz del proyecto). Ver el [CLAUDE.md raíz](../CLAUDE.md).
