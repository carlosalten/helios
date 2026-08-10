export default defineNuxtConfig({
   compatibilityDate: '2026-07-09',
   modules: ['@nuxt/ui', '@nuxt/image', 'nuxt-auth-utils', '@nuxtjs/i18n', '@nuxtjs/turnstile'],

   runtimeConfig: {
      // Solo disponibles server-side (nunca expuestos al browser)
      session: {
         maxAge: 60 * 60 * 8,
         cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
         },
      },
      // Confiar en la cabecera `X-Forwarded-For` para obtener la IP del cliente (rate-limit del
      // login). Debe ser `true` SOLO cuando la app corre detrás de un proxy propio que reescribe
      // esa cabecera; expuesta directa a internet, un atacante la falsifica y evade el límite por
      // IP. Default seguro: false (usa la IP real de la conexión). Setear NUXT_TRUST_PROXY=true
      // en el .env solo en despliegues con proxy de confianza.
      trustProxy: process.env.NUXT_TRUST_PROXY === 'true',
      public: {},
   },

   // Captcha en /login a partir del 2do intento fallido (server/api/auth/login.post.ts). En
   // dev, sin llaves configuradas, el módulo usa automáticamente las llaves de prueba de
   // Cloudflare (siempre pasan). En producción hay que definir NUXT_PUBLIC_TURNSTILE_SITE_KEY
   // y NUXT_TURNSTILE_SECRET_KEY en el .env con las llaves reales del sitio — deben ir acá (no
   // en `runtimeConfig.turnstile` directamente) para que, en dev, el `undefined` cuando no
   // están seteadas caiga en el default del módulo (las llaves de prueba) y no en un string
   // vacío.
   turnstile: {
      siteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY,
      secretKey: process.env.NUXT_TURNSTILE_SECRET_KEY,
   },

   // Cabeceras de seguridad para todas las respuestas. Se usa CSP solo con `frame-ancestors`
   // (anti-clickjacking) para no romper los scripts/estilos inline de Nuxt UI; el resto son
   // cabeceras de refuerzo sin efectos colaterales. HSTS solo actúa sobre HTTPS (los
   // navegadores la ignoran en http/localhost).
   routeRules: {
      '/**': {
         headers: {
            'X-Frame-Options': 'DENY',
            'Content-Security-Policy': "frame-ancestors 'none'",
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
         },
      },
   },

   // i18n, css, colorMode igual que el original
   i18n: {
      defaultLocale: 'es',
      locales: [{ code: 'es', language: 'es-CL' }],
   },
   css: ['~/assets/css/main.css'],
   colorMode: { preference: 'light' },
   vite: {
      optimizeDeps: {
         include: ['@vue/devtools-core', '@vue/devtools-kit', 'xlsx'],
      },
   },
})
