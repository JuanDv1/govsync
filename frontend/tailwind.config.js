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
          // Hover de ítem de sidebar — distinto del hover de botón
          // (`navy.hover`): mismo origen que ese, pero un poco más claro
          // porque va sobre el fondo navy del propio sidebar, no sobre blanco.
          sidebar: "#1E4785",
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
        secundario: "#E8EDF5",
        critico: "#C53030",
        // Paleta de semáforo (SemaforoDot) — deliberadamente distinta de los
        // green-50/amber-50/etc. de Tailwind que ya usan los banners y
        // StateBadge: acá se necesitan tonos sólidos y saturados para un
        // punto de color pequeño, no fondos suaves para una caja de texto.
        semaforo: {
          verde: "#276749",
          amarillo: "#D97706",
          rojo: "#C53030",
          "sin-info": "#A0AEC0",
        },
        chart: {
          1: "#2B6CB0",
          2: "#90CDF4",
          3: "#276749",
          4: "#D97706",
          5: "#C53030",
        },
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
