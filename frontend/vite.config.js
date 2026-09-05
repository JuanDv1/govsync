import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // El frontend nunca conoce la URL del backend en tiempo de build:
    // se resuelve por proxy en desarrollo y por VITE_API_URL en despliegue.
    proxy: {
      "/api": {
        target: import.meta.env.VITE_API_URL || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
