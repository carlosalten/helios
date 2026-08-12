<template>
   <UApp>
      <!-- Barra de progreso en el borde superior mientras se navega de una página a otra. Las
           páginas resuelven sus `useFetch` en `<script setup>` (con `await`), así que Nuxt
           suspende la navegación y la página anterior queda en pantalla hasta que los datos
           lleguen: sin esta barra, ese lapso no se distingue de un click que no hizo nada.
           `throttle` evita que parpadee en navegaciones que resuelven al instante. -->
      <NuxtLoadingIndicator color="var(--color-usm-cyan)" :height="3" :throttle="200" />
      <NuxtRouteAnnouncer />
      <NuxtLayout>
         <NuxtPage />
      </NuxtLayout>
   </UApp>
</template>
