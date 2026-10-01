import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // O worker do pdf.js vem como .mjs; muitos Nginx (ex.: 1.24 do Ubuntu) não conhecem a extensão
        // e servem-no como binário, o que o navegador recusa. Gerado como .js funciona em qualquer servidor.
        assetFileNames: (asset) =>
          asset.names?.some((n) => n.endsWith(".mjs")) ? "assets/[name]-[hash].js" : "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3000" },
  },
});
