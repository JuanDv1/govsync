# GovSync — Especificación de estructura y estilo (para replicar el front-end)

> Documento de referencia para adaptar el diseño de **GovSync** (plataforma de seguimiento del Plan de Desarrollo Municipal) a otro proyecto en Claude Code. Cubre stack, tokens de diseño, layout general, secuencia de pantallas por rol, y patrones de componentes reutilizables.
>
> **Nota (docs/DECISIONES.md D18):** este documento describe un mockup de Figma Make más grande que el alcance del sprint actual — incluye RBAC por rol y seis pantallas (Tablero, Conciliación, Avance físico, Gestión de usuarios, entre otras) que no tienen tarjeta en `PLANDETRABAJO.md` y no existen en este repo. Se conserva aquí como referencia de diseño; D18 documenta exactamente qué parte se adaptó al código real y qué parte no.

---

## 1. Stack técnico

- **React + TypeScript**, bundler **Vite**.
- Estilos con **Tailwind CSS v4** (`@theme inline`, tokens CSS en `:root`), sin CSS-in-JS.
- Componentes base **shadcn/ui** en `src/app/components/ui/*` (accordion, dialog, table, tabs, select, sidebar, etc.) — se usan como librería de primitivos, aunque las pantallas principales están construidas mayormente con HTML + Tailwind directo en vez de los componentes shadcn (excepción: podrían adoptarse progresivamente).
- Gráficos con **Recharts** (`BarChart`, `PieChart`, `ResponsiveContainer`).
- Iconos con **lucide-react**.
- Tipografía: **Inter** (`fontFamily: "Inter, sans-serif"` aplicado a nivel de contenedor raíz).
- No hay router: la navegación es un **state machine simple** (`useState<Screen>`) dentro de un único `App.tsx` — sin carga de páginas por URL.

---

## 2. Tokens de diseño (design tokens)

Definidos en `src/styles/theme.css` como variables CSS y expuestos a Tailwind vía `@theme inline`.

| Token                  | Valor                                                 | Uso                                                                  |
| ---------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `--background`         | `#EEF1F5`                                             | Fondo general de la app (gris azulado muy claro)                     |
| `--foreground`         | `#1A202C`                                             | Texto principal                                                      |
| `--card`               | `#ffffff`                                             | Fondo de tarjetas/paneles                                            |
| `--primary`            | `#1A3A6B`                                             | Azul marino institucional — sidebar, headers, botones primarios      |
| `--primary-foreground` | `#ffffff`                                             | Texto sobre primary                                                  |
| `--secondary`          | `#E8EDF5`                                             | Fondos secundarios sutiles                                           |
| `--muted`              | `#E2E8F0`                                             | Bordes/fondos neutros                                                |
| `--muted-foreground`   | `#718096`                                             | Texto secundario/gris                                                |
| `--accent`             | `#2B6CB0`                                             | Azul de acción — links, focus ring, hover de sidebar activo          |
| `--destructive`        | `#C53030`                                             | Rojo de error/alerta crítica                                         |
| `--input-background`   | `#F7F9FC`                                             | Fondo de inputs (gris casi blanco)                                   |
| `--radius`             | `0.125rem` (2px)                                      | Radio de borde — **muy poco redondeado**, look "gubernamental/serio" |
| `--chart-1..5`         | `#2B6CB0`, `#90CDF4`, `#276749`, `#D97706`, `#C53030` | Paleta de series en gráficos                                         |
| `--font-size` base     | `14px`                                                | Tamaño base html (compacto, denso en información)                    |

### Colores semánticos adicionales (hardcoded en componentes, no tokens)

- **Semáforo de estado** (`SEMAFORO_HEX`): verde `#276749`, amarillo `#D97706`, rojo `#C53030`, sin info `#A0AEC0`.
- Azul de marca extendido: `#5BA3E0` (acento claro en login), `#90B8DC` / `#4A7FA5` (textos sobre sidebar oscuro), `#1E4785` (hover sidebar), `#2C5282` (hover botón primario).

### Principios de color

- Paleta **fría, corporativa, de bajo contraste saturado**: azules marino/acero + grises. Sin colores "alegres"; los únicos acentos de color vivo son los semáforos de estado (verde/ámbar/rojo) y algunos badges.
- Fondos en capas: `#EEF1F5` (app) → `#ffffff` (tarjetas) → `#F7F9FC` (inputs) → `#EEF1F5`/gris-50 (celdas de detalle expandido).

---

## 3. Tipografía y densidad

- Familia: **Inter**.
- Escala tipográfica deliberadamente **pequeña y compacta** (características de dashboards de datos gubernamentales):
  - Títulos de pantalla (`h1`): `text-base font-semibold` (~16px).
  - Subtítulos/descripciones: `text-[11px] text-gray-500`.
  - Labels de formulario: `text-[10px] font-semibold uppercase tracking-widest text-gray-500`.
  - Encabezados de sección (`SectionHeader`): `text-[10px] font-semibold text-gray-400 uppercase tracking-widest`.
  - Encabezados de tabla (`th`): `text-[10px] font-semibold text-gray-400 uppercase tracking-wider`.
  - Texto de celda: `text-xs` (12px).
  - Cifras monetarias/numéricas: siempre `font-mono` para alineación visual.
- **Mayúsculas + tracking ancho** para: botones de acción primaria (`INGRESAR AL SISTEMA`, `NUEVO CORTE`, `GUARDAR AVANCE`), labels de campo, encabezados de sección/tabla.
- Jerarquía por _peso y tamaño_, no por color: casi todo el texto secundario es gris (`text-gray-400/500`).

---

## 4. Layout general de la aplicación

### 4.1 Estructura de "app shell" (post-login)

```
┌─────────────┬──────────────────────────────────────────┐
│             │  header (barra vacía, blanca, border-b)   │
│  Sidebar    ├──────────────────────────────────────────┤
│  (w-52,     │                                            │
│  azul       │  <main> contenido de la pantalla activa   │
│  marino)    │  (padding p-5, overflow-auto, fondo        │
│             │   --background)                            │
│             │                                            │
└─────────────┴──────────────────────────────────────────┘
```

- **Sidebar fijo** (`w-52`, `bg-[#1A3A6B]`), no colapsable, tres bloques verticales:
  1. **Header de marca**: logo "GOVSYNC" (texto, dos tonos: blanco + azul claro) + subtítulo institucional.
  2. **Navegación** (`<nav>` flex-1): lista de botones full-width, ítem activo con fondo `accent` (#2B6CB0), inactivo con texto `#90B8DC` y hover `#1E4785`. Incluye badge numérico rojo para notificaciones (ej. alertas de conciliación).
  3. **Footer de usuario**: nombre + rol/chip + botón "Cerrar sesión".
- **Header superior**: barra blanca vacía/delgada (`border-b`, `py-2.5`) — reservada para breadcrumbs o acciones globales futuras.
- **Main**: fondo gris azulado, `padding: 1.25rem` (`p-5`), scroll propio.
- El menú de navegación **cambia según el rol** (ver sección 6) — no hay un menú único; se filtra un arreglo `NAV_BY_ROLE`.

### 4.2 Patrón de encabezado de pantalla (repetido en casi todas las vistas)

```
┌───────────────────────────────────────────────────┐
│ Título (h1, text-base font-semibold)   [Acción CTA]│
│ Subtítulo contextual (text-[11px] gray-500)        │
└───────────────────────────────────────────────────┘
```

- Título a la izquierda + descripción de contexto (corte activo, filtros aplicados, alcance de datos) debajo.
- Botón(es) de acción principal alineados a la derecha del título (mismo nivel), estilo primario azul marino, texto en mayúsculas.
- Debajo del header puede aparecer un **banner contextual** (azul claro `bg-blue-50` para "vista de solo lectura", ámbar `bg-amber-50` para alertas/advertencias, verde `bg-green-50` para confirmaciones).

### 4.3 Patrón de "tarjeta" (card) universal

Todas las secciones de contenido usan la misma envoltura:

```css
bg-white border border-gray-200 rounded-sm p-4 (o p-5)
```

- `rounded-sm` (2px) en **todo** — nunca esquinas muy redondeadas.
- Bordes sutiles `border-gray-200`, sin sombras salvo en modales (`shadow-xl`).
- `SectionHeader` (label uppercase gris) como título interno de cada tarjeta/tabla.

### 4.4 Patrón de tabla universal

- Contenedor: tarjeta blanca con `overflow-x-auto` si hay muchas columnas.
- `<thead>` con fondo `bg-gray-50`, texto `text-[10px] uppercase tracking-wider text-gray-400`.
- Filas con `border-b border-gray-100`, hover `hover:bg-gray-50/60`.
- Primera columna a veces `sticky left-0` para tablas anchas (ej. Plan de Acción).
- Filas expandibles (accordion inline) para mostrar detalle anidado (ej. contratos por meta) — fila hija con fondo `bg-[#EEF1F5]/50`, `colSpan` completo, tabla interna más pequeña.
- Celdas numéricas: alineadas a la derecha, `font-mono`.
- Footer de tabla: línea de resumen fuera de la tarjeta (`text-[11px] text-gray-400`, ej. "144 metas · Cifras en pesos colombianos").

### 4.5 Patrón de filtros

- Barra horizontal en tarjeta blanca, `flex items-center gap-4`, con `<select>` nativos estilizados (no combobox custom) + leyenda de conteos a la derecha (`ml-auto`) + botón de exportar al final.

### 4.6 Patrón KPI (tarjetas de métricas)

Grid de 3-4 columnas, cada tarjeta:

```
LABEL (uppercase, gris, 10px)
VALOR (font-mono, bold, xl, color primary o semántico)
sub-texto (gris, 11px)
delta opcional (verde, ▲ + texto, 10px)
```

### 4.7 Patrones de estado/feedback

- **Badge de estado** (`StateBadge`): pill pequeña con borde, colores por estado (Borrador=gris, Registrado=verde).
- **Semáforo** (`SemaforoDot`): círculo de color sólido (verde/ámbar/rojo/gris).
- **Celda de porcentaje** (`PctCell`): color condicional por umbral (≥60% verde, ≥30% ámbar, <30% rojo), siempre `font-mono`.
- **Banners de alerta**: `bg-amber-50 border-amber-200` + icono `AlertTriangle` + texto `text-amber-800`, usado de forma consistente para advertencias en todo el sistema (carga de archivos, conciliación, avance físico).
- **Banners de éxito**: `bg-green-50 border-green-300` + icono `Check`.
- **Modal**: overlay `bg-black/40`, tarjeta blanca centrada `rounded-sm shadow-xl`, header con título+subtítulo+botón X, body con form fields, footer con acciones alineadas a la derecha (Cancelar secundario + acción primaria).

---

## 5. Secuencia de pantallas (flujo de navegación)

### 5.1 Login (pre-autenticación)

Pantalla completa dividida en dos:

- **Panel izquierdo (42%)**: fondo azul marino sólido, branding + descripción institucional + versión/vigencia (footer).
- **Panel derecho (flex-1)**: fondo blanco, formulario centrado (correo + contraseña + botón primario "INGRESAR AL SISTEMA") + sección de "accesos de demostración" (3 botones de rol) + nota de contacto para soporte.

### 5.2 Post-login → AppShell + pantallas internas

El flujo real (no rutas URL, sino estados):

```
Login
  └─(selecciona rol)→ Tablero (tab: Resumen) [pantalla por defecto]
        ├─ Tablero
        │    ├─ Tab Resumen   → KPIs + gráfico de barras + donut de semáforo
        │    ├─ Tab Plan de Acción → tabla expandible de metas + filtros + export
        │    └─ Tab Análisis  → barras de progreso por sector + tabla + alerta banner
        ├─ Cortes → tabla de cortes históricos
        │    └─ "Ver matriz" → Matriz de relación (trazabilidad BPIN↔contrato)
        │         └─ "Volver a Cortes" ← regresa
        ├─ Nuevo corte (Carga) [solo Asesora]
        │    1. Formulario "Datos del corte" (vigencia + fecha) → Confirmar
        │    2. Wizard de 3 pasos (upload secuencial de 3 archivos con validación)
        │    3. Pantalla de resultado de procesamiento (KPIs + CTA a Matriz o Tablero)
        ├─ Conciliación [solo Asesora] → 3 secciones acordeón de alertas (sin cruce / calidad / gestión)
        ├─ Avance físico → formulario editable (Supervisor) o vista de solo lectura (otros roles)
        └─ Gestión de usuarios [solo Asesora] → tabla de usuarios + modal "Crear usuario"
```

- La navegación es **lateral persistente**: al cambiar de pantalla el sidebar y su ítem activo se actualizan; "Matriz" no tiene entrada propia en el menú (se resalta "Cortes" como padre lógico).
- Las acciones de "avanzar" (ej. procesar carga) llevan a un **estado de resultado** con CTAs explícitos hacia la siguiente pantalla lógica (Matriz o Tablero), reforzando un flujo guiado en vez de navegación libre.

---

## 6. Control de acceso por rol (RBAC visual)

Tres roles con visibilidad de menú y de acciones distinta — **no se ocultan datos con lógica de servidor en este mockup, se filtra en el cliente**, pero el patrón a replicar es:

| Pantalla            | Asesora (admin)                  | Supervisor sectorial             | Alcalde                    |
| ------------------- | -------------------------------- | -------------------------------- | -------------------------- |
| Tablero             | ✅ (export Excel visible)        | ✅ (sin export)                  | ✅ (export Excel visible)  |
| Cortes              | ✅ (crear/editar)                | ✅ solo lectura                  | ✅ solo lectura + exportar |
| Nuevo corte         | ✅                               | ❌                               | ❌                         |
| Conciliación        | ✅                               | ❌                               | ❌                         |
| Avance físico       | ✅ solo lectura (todos sectores) | ✅ editable (**solo su sector**) | ❌ (no aparece en menú)    |
| Gestión de usuarios | ✅                               | ❌                               | ❌                         |

Patrones visuales para diferenciar el modo:

- Banner azul claro "Vista de consulta" / "Vista ejecutiva de consulta" cuando el rol no puede editar.
- Campos deshabilitados: `bg-gray-50 text-gray-400 cursor-not-allowed`.
- Botones de acción (crear/editar/export) simplemente no se renderizan condicionalmente (`role === "asesora" && (...)`), no se muestran deshabilitados.

---

## 7. Componentes atómicos reutilizables (a portar primero)

Estos son pequeños, sin estado o con estado mínimo, y deben implementarse primero porque se reutilizan en casi toda la app:

1. `SectionHeader` — label uppercase gris para encabezar bloques dentro de una tarjeta.
2. `StateBadge` — pill de estado con mapa de colores por texto de estado.
3. `SemaforoDot` — punto de color para semáforo verde/ámbar/rojo.
4. `PctCell` — texto monoespaciado con color condicional por umbral numérico.
5. Helper `cop(n)` — formateador de moneda COP con separador de miles por puntos, sin decimales, prefijo `$ `.
6. Card wrapper (`bg-white border border-gray-200 rounded-sm`) — no está extraído como componente en el original pero **debería extraerse** al portar.

---

## 8. Recomendaciones al adaptar esto a otro proyecto

1. **Extraer las pantallas de `App.tsx` a archivos separados** (el mockup actual tiene ~1800 líneas en un solo archivo) — uno por pantalla (`LoginScreen.tsx`, `TableroScreen.tsx`, etc.) y los átomos en `components/shared/`.
2. **Introducir un router real** (React Router / TanStack Router) si el otro proyecto necesita URLs navegables o recarga profunda; aquí la navegación es 100% en memoria.
3. **Reutilizar el archivo `theme.css` tal cual** como punto de partida de tokens, solo reemplazando `--primary`/`--accent` por los colores de marca del nuevo proyecto — la estructura de capas (background/card/input-background) y el `--radius: 0.125rem` son el sello visual "gob/dashboard serio" a conservar si se quiere el mismo look.
4. **Mantener la convención de tamaños de fuente ultra-compactos** (`text-[10px]`/`text-[11px]` para metadatos, `text-xs` para tablas) si el nuevo proyecto también es un dashboard denso en datos; si es una app más consumer-facing, esta densidad probablemente debe aumentarse.
5. **Los componentes shadcn ya instalados** (`src/app/components/ui/*`) cubren prácticamente todo lo necesario (dialog, table, tabs, select, sidebar, chart) — conviene migrar los HTML/Tailwind ad-hoc actuales hacia esos componentes shadcn para consistencia y accesibilidad, en vez de reconstruir todo desde cero.
6. **RBAC**: portar el patrón `NAV_BY_ROLE` + guards condicionales (`role === "x" && (...)`) tal cual, ya que es simple y explícito; si el nuevo proyecto tiene más de 3 roles o permisos granulares, considerar una tabla de permisos en vez de condicionales inline.
