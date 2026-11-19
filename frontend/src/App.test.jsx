/**
 * Pruebas de `RutaProtegida` y del enrutamiento por rol (App.jsx).
 *
 * TARJETAS: [E-01/HU-01] FE - Pantalla para rol sin módulos habilitados
 * (gestor) y FE - Completar inicio de sesión.
 * DECISIONES: D37 (docs/DECISIONES.md) y las del PO del 2026-11-16 (CA01,
 * CA05, CA07).
 *
 * Se simula `useAutenticacion` con las mismas reglas de `auth/roles.js` que
 * usa el proveedor real, y se reemplaza el cliente HTTP por funciones
 * espía: así se comprueba que, para las cuentas sin acceso, ninguna pantalla
 * se monta ni dispara una petición, entre por donde entre.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";

const MENSAJE_SIN_MODULOS =
  "Su rol no tiene módulos habilitados en esta versión";
const MENSAJE_SIN_ROL = "Su cuenta no tiene un rol asignado";
let rolesActuales = [];
let loginRecienteActual = false;
let estaAutenticadoActual = true;
const finalizarLoginReciente = vi.fn();
const iniciarSesion = vi.fn();

vi.mock("./auth/ProveedorAutenticacion.jsx", async () => {
  const roles = await import("./auth/roles.js");
  return {
    useAutenticacion: () => ({
      cargando: false,
      estaAutenticado: estaAutenticadoActual,
      usuario: {
        nombre: "Ana Pérez",
        correo: null,
        roles: rolesActuales,
        rol: roles.etiquetaRol(rolesActuales),
      },
      puedeEscribir: roles.puedeEscribir(rolesActuales),
      puedeVerPlanAccion: roles.puedeVerPlanAccion(rolesActuales),
      motivoSinAcceso: roles.motivoSinAcceso(rolesActuales),
      vistaInicial: roles.vistaInicial(rolesActuales),
      loginReciente: loginRecienteActual,
      finalizarLoginReciente,
      iniciarSesion,
      cerrarSesion: vi.fn(),
    }),
  };
});

//: Cada método del cliente devuelve una promesa que nunca se resuelve: basta
//: para saber si alguna pantalla intentó pedir datos.
const llamadasApi = vi.fn();
vi.mock("./api/cliente.js", () => ({
  establecerProveedorToken: vi.fn(),
  ErrorApi: class ErrorApi extends Error {},
  api: new Proxy(
    {},
    {
      get: (_objetivo, metodo) => () => {
        llamadasApi(metodo);
        return new Promise(() => {});
      },
    },
  ),
}));

function Ubicacion() {
  const { pathname, search } = useLocation();
  return <output data-testid="ubicacion">{pathname + search}</output>;
}

function renderizarEn(ruta) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
      <Ubicacion />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  llamadasApi.mockClear();
  finalizarLoginReciente.mockClear();
  iniciarSesion.mockClear();
});

afterEach(() => {
  rolesActuales = [];
  loginRecienteActual = false;
  estaAutenticadoActual = true;
});

describe("RutaProtegida con rol sin módulos (gestor, D37)", () => {
  it.each([
    "/cortes",
    "/cortes/nuevo",
    "/plan-accion",
    "/plan-accion/comparar",
    "/matriz",
    "/ruta-que-no-existe",
  ])("en %s muestra la pantalla, sin menú ni peticiones", (ruta) => {
    rolesActuales = ["gestor", "default-roles-govsync", "offline_access"];

    renderizarEn(ruta);

    expect(screen.getByRole("alert")).toHaveTextContent(MENSAJE_SIN_MODULOS);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(llamadasApi).not.toHaveBeenCalled();
  });

  it("gestor + visitante entra con el layout del visitante", () => {
    rolesActuales = ["gestor", "visitante"];

    renderizarEn("/cortes");

    expect(screen.queryByText(MENSAJE_SIN_MODULOS)).not.toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("administrador no ve la pantalla", () => {
    rolesActuales = ["administrador"];

    renderizarEn("/cortes");

    expect(screen.queryByText(MENSAJE_SIN_MODULOS)).not.toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});

describe("RutaProtegida con cuenta sin rol (CA05)", () => {
  it.each(["/cortes", "/plan-accion", "/matriz", "/"])(
    "en %s muestra 'sin rol asignado', sin menú ni peticiones",
    (ruta) => {
      rolesActuales = ["default-roles-govsync", "offline_access"];

      renderizarEn(ruta);

      const alerta = screen.getByRole("alert");
      expect(alerta).toHaveTextContent(MENSAJE_SIN_ROL);
      expect(alerta).toHaveTextContent("Contacte a la administradora");
      expect(alerta).not.toHaveTextContent(MENSAJE_SIN_MODULOS);
      expect(
        screen.getByRole("button", { name: "Cerrar sesión" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
      expect(llamadasApi).not.toHaveBeenCalled();
    },
  );

  it("una cuenta sin ningún rol (lista vacía) también ve 'sin rol'", () => {
    rolesActuales = [];

    renderizarEn("/cortes");

    expect(screen.getByRole("alert")).toHaveTextContent(MENSAJE_SIN_ROL);
  });

  it("no confunde 'sin rol' con 'sin módulos'", () => {
    rolesActuales = ["gestor"];

    renderizarEn("/cortes");

    expect(screen.getByRole("alert")).toHaveTextContent(MENSAJE_SIN_MODULOS);
    expect(screen.getByRole("alert")).not.toHaveTextContent(MENSAJE_SIN_ROL);
  });
});

describe("Enlace a la consulta pública en las pantallas sin acceso", () => {
  it.each([
    ["cuenta sin rol", ["default-roles-govsync"]],
    ["gestor sin módulos", ["gestor"]],
  ])("%s ve 'Consultar el Plan de Acción como visitante'", (_caso, roles) => {
    rolesActuales = roles;

    renderizarEn("/cortes");

    expect(
      screen.getByRole("link", {
        name: "Consultar el Plan de Acción como visitante",
      }),
    ).toHaveAttribute("href", "/publico/plan-accion");
  });

  it("las cuentas con módulos no ven el enlace", () => {
    rolesActuales = ["administrador"];

    renderizarEn("/cortes");

    expect(
      screen.queryByRole("link", {
        name: "Consultar el Plan de Acción como visitante",
      }),
    ).not.toBeInTheDocument();
  });
});

describe("Ruta pública /publico/plan-accion (fuera de RutaProtegida)", () => {
  it.each([
    ["gestor", ["gestor"]],
    ["cuenta sin rol", []],
    ["visitante", ["visitante"]],
  ])(
    "con %s no muestra el aviso de sin acceso y pide solo el endpoint público",
    (_caso, roles) => {
      rolesActuales = roles;

      renderizarEn("/publico/plan-accion");

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
      expect(llamadasApi).toHaveBeenCalledTimes(1);
      expect(llamadasApi).toHaveBeenCalledWith("planAccionPublicoActual");
    },
  );

  it("sin sesión no redirige a /login", () => {
    estaAutenticadoActual = false;

    renderizarEn("/publico/plan-accion");

    expect(screen.getByTestId("ubicacion")).toHaveTextContent(
      "/publico/plan-accion",
    );
    expect(llamadasApi).toHaveBeenCalledWith("planAccionPublicoActual");
  });

  it("control: /plan-accion sin sesión SÍ redirige a /login", () => {
    estaAutenticadoActual = false;

    renderizarEn("/plan-accion");

    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/login");
  });
});

describe("Vista inicial por rol (CA01)", () => {
  it("administrador entra en /cortes", () => {
    rolesActuales = ["administrador"];

    renderizarEn("/");

    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/cortes");
  });

  it("visitante entra en /plan-accion", () => {
    rolesActuales = ["visitante", "default-roles-govsync"];

    renderizarEn("/");

    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/plan-accion");
  });

  it("administrador + visitante entra en /cortes (manda el de más permisos)", () => {
    rolesActuales = ["visitante", "administrador"];

    renderizarEn("/");

    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/cortes");
  });

  it("gestor en '/' ve la pantalla sin módulos, no una vista", () => {
    rolesActuales = ["gestor"];

    renderizarEn("/");

    expect(screen.getByRole("alert")).toHaveTextContent(MENSAJE_SIN_MODULOS);
    expect(screen.getByTestId("ubicacion")).toHaveTextContent(/^\/$/);
  });
});

describe("URL completa tras el login (CA07)", () => {
  const URL_PEDIDA = "/plan-accion/comparar?vigencia=2026";

  it("sin sesión, el login recibe la ruta CON sus parámetros y al volver se conservan", () => {
    // 1) Sin sesión, la persona escribe la URL con `?vigencia=2026`.
    estaAutenticadoActual = false;
    rolesActuales = [];
    const primera = renderizarEn(URL_PEDIDA);
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/login");

    // 2) En el login, "Ingresar" le pasa a Keycloak la ruta completa.
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(iniciarSesion).toHaveBeenCalledTimes(1);
    const destino = iniciarSesion.mock.calls[0][0];
    expect(destino).toBe(URL_PEDIDA);
    primera.unmount();

    // 3) Keycloak devuelve a esa URL; el rol visitante puede abrirla.
    estaAutenticadoActual = true;
    rolesActuales = ["visitante"];
    loginRecienteActual = true;
    renderizarEn(destino);

    expect(screen.getByTestId("ubicacion")).toHaveTextContent(
      "/plan-accion/comparar?vigencia=2026",
    );
  });

  it("si el rol no puede abrir la URL, va a la vista inicial sin los parámetros", () => {
    rolesActuales = ["visitante"];
    loginRecienteActual = true;

    renderizarEn("/cortes/nuevo?corte=9");

    expect(screen.getByTestId("ubicacion")).toHaveTextContent(
      /^\/plan-accion$/,
    );
  });
});

describe("Logo del menú (CA01)", () => {
  it.each([
    [["administrador"], "/cortes"],
    [["visitante"], "/plan-accion"],
  ])("con %j apunta a %s", (roles, destino) => {
    rolesActuales = roles;

    renderizarEn(destino);

    const logo = screen.getByText("SYNC").closest("a");
    expect(logo).toHaveAttribute("href", destino);
  });
});

describe("Encabezado con nombre y rol (CA01)", () => {
  it("administrador: nombre y 'Administradora', no el código del rol", () => {
    rolesActuales = ["administrador"];

    renderizarEn("/cortes");

    const encabezado = screen.getByText("Ana Pérez").closest("header");
    expect(encabezado).toHaveTextContent("Ana Pérez");
    expect(encabezado).toHaveTextContent("Administradora");
    expect(encabezado).not.toHaveTextContent("administrador");
  });

  it("visitante: nombre y 'Visitante'", () => {
    rolesActuales = ["visitante"];

    renderizarEn("/plan-accion");

    const encabezado = screen.getByText("Ana Pérez").closest("header");
    expect(encabezado).toHaveTextContent("Visitante");
  });
});

describe("Regreso a la URL original tras el login (CA07)", () => {
  it("con permiso: se queda en la URL que pidió", () => {
    rolesActuales = ["visitante"];
    loginRecienteActual = true;

    renderizarEn("/plan-accion/comparar");

    expect(screen.getByTestId("ubicacion")).toHaveTextContent(
      "/plan-accion/comparar",
    );
  });

  it("administrador: puede volver a una pantalla de escritura", () => {
    rolesActuales = ["administrador"];
    loginRecienteActual = true;

    renderizarEn("/cortes/nuevo");

    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/cortes/nuevo");
  });

  it.each(["/cortes/nuevo", "/cortes/7", "/cortes/7/editar"])(
    "sin permiso (visitante en %s): va a su vista inicial",
    (ruta) => {
      rolesActuales = ["visitante"];
      loginRecienteActual = true;

      renderizarEn(ruta);

      expect(screen.getByTestId("ubicacion")).toHaveTextContent("/plan-accion");
      expect(screen.getByTestId("ubicacion")).not.toHaveTextContent("/cortes");
    },
  );

  it("sin permiso con parámetros en la URL: también va a su vista inicial", () => {
    rolesActuales = ["visitante"];
    loginRecienteActual = true;

    renderizarEn("/cortes/nuevo?x=1");

    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/plan-accion");
  });

  it("sin permiso y sin login reciente: no redirige (el backend responde 403)", () => {
    rolesActuales = ["visitante"];
    loginRecienteActual = false;

    renderizarEn("/cortes/nuevo");

    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/cortes/nuevo");
  });

  it("consume la marca de login reciente una sola vez", () => {
    rolesActuales = ["visitante"];
    loginRecienteActual = true;

    renderizarEn("/plan-accion");

    expect(finalizarLoginReciente).toHaveBeenCalledTimes(1);
  });

  it("sin login reciente no toca la marca", () => {
    rolesActuales = ["visitante"];

    renderizarEn("/plan-accion");

    expect(finalizarLoginReciente).not.toHaveBeenCalled();
  });

  it("gestor con login reciente ve 'sin módulos', no se le redirige", () => {
    rolesActuales = ["gestor"];
    loginRecienteActual = true;

    renderizarEn("/plan-accion");

    expect(screen.getByRole("alert")).toHaveTextContent(MENSAJE_SIN_MODULOS);
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/plan-accion");
  });
});
