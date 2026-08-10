// Días de la semana en numeración ISO (1 = Lunes … 7 = Domingo), consistente con
// `diaSemana` en el backend (horario-service).
export interface DiaSemana {
    valor: number
    nombre: string
    corto: string
}

export const DIAS_SEMANA: DiaSemana[] = [
    { valor: 1, nombre: 'Lunes', corto: 'Lun' },
    { valor: 2, nombre: 'Martes', corto: 'Mar' },
    { valor: 3, nombre: 'Miércoles', corto: 'Mié' },
    { valor: 4, nombre: 'Jueves', corto: 'Jue' },
    { valor: 5, nombre: 'Viernes', corto: 'Vie' },
    { valor: 6, nombre: 'Sábado', corto: 'Sáb' },
    { valor: 7, nombre: 'Domingo', corto: 'Dom' },
]

// Sábado y domingo, para estilizar el fin de semana.
export const DIAS_FIN_SEMANA = [6, 7]

export function nombreCortoDia(valor: number): string {
    return DIAS_SEMANA.find((d) => d.valor === valor)?.corto ?? String(valor)
}
