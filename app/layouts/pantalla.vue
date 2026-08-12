<!-- Layout de la pantalla física en un lugar público: pantalla completa, sin sidebar ni topbar,
     siempre en oscuro (no depende de la preferencia de nadie — no hay nadie ahí para tocarla)
     y sin nada clickeable, porque normalmente corre sola en un navegador en modo kiosco. -->
<template>
   <div class="h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <slot />
   </div>
</template>
