import type { SesionUsuario } from './sesionUsuario';

declare module '#auth-utils' {
    interface User extends SesionUsuario {}
}
