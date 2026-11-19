#!/bin/bash
# Arranque de Keycloak en producción (keycloak/Dockerfile, docs/DESPLIEGUE.md).
#
# El realm lee las contraseñas de los usuarios de prueba de GOVSYNC_CLAVE_*, con
# la clave pública de desarrollo (GovSync2026!) como valor por defecto. Si en
# producción falta una variable, Keycloak arrancaría igual y ese usuario quedaría
# con la clave que está en el repositorio. Este script lo impide: es una falla
# CERRADA (el servicio no arranca), no una advertencia.
#
# "Producción" = KC_HOSTNAME definido (Keycloak lo exige en `start`; el
# docker-compose local usa `start-dev` con la imagen oficial y no pasa por aquí).
#
# NUNCA se imprime el valor de ninguna variable, solo su nombre.

set -u

CLAVE_PUBLICA='GovSync2026!'
fallos=0

# Vacía o solo espacios.
esta_vacia() { [[ -z "${1//[[:space:]]/}" ]]; }

if [[ -n "${KC_HOSTNAME:-}" ]]; then
  for variable in GOVSYNC_CLAVE_ADMINISTRADOR GOVSYNC_CLAVE_GESTOR GOVSYNC_CLAVE_VISITANTE; do
    valor="${!variable:-}"
    if esta_vacia "$valor"; then
      echo "ERROR: ${variable} falta o está vacía. Defínela en las variables de entorno del servicio." >&2
      fallos=1
    elif [[ "$valor" == "$CLAVE_PUBLICA" ]]; then
      echo "ERROR: ${variable} es la clave pública de desarrollo (está en el repositorio). Define una propia." >&2
      fallos=1
    fi
  done

  admin="${KC_BOOTSTRAP_ADMIN_PASSWORD:-}"
  if esta_vacia "$admin"; then
    echo "ERROR: KC_BOOTSTRAP_ADMIN_PASSWORD falta o está vacía. Defínela en las variables de entorno del servicio." >&2
    fallos=1
  elif [[ "$admin" == "admin" ]]; then
    echo "ERROR: KC_BOOTSTRAP_ADMIN_PASSWORD es la clave de desarrollo del compose local. Define una propia." >&2
    fallos=1
  fi

  if [[ "$fallos" -ne 0 ]]; then
    echo "ERROR: Keycloak no arranca en producción con claves ausentes o públicas (docs/DESPLIEGUE.md)." >&2
    exit 1
  fi
fi

exec /opt/keycloak/bin/kc.sh "$@"
