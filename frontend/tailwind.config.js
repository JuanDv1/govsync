/** GovSync — tokens de diseño Tailwind.
 * Ver docs/DECISIONES.md D17 (adopción de Tailwind) y estilos.css para el
 * porqué de este archivo: los mismos tokens que antes vivían como variables
 * CSS en :root ahora también se declaran aquí, para que las pantallas nuevas
 * (Login, Nuevo corte, y lo que siga) usen clases semánticas
 * (`bg-navy`, `text-azul`) en vez de valores arbitrarios repetidos.
 */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1A3A6B",
          hover: "#2C5282",
        },
        azul: {
          DEFAULT: "#2B6CB0",
          claro: "#5BA3E0",
          tenue: "#90B8DC",
          apagado: "#4A7FA5",
        },
        fondo: {
          pagina: "#EEF1F5",
          input: "#F7F9FC",
        },
        critico: "#C53030",
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ['"DM Mono"', "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
