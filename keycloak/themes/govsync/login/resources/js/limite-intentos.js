/**
 * Límite de intentos fallidos POR NAVEGADOR ([E-01/HU-01] CA03, decisión del
 * PO del 2026-11-16, Opción A).
 *
 * ES SOLO EXPERIENCIA DE USO, NO UN CONTROL DE SEGURIDAD. El bloqueo real lo
 * impone Keycloak, por usuario (3 intentos, 5 min: `govsync-realm.json`). Este
 * contador no mira qué usuario se escribió y no usa el mensaje de bloqueo de
 * Keycloak: así la pantalla nunca revela si una cuenta existe. Quien borre el
 * almacenamiento del navegador lo salta, y no importa: el servidor sigue
 * contando.
 *
 * Cómo cuenta: el tema es de otro origen que la aplicación, así que no puede
 * ver si un ingreso salió bien. Lo infiere así:
 *  - al ENVIAR el formulario deja una marca "pendiente" en `sessionStorage`
 *    (propia de ESTA pestaña: abrir el login en otra no la consume);
 *  - al CARGAR la página, si había marca y llegó con error de credenciales,
 *    suma un fallo; si había marca y NO hay error, el intento anterior salió
 *    bien (o se abandonó): reinicia el contador;
 *  - los fallos vencen 5 min después del último; con 3, el formulario queda
 *    bloqueado hasta ese momento y se habilita solo.
 *
 * Sin dependencias ni React: lo carga el navegador como módulo
 * (`<script type="module">`) y lo prueba Vitest
 * (`frontend/src/tema-keycloak/limiteIntentos.test.js`).
 */
export const MAX_INTENTOS = 3;
export const BLOQUEO_MS = 5 * 60 * 1000;
export const CLAVE = "govsync.loginIntentos";
export const CLAVE_ENVIO = "govsync.loginEnvio";

function entero(valor) {
  return Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 0;
}

/**
 * Lógica pura del contador. `almacenamiento` (compartido entre pestañas:
 * fallos y hora) y `sesion` (de esta pestaña: marca de envío) tienen
 * `getItem/setItem/removeItem`; `ahora` devuelve milisegundos.
 */
export function crearLimite({
  almacenamiento,
  sesion = almacenamiento,
  ahora = () => Date.now(),
}) {
  function leer() {
    try {
      const crudo = JSON.parse(almacenamiento.getItem(CLAVE));
      return {
        fallos: entero(crudo?.fallos),
        ultimoFallo: entero(crudo?.ultimoFallo),
      };
    } catch {
      return { fallos: 0, ultimoFallo: 0 };
    }
  }

  function guardar(estado) {
    try {
      almacenamiento.setItem(CLAVE, JSON.stringify(estado));
    } catch {
      // Sin almacenamiento no hay límite visual; el servidor sigue contando.
    }
  }

  function marcarEnvio() {
    try {
      sesion.setItem(CLAVE_ENVIO, "1");
    } catch {
      // Sin la marca no se puede inferir el resultado: no se cuenta nada.
    }
  }

  /** Lee y borra la marca de envío de esta pestaña. */
  function consumirEnvio() {
    try {
      const hay = sesion.getItem(CLAVE_ENVIO) === "1";
      sesion.removeItem(CLAVE_ENVIO);
      return hay;
    } catch {
      return false;
    }
  }

  // Milisegundos que faltan para que venza el último fallo. Un valor en el
  // futuro (reloj movido, dato adulterado) no puede pasar de 5 min.
  function restanteDe(estado) {
    if (estado.fallos === 0) return 0;
    const restante = estado.ultimoFallo + BLOQUEO_MS - ahora();
    return Math.max(0, Math.min(BLOQUEO_MS, restante));
  }

  // Vence la ventana: borra los fallos. Un último fallo en el futuro (reloj
  // atrasado) se toma como ocurrido ahora: cuenta 5 min desde ahí y no queda
  // congelado en 5:00 hasta que el reloj alcance esa hora.
  function vigente() {
    const estado = leer();
    if (estado.ultimoFallo > ahora()) {
      estado.ultimoFallo = ahora();
      guardar(estado);
    }
    if (estado.fallos > 0 && restanteDe(estado) === 0) {
      const limpio = { fallos: 0, ultimoFallo: 0 };
      guardar(limpio);
      return limpio;
    }
    return estado;
  }

  return {
    /** Milisegundos de bloqueo que quedan (0 si se puede intentar). */
    restanteMs() {
      const estado = vigente();
      return estado.fallos >= MAX_INTENTOS ? restanteDe(estado) : 0;
    },

    /**
     * Se llama al cargar la página. `hayError`: volvió con error de
     * credenciales. Devuelve los ms de bloqueo que quedan.
     */
    alCargar(hayError) {
      let estado = vigente();
      if (consumirEnvio()) {
        estado = hayError
          ? { fallos: estado.fallos + 1, ultimoFallo: ahora() }
          : { fallos: 0, ultimoFallo: 0 };
        guardar(estado);
      }
      return estado.fallos >= MAX_INTENTOS ? restanteDe(estado) : 0;
    },

    /** Se llama al enviar. `false` si está bloqueado y no debe enviarse. */
    alEnviar() {
      if (this.restanteMs() > 0) return false;
      marcarEnvio();
      return true;
    },
  };
}

function formatear(ms) {
  const segundos = Math.ceil(ms / 1000);
  const m = Math.floor(segundos / 60);
  const s = String(segundos % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Conecta el contador con la página: bloquea usuario, contraseña y botón al
 * 3.er fallo, muestra la cuenta regresiva y rehabilita todo al vencer. Si otra
 * pestaña bloquea (evento `storage`) o se fuerza un envío bloqueado, la página
 * también pasa a bloqueada. Devuelve una función que lo desconecta (pruebas).
 */
export function iniciar({
  documento = document,
  ventana = globalThis,
  almacenamiento = globalThis.localStorage,
  sesion = globalThis.sessionStorage,
  ahora = () => Date.now(),
  programar = (f, ms) => globalThis.setInterval(f, ms),
  cancelar = (id) => globalThis.clearInterval(id),
} = {}) {
  const formulario = documento.getElementById("kc-form-login");
  if (!formulario) return () => {};

  const limite = crearLimite({ almacenamiento, sesion, ahora });
  const contenido = documento.getElementById("limite-intentos-contenido");
  const aviso = documento.getElementById("limite-intentos-aviso");
  const contador = documento.getElementById("limite-intentos-restante");
  const controles = ["username", "password", "kc-login"]
    .map((id) => documento.getElementById(id))
    .filter(Boolean);

  let restante = 0;
  let temporizador = null;

  const poner = (bloqueado) => {
    controles.forEach((control) => {
      control.disabled = bloqueado;
    });
    if (contenido) contenido.hidden = !bloqueado;
  };

  const pintar = () => {
    if (contador)
      contador.textContent = `Tiempo restante: ${formatear(restante)}`;
  };

  const detener = () => {
    if (temporizador !== null) cancelar(temporizador);
    temporizador = null;
  };

  const latido = () => {
    restante = limite.restanteMs();
    if (restante > 0) {
      pintar();
      return;
    }
    detener();
    poner(false);
    controles[0]?.focus();
  };

  // Pone la página en el estado que dicta el contador. `restante` > 0:
  // bloqueada (y el foco pasa al aviso, porque el campo enfocado se
  // deshabilita); 0: habilitada.
  const evaluar = (nuevoRestante) => {
    restante = nuevoRestante;
    if (restante > 0) {
      const estabaBloqueada = temporizador !== null;
      poner(true);
      pintar();
      if (!estabaBloqueada) {
        temporizador = programar(latido, 1000);
        aviso?.focus();
      }
    } else if (temporizador !== null) {
      latido();
    }
  };

  evaluar(limite.alCargar(formulario.dataset.errorCredenciales === "true"));

  formulario.addEventListener("submit", (evento) => {
    if (limite.alEnviar()) return;
    evento.preventDefault();
    evaluar(limite.restanteMs());
  });

  // Otra pestaña bloqueó (o desbloqueó): esta se entera sin esperar.
  const alCambiarAlmacenamiento = (evento) => {
    if (evento.key === CLAVE || evento.key === null) {
      evaluar(limite.restanteMs());
    }
  };
  ventana.addEventListener?.("storage", alCambiarAlmacenamiento);

  return () => {
    detener();
    ventana.removeEventListener?.("storage", alCambiarAlmacenamiento);
  };
}

// En el navegador arranca solo; en las pruebas no hay formulario y no hace
// nada hasta que se llame `iniciar` a mano.
if (
  typeof document !== "undefined" &&
  document.getElementById("kc-form-login")
) {
  iniciar();
}
