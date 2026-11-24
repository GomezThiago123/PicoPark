#!/usr/bin/env bash
# Despliega una versión del host en la VM, la verifica y, si falla, vuelve a la anterior.
#
#   deploy/desplegar.sh sha-82bca35
#   deploy/desplegar.sh 1.0.0
#
# Lo ejecutan, en el runner self-hosted de la VM:
#   - el job "Despliegue" del workflow CI (después de cada push a main)
#   - el workflow manual "Desplegar versión" (para volver a una versión anterior)
# También se puede correr a mano en la VM desde un clon del repo.
#
# Estado en la VM: $DEPLOY_DIR (por defecto ~/picopark-deploy) guarda el compose
# y un .env con la versión desplegada. Ver docs/05-cd-vm.md.
set -euo pipefail

TAG="${1:?Uso: $0 <tag>   (ej: sha-82bca35 o 1.0.0)}"

IMAGE="ghcr.io/gomezthiago123/picopark-host"
PROJECT="picopark-host"       # igual al "name:" de deploy/docker-compose.yml
CONTAINER="picopark-host"     # igual al "container_name:"
DEPLOY_DIR="${DEPLOY_DIR:-$HOME/picopark-deploy}"
HOST_PORT="${HOST_PORT:-3050}"
URL="http://localhost:$HOST_PORT"
SRC_COMPOSE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/docker-compose.yml"

log() { echo "==> $*"; }

imagen_actual() { docker inspect -f '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true; }

levantar() {  # $1 = tag
  printf 'IMAGE_TAG=%s\nHOST_PORT=%s\n' "$1" "$HOST_PORT" > .env
  docker compose up -d
}

verificar() {  # $1 = tag esperado. Hasta ~60 s para que arranque.
  local esperado="$IMAGE:$1"
  for _ in $(seq 1 30); do
    if [[ "$(imagen_actual)" == "$esperado" ]] \
      && [[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" == "true" ]] \
      && curl -sf -o /dev/null "$URL/" \
      && curl -sf "$URL/qr" | grep -F '"addr"' > /dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Solo tags que no cambian: con "latest" no se sabe qué versión queda ni a cuál volver.
if [[ ! "$TAG" =~ ^(sha-[0-9a-f]{7}|[0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo "Tag inválido: '$TAG'. Usar sha-<7 caracteres hex> o X.Y.Z." >&2
  exit 2
fi

mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

ANTERIOR="$(imagen_actual)"
TAG_ANTERIOR=""
if [[ "$ANTERIOR" == "$IMAGE:"* ]]; then TAG_ANTERIOR="${ANTERIOR#"$IMAGE:"}"; fi
log "Versión actual: ${TAG_ANTERIOR:-ninguna}  ->  nueva: $TAG"

# 1. Descargar antes de tocar nada: si el tag no existe, la versión actual sigue corriendo.
log "Descargando $IMAGE:$TAG"
docker pull --quiet "$IMAGE:$TAG"

# 2. Compose nuevo, guardando el anterior por si hay que volver atrás.
if [[ -f docker-compose.yml ]]; then cp docker-compose.yml docker-compose.yml.anterior; fi
cp "$SRC_COMPOSE" docker-compose.yml

# 3. Si el contenedor lo creó otro proyecto compose (despliegue manual anterior), se reemplaza.
if docker inspect "$CONTAINER" > /dev/null 2>&1; then
  proyecto="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$CONTAINER")"
  if [[ "$proyecto" != "$PROJECT" ]]; then
    log "El contenedor $CONTAINER es del proyecto '${proyecto:-sin compose}'; se reemplaza"
    docker rm -f "$CONTAINER" > /dev/null
  fi
fi

# 4. Levantar y verificar.
log "Levantando $TAG"
levantar "$TAG"

log "Verificando $URL"
if verificar "$TAG"; then
  log "OK: $TAG desplegada y respondiendo en $URL"
  exit 0
fi

# 5. Recuperación: volver a la versión que estaba antes.
echo "::error::La versión $TAG no pasó la verificación"
docker logs --tail 40 "$CONTAINER" 2>&1 || true

if [[ -z "$TAG_ANTERIOR" ]]; then
  echo "::error::No hay una versión anterior a la que volver"
  exit 1
fi

log "Volviendo a $TAG_ANTERIOR"
if [[ -f docker-compose.yml.anterior ]]; then cp docker-compose.yml.anterior docker-compose.yml; fi
levantar "$TAG_ANTERIOR"
if verificar "$TAG_ANTERIOR"; then
  echo "::warning::Se volvió a $TAG_ANTERIOR, que sigue respondiendo"
else
  echo "::error::La versión anterior $TAG_ANTERIOR tampoco responde"
fi
exit 1
