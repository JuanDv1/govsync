import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Configuración de Vitest, SEPARADA de `vite.config.js` (en vez de agregar
 * un bloque `test: {...}` ahí) para no mezclar la config de build/dev con
 * la de pruebas -- Vitest lee este archivo automáticamente si existe, sin
 * tocar `vite.config.js`.
 *
 * `environment: "jsdom"` -- la mayoría de lo que hay en `src/lib/` es JS
 * puro (sin DOM), pero los componentes de `src/pages`/`src/components` sí
 * lo necesitan; un solo entorno para todo el proyecto es más simple que
 * decidirlo archivo por archivo.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/test/**"],
    },
  },
});
