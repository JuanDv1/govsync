/**
 * Guardas del despliegue de Keycloak en Render (docs/DESPLIEGUE.md, D39).
 *
 * Leen como texto el realm y el Dockerfile: ninguna otra prueba ni el CI los
 * ejercitan (el job `backend-keycloak` solo arranca la imagen oficial). Fallan si
 * alguien reabre las redirect URIs, quita el placeholder que permite usar el mismo
 * realm en local y en Render, o pierde una opción que mantiene Keycloak dentro de
 * los 512 MB del plan gratis.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = resolve(import.meta.dirname, "../../..");
const leer = (ruta) => readFileSync(resolve(RAIZ, ruta), "utf-8");

const URL_FRONTEND = "${GOVSYNC_FRONTEND_URL:http://localhost:5173}";

describe("Realm: redirecciones del cliente del frontend", () => {
  const realm = JSON.parse(leer("keycloak/import/govsync-realm.json"));
  const cliente = realm.clients.find((c) => c.clientId === "govsync-frontend");

  it("usa el placeholder con valor local por defecto, sin comodines abiertos", () => {
    expect(cliente.redirectUris).toEqual([`${URL_FRONTEND}/*`]);
    expect(cliente.webOrigins).toEqual([URL_FRONTEND]);
    expect(cliente.attributes["post.logout.redirect.uris"]).toBe(
      `${URL_FRONTEND}/*`,
    );
  });

  it("ninguna URI es '*' ni un patrón sin host", () => {
    const todas = [
      ...cliente.redirectUris,
      ...cliente.webOrigins,
      cliente.attributes["post.logout.redirect.uris"],
    ];
    for (const uri of todas) {
      expect(uri).not.toBe("*");
      expect(uri.startsWith("${GOVSYNC_FRONTEND_URL:http")).toBe(true);
    }
  });

  it("es un cliente público con PKCE S256 y sin password grant", () => {
    expect(cliente.publicClient).toBe(true);
    expect(cliente.attributes["pkce.code.challenge.method"]).toBe("S256");
    expect(cliente.directAccessGrantsEnabled).toBe(false);
  });

  it("el cliente del backend no admite redirecciones", () => {
    const backend = realm.clients.find((c) => c.clientId === "govsync-backend");
    expect(backend.redirectUris).toEqual([]);
    expect(backend.webOrigins).toEqual([]);
  });

  it("ningún cliente admite password grant (H2)", () => {
    for (const c of realm.clients.filter((c) =>
      ["govsync-frontend", "govsync-backend"].includes(c.clientId),
    )) {
      expect(c.directAccessGrantsEnabled).toBe(false);
    }
  });

  it("la contraseña de cada usuario sale de una variable (H1)", () => {
    const esperado = {
      "administrador.prueba": "ADMINISTRADOR",
      "gestor.prueba": "GESTOR",
      "visitante.prueba": "VISITANTE",
    };
    expect(realm.users.map((u) => u.username).sort()).toEqual(
      Object.keys(esperado).sort(),
    );
    for (const u of realm.users) {
      expect(u.credentials).toHaveLength(1);
      expect(u.credentials[0].value).toBe(
        `\${GOVSYNC_CLAVE_${esperado[u.username]}:GovSync2026!}`,
      );
    }
  });
});

describe("keycloak/Dockerfile", () => {
  const dockerfile = leer("keycloak/Dockerfile");
  // Los ENV de la etapa 1 NO se heredan a la 2: lo que importa es la etapa final.
  // Se ignoran los comentarios: mencionan las opciones y taparían una mutación.
  const etapaFinal = dockerfile
    .slice(dockerfile.lastIndexOf("\nFROM "))
    .split("\n")
    .filter((linea) => !linea.trimStart().startsWith("#"))
    .join("\n");

  it("arranca optimizado e importa el realm", () => {
    expect(etapaFinal).toContain(
      'CMD ["start", "--optimized", "--import-realm"]',
    );
  });

  it("repite en la etapa final las opciones de build (si no, vuelve la caché en clúster)", () => {
    expect(etapaFinal).toContain("KC_DB=postgres");
    expect(etapaFinal).toContain("KC_CACHE=local");
  });

  it("acota la memoria de la JVM para 512 MB", () => {
    expect(etapaFinal).toContain("-XX:MaxRAMPercentage=40");
    expect(etapaFinal).toContain("KC_DB_POOL_MAX_SIZE=10");
  });

  it("la etapa final declara un usuario no root (docker:S6471, OWASP A05)", () => {
    const usuarios = [...etapaFinal.matchAll(/^USER\s+(\S+)\s*$/gm)].map(
      (m) => m[1],
    );
    expect(usuarios.length).toBeGreaterThan(0);
    // El último USER es el que rige al ejecutar la imagen.
    const efectivo = usuarios.at(-1).split(":")[0];
    expect(efectivo).not.toBe("root");
    expect(efectivo).not.toBe("0");
    expect(efectivo).toMatch(/^[1-9]\d*$/);
  });

  it("lo copiado de la etapa de build es legible por ese usuario (--chown=1000:0)", () => {
    expect(etapaFinal).toMatch(/^COPY --from=builder --chown=1000:0 /m);
  });

  it("el ENTRYPOINT es el script de arranque, no kc.sh directo", () => {
    expect(etapaFinal).toContain(
      'ENTRYPOINT ["/opt/keycloak/govsync-entrypoint.sh"]',
    );
    expect(etapaFinal).toMatch(
      /^COPY --chown=1000:0 --chmod=0755 entrypoint\.sh \/opt\/keycloak\/govsync-entrypoint\.sh$/m,
    );
    expect(etapaFinal).toContain(
      'CMD ["start", "--optimized", "--import-realm"]',
    );
  });
});

describe("keycloak/entrypoint.sh (falla cerrada de las claves)", () => {
  const script = leer("keycloak/entrypoint.sh");
  // Sin comentarios: mencionan las variables y taparían una mutación.
  const codigo = script
    .split("\n")
    .filter((linea) => !linea.trimStart().startsWith("#"))
    .join("\n");

  it("solo comprueba en producción (KC_HOSTNAME definido)", () => {
    expect(codigo).toContain('if [[ -n "${KC_HOSTNAME:-}" ]]; then');
  });

  it("verifica las 3 claves de los usuarios y la del administrador", () => {
    for (const variable of [
      "GOVSYNC_CLAVE_ADMINISTRADOR",
      "GOVSYNC_CLAVE_GESTOR",
      "GOVSYNC_CLAVE_VISITANTE",
    ]) {
      expect(codigo).toContain(variable);
    }
    expect(codigo).toContain("KC_BOOTSTRAP_ADMIN_PASSWORD");
  });

  it("rechaza la clave pública, la de local y la vacía, y termina con error", () => {
    expect(codigo).toContain("CLAVE_PUBLICA='GovSync2026!'");
    expect(codigo).toContain('== "$CLAVE_PUBLICA"');
    expect(codigo).toContain('== "admin"');
    expect(codigo).toContain("esta_vacia");
    expect(codigo).toContain("exit 1");
  });

  it("nunca imprime el valor de una clave, solo su nombre", () => {
    const mensajes = codigo.split("\n").filter((l) => l.includes("echo"));
    expect(mensajes.length).toBeGreaterThan(0);
    for (const linea of mensajes) {
      expect(linea).not.toMatch(/\$\{?(valor|admin)\b/);
      expect(linea).not.toMatch(/\$\{?!/);
    }
  });

  it("termina haciendo exec de kc.sh con los mismos argumentos", () => {
    expect(codigo.trimEnd().endsWith('exec /opt/keycloak/bin/kc.sh "$@"')).toBe(
      true,
    );
  });

  it("se versiona con fin de línea LF (si no, falla el shebang en Linux)", () => {
    expect(script).not.toContain("\r");
    expect(script.startsWith("#!/bin/bash\n")).toBe(true);
    expect(leer(".gitattributes")).toContain(
      "keycloak/entrypoint.sh text eol=lf",
    );
  });
});

describe("keycloak/Dockerfile (seguridad de la imagen)", () => {
  const dockerfile = leer("keycloak/Dockerfile");

  it("no hornea secretos ni la confianza en proxies en la imagen", () => {
    for (const nombre of [
      "KC_DB_PASSWORD",
      "KC_DB_URL",
      "KC_BOOTSTRAP_ADMIN",
      "KC_PROXY_HEADERS",
      "KC_HTTP_ENABLED",
    ]) {
      expect(dockerfile).not.toMatch(
        new RegExp(`^\\s*(ENV\\s+)?${nombre}\\w*\\s*=`, "m"),
      );
    }
  });
});

describe("frontend/vercel.json", () => {
  it("reescribe toda ruta a index.html (SPA) y nada más", () => {
    expect(JSON.parse(leer("frontend/vercel.json")).rewrites).toEqual([
      { source: "/(.*)", destination: "/index.html" },
    ]);
  });
});
