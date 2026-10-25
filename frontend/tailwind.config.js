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
          //: `claro`, `tenue` y `apagado` son TEXTO sobre el navy del sidebar
          //: y del Login. Se aclararon para llegar a 4,5:1 (antes 4,17 / 5,41 /
          //: 2,62; `tenue` también fallaba sobre el hover del sidebar). Los
          //: nombres no cambian.
          claro: "#7DBBEE",
          tenue: "#A3C7E8",
          apagado: "#96BAD9",
          //: Azul de acción del refresh visual: blanco sobre él = 6,7:1. El
          //: `hover` llega a 8,7:1.
          accion: "#1D4ED8",
          "accion-hover": "#1E40AF",
        },
        //: Tintes suaves para agrupar (grupos de columnas, paneles). Texto
        //: `gray-600` o más oscuro sobre ellos supera 4,5:1.
        tinte: {
          azul: "#E6EEFD",
          verde: "#E2F4EE",
          violeta: "#EEE8FB",
        },
        //: Borde de campos y botones secundarios: 4,8:1 sobre blanco (el
        //: `gray-300` de antes daba 1,5:1 y no llegaba al 3:1 de WCAG 1.4.11).
        borde: {
          control: "#6B7280",
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
      //: Escala de texto con nombre (tamaños para la raíz al 100 %, 16 px).
      //: Se AÑADE a la de Tailwind, que no se reemplaza: `text-xs` (12 px),
      //: `text-sm` (14 px), `text-lg` (18 px) y `text-2xl` (24 px) ya
      //: coinciden con la escala objetivo. Nada funcional por debajo de 12 px.
      fontSize: {
        pantalla: ["1.5rem", { lineHeight: "2rem" }], // 24 px: título de pantalla
        tarjeta: ["1.125rem", { lineHeight: "1.75rem" }], // 18 px: título de tarjeta
        cuerpo: ["0.9375rem", { lineHeight: "1.375rem" }], // 15 px: párrafos
        campo: ["0.875rem", { lineHeight: "1.25rem" }], // 14 px: celdas, campos, botones, etiquetas
        ayuda: ["0.8125rem", { lineHeight: "1.125rem" }], // 13 px: ayudas y notas
        minimo: ["0.75rem", { lineHeight: "1rem" }], // 12 px: mínimo absoluto
      },
      //: Radios: 16 px tarjetas, paneles y tablas; 12 px botones, campos y
      //: listas. La píldora (`rounded-full`) es solo para estados. Se mantiene
      //: `rounded-sm` mientras las páginas se migran.
      borderRadius: {
        tarjeta: "1rem",
        control: "0.75rem",
      },
      //: Una sola sombra suave, para tarjetas y modales.
      boxShadow: {
        suave:
          "0 1px 2px rgb(22 32 44 / 0.06), 0 4px 12px rgb(22 32 44 / 0.06)",
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
