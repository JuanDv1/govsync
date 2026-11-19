/**
 * Coherencia del tema de login de Keycloak con la aplicación
 * ([E-01/HU-01], decisión del PO del 2026-11-16).
 *
 * Los componentes de React no corren en FreeMarker: el tema comparte con
 * `Login.jsx`, `Boton.jsx` y `Campo.jsx` los TOKENS (mismo tailwind.config.js)
 * y las CLASES. Estas pruebas leen los archivos como texto y fallan si:
 *  - una clase de las plantillas no está en el CSS versionado (se cambió una
 *    `.ftl` y no se corrió `npm run build:tema-keycloak`);
 *  - el botón o los campos del tema dejaron de usar las clases de `Boton` /
 *    `Campo`, o el panel azul dejó de coincidir con `Login.jsx`;
 *  - el realm o los mensajes se apartan de lo decidido (CA02, CA03).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLOQUEO_MS,
  MAX_INTENTOS,
} from "../../../keycloak/themes/govsync/login/resources/js/limite-intentos.js";

//: Raíz del repositorio (este archivo está en frontend/src/tema-keycloak/).
const RAIZ = resolve(import.meta.dirname, "../../..");
const leer = (ruta) => readFileSync(resolve(RAIZ, ruta), "utf-8");

const TEMA = "keycloak/themes/govsync/login";
const templateFtl = leer(`${TEMA}/template.ftl`);
const loginFtl = leer(`${TEMA}/login.ftl`);
const css = leer(`${TEMA}/resources/css/govsync.css`);
const loginJsx = leer("frontend/src/pages/Login.jsx");
const botonJsx = leer("frontend/src/components/shared/Boton.jsx");
const campoJsx = leer("frontend/src/components/shared/Campo.jsx");

/** Quita las directivas de FreeMarker (`<#if …>`, `</#if>`) de un atributo. */
const sinDirectivas = (texto) => texto.replace(/<\/?#[^>]*>/g, " ");

const clasesDe = (texto) =>
  sinDirectivas(texto)
    .split(/\s+/)
    .filter((c) => c && !c.includes("${"));

/** Todos los valores de `class="…"` de una plantilla, sin directivas. */
function clasesDePlantilla(ftl) {
  const clases = new Set();
  for (const [, valor] of ftl.matchAll(/class="([^"]*)"/g)) {
    clasesDe(valor).forEach((c) => clases.add(c));
  }
  return clases;
}

const escaparSelector = (clase) => clase.replace(/[^A-Za-z0-9_-]/g, "\\$&");

/** El valor de `const NOMBRE = "…"` (puede ocupar la línea siguiente). */
function constanteJsx(fuente, nombre) {
  const m = fuente.match(new RegExp(`const ${nombre} =\\s*"([^"]+)"`));
  if (!m) throw new Error(`No se encontró ${nombre}`);
  return m[1];
}

describe("CSS generado vs. plantillas", () => {
  const clases = [
    ...clasesDePlantilla(templateFtl),
    ...clasesDePlantilla(loginFtl),
  ];

  it("las plantillas usan clases de Tailwind (no quedaron las govsync-*)", () => {
    expect(clases.length).toBeGreaterThan(40);
    expect(clases.filter((c) => c.startsWith("govsync-"))).toEqual([]);
  });

  it.each([...new Set(clases)])(
    "el CSS versionado tiene la clase %s",
    (clase) => {
      // Con borde: ".px-3" no puede darse por bueno con ".px-3\.5".
      const selector = `.${escaparSelector(clase)}`;
      const literal = selector.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
      // Y con declaraciones: una regla vacía no sirve.
      expect(css).toMatch(new RegExp(`${literal}(?![\\w-])[^{}]*\\{[^}]*:`));
    },
  );
});

describe("Mismas clases que Login.jsx (panel azul y formulario)", () => {
  const panel = loginJsx.slice(
    loginJsx.indexOf("<aside"),
    loginJsx.indexOf("</aside>"),
  );
  const clasesPanel = [...panel.matchAll(/className="([^"]+)"/g)].map(
    (m) => m[1],
  );

  it("Login.jsx tiene panel con clases que comparar", () => {
    expect(clasesPanel.length).toBeGreaterThan(8);
  });

  it.each(clasesPanel)("template.ftl tiene el mismo class=%j", (valor) => {
    expect(templateFtl).toContain(`class="${valor}"`);
  });

  it("el contenedor del formulario es el de Login.jsx", () => {
    expect(loginJsx).toContain(
      'className="flex min-w-0 flex-1 items-center justify-center bg-white px-6"',
    );
    expect(templateFtl).toContain(
      'class="flex min-w-0 flex-1 items-center justify-center bg-white px-6"',
    );
    expect(templateFtl).toContain('class="w-full max-w-sm"');
  });

  it("título y descripción usan las clases de EncabezadoPantalla", () => {
    expect(templateFtl).toContain(
      'class="text-pantalla font-semibold text-gray-800"',
    );
    expect(templateFtl).toContain('class="mt-1 text-cuerpo text-gray-600"');
  });

  it("tienen los mismos textos de la pantalla", () => {
    for (const texto of [
      "Acceso restringido a funcionarios autorizados de la Alcaldía.",
      "Vigencia 2026",
      "v2.0.0",
      "Alcaldía Municipal de Santa Rosa, Cauca",
    ]) {
      expect(loginJsx).toContain(texto);
      expect(templateFtl).toContain(texto);
    }
  });
});

describe("Botón y campos iguales a Boton.jsx y Campo.jsx", () => {
  const botonLogin = loginFtl.match(
    /<button[^>]*id="kc-login"[\s\S]*?<\/button>/,
  )[0];
  const clasesBoton = clasesDe(botonLogin.match(/class="([^"]*)"/)[1]);

  it("el botón tiene todas las clases del primario de Boton.jsx", () => {
    const base = clasesDe(constanteJsx(botonJsx, "BASE"));
    const primario = clasesDe(botonJsx.match(/primario:\s*"([^"]+)"/)[1]);
    for (const clase of [...base, ...primario]) {
      expect(clasesBoton).toContain(clase);
    }
    expect(clasesBoton).toContain("w-full");
  });

  it("el botón dice 'Ingresar' (CA01)", () => {
    expect(botonLogin).toMatch(/>Ingresar<\/button>/);
  });

  it("los campos tienen todas las clases de Campo.jsx", () => {
    const control = clasesDe(constanteJsx(campoJsx, "CONTROL"));
    const entradas = [
      ...loginFtl.matchAll(
        /<input[^>]*\bid="(?:username|password)"[\s\S]*?\/>/g,
      ),
    ].map((m) => clasesDe(m[0].match(/class="([^"]*)"/)[1]));

    expect(entradas).toHaveLength(2);
    for (const clasesEntrada of entradas) {
      for (const clase of control) expect(clasesEntrada).toContain(clase);
    }
  });

  it("las etiquetas y el error usan las clases de Campo.jsx", () => {
    expect(campoJsx).toContain(
      'className="mb-1.5 block text-campo font-medium text-gray-700"',
    );
    expect(loginFtl).toContain(
      'class="mb-1.5 block text-campo font-medium text-gray-700"',
    );
    expect(campoJsx).toContain(
      'className="mt-1.5 flex items-start gap-1.5 text-ayuda font-medium text-red-700"',
    );
    expect(loginFtl).toContain(
      'class="mt-1.5 flex items-start gap-1.5 text-ayuda font-medium text-red-700"',
    );
  });
});

describe("Accesibilidad del formulario", () => {
  it("cada campo tiene su <label for>, y el error se anuncia", () => {
    expect(loginFtl).toContain('<label for="username"');
    expect(loginFtl).toContain('<label for="password"');
    expect(loginFtl).toMatch(/id="username-error" role="alert"/);
    expect(loginFtl).toContain(
      'aria-invalid="true" aria-describedby="username-error"',
    );
  });

  it("el foco visible no se quita sin reemplazo", () => {
    expect(loginFtl).toContain("focus-visible:ring-2");
    expect(loginFtl).toContain("focus-visible:ring-azul-accion");
  });

  it("el aviso de límite se anuncia y la cuenta regresiva es un timer", () => {
    expect(loginFtl).toMatch(
      /<div id="limite-intentos" role="alert">[\s\S]*Límite de intentos alcanzado\. Espere 5 minutos para volver a intentarlo\./,
    );
    expect(loginFtl).toContain('role="timer" id="limite-intentos-restante"');
  });

  it("se mantienen los campos que Keycloak exige", () => {
    for (const nombre of [
      'name="username"',
      'name="password"',
      'name="credentialId"',
    ]) {
      expect(loginFtl).toContain(nombre);
    }
    expect(loginFtl).toContain(
      "required oninvalid=\"this.setCustomValidity('Campo obligatorio')\"",
    );
  });

  it("conserva los atributos de accesibilidad y de gestores de contraseñas", () => {
    for (const atributo of [
      "autofocus",
      'autocomplete="username"',
      'autocomplete="current-password"',
      'type="password"',
      'aria-invalid="true" aria-describedby="username-error"',
      "required oninvalid=",
      'data-error-credenciales="true"',
      'id="limite-intentos-contenido" hidden',
      "disabled:bg-gray-100 disabled:text-gray-600",
    ]) {
      expect(loginFtl).toContain(atributo);
    }
    expect(templateFtl).toContain('<html lang="es"');
    expect(leer(`${TEMA}/theme.properties`)).toMatch(
      /^styles=css\/govsync\.css$/m,
    );
  });

  it("carga el script del límite de intentos como módulo", () => {
    expect(templateFtl).toContain(
      '<script type="module" src="${url.resourcesPath}/js/limite-intentos.js"></script>',
    );
  });
});

describe("Realm y mensajes (CA02, CA03)", () => {
  const realm = JSON.parse(leer("keycloak/import/govsync-realm.json"));
  const mensajes = leer(`${TEMA}/messages/messages_es.properties`);

  it("CA03: 3 intentos, 5 minutos, bloqueo temporal", () => {
    expect(realm.bruteForceProtected).toBe(true);
    expect(realm.permanentLockout).toBe(false);
    expect(realm.failureFactor).toBe(3);
    expect(realm.waitIncrementSeconds).toBe(300);
    expect(realm.maxFailureWaitSeconds).toBe(300);
  });

  it("el script del navegador y el realm usan la misma ventana de 5 min", () => {
    expect(BLOQUEO_MS / 1000).toBe(realm.waitIncrementSeconds);
    expect(BLOQUEO_MS / 1000).toBe(realm.maxFailureWaitSeconds);
    expect(MAX_INTENTOS).toBe(realm.failureFactor);
  });

  it("CA02: el mismo texto para usuario inexistente y contraseña incorrecta", () => {
    const claves = [
      "invalidUserMessage",
      "invalidUsernameMessage",
      "invalidPasswordMessage",
      "invalidUsernameOrEmailMessage",
      "invalidEmailMessage",
    ];
    for (const clave of claves) {
      expect(mensajes).toMatch(
        new RegExp(`^${clave}=Usuario o contraseña incorrectos$`, "m"),
      );
    }
  });

  it("no se usa el mensaje de bloqueo de Keycloak (revelaría cuentas)", () => {
    expect(mensajes).not.toMatch(/accountTemporarilyDisabled/);
    expect(mensajes).not.toMatch(/Cuenta bloqueada/i);
  });

  it("el idioma por defecto del realm es español", () => {
    expect(realm.internationalizationEnabled).toBe(true);
    expect(realm.defaultLocale).toBe("es");
    expect(realm.supportedLocales).toEqual(["es"]);
  });
});
