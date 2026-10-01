import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Brancode",
        short_name: "Brancode",
        description: "Skeniranje artikala i štampa cenovnika",
        lang: "sr",
        start_url: "/",
        display: "standalone",
        background_color: "#FAF7F0",
        theme_color: "#1F1B16",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // the serverless email endpoint must always hit the network
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    https: true,
  },
});
