// Nuxt/Nitro carga el .env automáticamente; no hace falta dotenv aquí.
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL!

const adapter = new PrismaPg({
   connectionString,
   // Opcional: ajustar pool
   // max: 10,
})

const prismaClientSingleton = () => {
   // Omit global: los hashes bcrypt (persona.password, ttEstudiante.password) nunca salen de
   // una query salvo que un endpoint lo pida explícitamente con `omit: { password: false }`
   // (solo login/verificación).
   return new PrismaClient({ adapter, omit: { persona: { password: true }, ttEstudiante: { password: true } } })
}

declare const globalThis: {
   prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma

export { prisma }
