import bcrypt from 'bcryptjs'
import { z } from 'zod'
import type { PermisoResumen } from '~/types/permiso'

// Login consolidado: verifica credenciales contra Persona (la misma tabla que la agenda
// académica) y crea la sesión Nuxt en un solo paso. Sin secreto interno ni llamadas entre
// servicios: los permisos y las carreras del jefe se calculan directamente contra la BD única.
const LoginSchema = z.object({
   email: z.string().trim().toLowerCase().email(),
   password: z.string().min(1),
   // Token de Cloudflare Turnstile. Ausente en el primer intento (siempre permitido sin
   // captcha); requerido desde el segundo — ver el chequeo de `yaFalloAntes` más abajo.
   turnstileToken: z.string().optional(),
})

const VENTANA_MS = 15 * 60 * 1000 // 15 minutos
const MAX_POR_IP = 5 // intentos (éxitos o fallos) por IP
const MAX_FALLOS_POR_EMAIL = 10 // fallos por cuenta (fuerza bruta distribuida)

export default defineEventHandler(async (event) => {
   // Límite por IP: frena el escaneo masivo desde un mismo origen. `X-Forwarded-For` solo se
   // usa cuando hay un proxy de confianza (runtimeConfig.trustProxy); expuesta directa a
   // internet, esa cabecera la falsifica el cliente y permitiría rotar la IP para evadir el
   // límite. Con trustProxy=false se usa la IP real de la conexión.
   const { trustProxy } = useRuntimeConfig(event)
   const ip = getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'desconocido'
   const claveIp = `login:ip:${ip}`
   const limiteIp = limitarTasa(claveIp, { max: MAX_POR_IP, ventanaMs: VENTANA_MS })
   if (!limiteIp.permitido) {
      const minutos = Math.ceil(limiteIp.reintentarEnSeg / 60)
      throw createError({ statusCode: 429, message: `Demasiados intentos. Reintenta en ${minutos} minuto(s).` })
   }

   const body = await readBody(event)
   const result = LoginSchema.safeParse(body)
   if (!result.success) throw createError({ statusCode: 401, message: 'Credenciales no válidas' })

   const { email, password, turnstileToken } = result.data
   const claveEmail = `login:email:${email}`

   // Límite por cuenta: protege un email aunque el atacante rote de IP.
   const limiteEmail = excedeLimite(claveEmail, MAX_FALLOS_POR_EMAIL)
   if (!limiteEmail.permitido) {
      const minutos = Math.ceil(limiteEmail.reintentarEnSeg / 60)
      throw createError({
         statusCode: 429,
         message: `Cuenta bloqueada temporalmente por intentos fallidos. Reintenta en ${minutos} minuto(s).`,
      })
   }

   // Captcha desde el 2do intento fallido para este email: el primer error de contraseña
   // nunca lo exige (no hay que incomodar a quien solo se equivocó una vez), pero de ahí en
   // adelante cierra el hueco que dejaba libre para probar contraseñas por fuerza bruta.
   // `data.requiereCaptcha` le indica al frontend (login.vue) que muestre el widget.
   const yaFalloAntes = !excedeLimite(claveEmail, 1).permitido
   if (yaFalloAntes) {
      if (!turnstileToken) {
         throw createError({
            statusCode: 401,
            message: 'Verificación de seguridad requerida.',
            data: { requiereCaptcha: true },
         })
      }
      const resultadoCaptcha = await verifyTurnstileToken(turnstileToken, event)
      if (!resultadoCaptcha.success) {
         throw createError({
            statusCode: 401,
            message: 'No se pudo verificar que no eres un robot. Vuelve a intentarlo.',
            data: { requiereCaptcha: true },
         })
      }
   }

   const persona = await prisma.persona.findUnique({
      where: { email },
      include: { rol: true },
      omit: { password: false },
   })
   // Sin contraseña asignada = sin cuenta de acceso (solo agenda/reservas): mismo error
   // genérico que credenciales inválidas, para no filtrar cuáles emails son personas.
   if (!persona || !persona.password) {
      registrarFallo(claveEmail, VENTANA_MS)
      throw createError({ statusCode: 401, message: 'Credenciales no válidas' })
   }

   const passwordValido = await bcrypt.compare(password, persona.password)
   if (!passwordValido) {
      registrarFallo(claveEmail, VENTANA_MS)
      throw createError({ statusCode: 401, message: 'Credenciales no válidas' })
   }

   if (!persona.activo) throw createError({ statusCode: 401, message: 'Acceso al sistema suspendido.' })

   // Login exitoso: limpiar contadores de IP y de la cuenta.
   reiniciarTasa(claveIp)
   reiniciarTasa(claveEmail)

   const rol = persona.rol.nombre

   // Administrador tiene bypass total: no necesita filas de permiso.
   let permisos: PermisoResumen[] = []
   let carrerasJefe: number[] | null = null

   if (rol !== 'Administrador') {
      const filas = await prisma.permiso.findMany({ where: { rol } })
      const agrupado = new Map<string, string[]>()
      for (const f of filas) agrupado.set(f.ruta, [...(agrupado.get(f.ruta) ?? []), f.accion])
      permisos = Array.from(agrupado, ([ruta, acciones]) => ({ ruta, acciones }))

      if (rol === 'Jefe de Carrera') {
         carrerasJefe = await resolverCarrerasJefe(rol, persona.email)
      }
   }

   await setUserSession(event, {
      user: {
         tipo: 'staff',
         email: persona.email,
         nombre: persona.nombre,
         apellido: persona.apellido,
         activo: persona.activo,
         rol,
         jerarquiaRol: persona.rol.jerarquia,
         personaId: persona.id,
         permisos,
         carrerasJefe,
         temaPreferido: persona.temaPreferido,
         mostrarTopesEspejo: persona.mostrarTopesEspejo,
         colorTopesEspejo: persona.colorTopesEspejo,
         emoji: persona.emoji,
      },
   })
   return { ok: true }
})
