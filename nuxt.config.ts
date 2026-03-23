import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: {
    port: 20003,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  css: ["./app/tailwind.css"],
  nitro: {
    serverAssets: [
      {
        baseName: 'taiwan-data',
        dir: '../server/data',
      },
      {
        baseName: 'themes',
        dir: '../public/themes',
      },
    ],
  },
})
