import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { codificarPermisosSesion, type PermisoResumen } from '~/types/permiso'

// Login consolidado: verifica credenciales contra Persona (la misma tabla que la agenda
// académica) y crea la sesión Nuxt en un solo paso. Sin secreto interno ni llamadas entre
// servicios: los permisos y las carreras del jefe se calculan directamente contra la BD única.
const LoginSchema = z.object({
   email: z.string().trim().toLowerCase().email(),
   password: z.string().min(1),
   // Token de Cloudflare Turnstile. Ausente en el primer intento; se exige desde el 2do fallo
   // de la cuenta o si la IP acumula fallos (ver server/utils/limiteLogin.ts).
   turnstileToken: z.string().optional(),
})

export default defineEventHandler(async (event) => {
   const body = await readBody(event)
   const result = LoginSchema.safeParse(body)
   if (!result.success) throw createError({ statusCode: 401, message: 'Credenciales no válidas' })

   const { email, password, turnstileToken } = result.data

   // Anti fuerza bruta: bloqueo solo por cuenta; por IP, captcha en vez de bloqueo (varias
   // personas comparten IP en la misma wifi). Ver server/utils/limiteLogin.ts.
   const limite = crearLimiteLogin('login', ipDelCliente(event), email)
   limite.verificarCuentaNoBloqueada()
   await limite.exigirCaptchaSiCorresponde(event, turnstileToken)

   const persona = await prisma.persona.findUnique({
      where: { email },
      include: { rol: true },
      omit: { password: false },
   })
   // Sin contraseña asignada = sin cuenta de acceso (solo agenda/reservas): mismo error
   // genérico que credenciales inválidas, para no filtrar cuáles emails son personas.
   if (!persona || !persona.password) {
      limite.anotarFallo()
      throw createError({ statusCode: 401, message: 'Credenciales no válidas' })
   }

   const passwordValido = await bcrypt.compare(password, persona.password)
   if (!passwordValido) {
      limite.anotarFallo()
      throw createError({ statusCode: 401, message: 'Credenciales no válidas' })
   }

   if (!persona.activo) throw createError({ statusCode: 401, message: 'Acceso al sistema suspendido.' })

   limite.anotarExito()

   const rol = persona.rol.nombre

   // Administrador tiene bypass total: no necesita filas de permiso.
   let permisos: PermisoResumen[] = []
   let carrerasJefe: number[] | null = null
   let carrerasAsignadas: number[] | null = null

   if (rol !== 'Administrador') {
      const filas = await prisma.permiso.findMany({ where: { rol } })
      const agrupado = new Map<string, string[]>()
      for (const f of filas) agrupado.set(f.ruta, [...(agrupado.get(f.ruta) ?? []), f.accion])
      permisos = Array.from(agrupado, ([ruta, acciones]) => ({ ruta, acciones }))

      if (rol === 'Jefe de Carrera') {
         carrerasJefe = await resolverCarrerasJefe(rol, persona.email)
      }
      carrerasAsignadas = await resolverCarrerasAsignadas(rol, persona.email)
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
         puedeSuspenderCualquierReserva: persona.rol.suspenderCualquierReserva,
         puedeVerSemestreBorrador: persona.rol.verSemestreBorrador,
         personaId: persona.id,
         permisos: codificarPermisosSesion(permisos),
         carrerasJefe,
         carrerasAsignadas,
         temaPreferido: persona.temaPreferido,
         mostrarTopesEspejo: persona.mostrarTopesEspejo,
         colorTopesEspejo: persona.colorTopesEspejo,
         semestrePorDefecto: persona.semestrePorDefecto,
         registrosPorPagina: persona.registrosPorPagina,
         emoji: persona.emoji,
      },
   })
   return { ok: true }
})
