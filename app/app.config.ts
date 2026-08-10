export default defineAppConfig({
    ui: {
        colors: {
            primary: 'usm-blue',
            secondary: 'usm-purple',
            success: 'usm-green',
            info: 'usm-cyan',
            warning: 'usm-yellow',
            error: 'usm-red',
        },
        table: {
            slots: {
                // Resalta la fila bajo el mouse en todas las UTable, sin depender de la prop
                // onSelect/onHover (que activa el hover nativo del componente).
                tbody: '[&>tr]:transition-colors [&>tr]:duration-150 [&>tr]:hover:bg-elevated/50',
            },
        },
    },
});
