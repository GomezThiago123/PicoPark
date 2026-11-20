#!/usr/bin/env bash
# Construye la imagen del host y la publica en GitHub Container Registry.
#
#   scripts/publicar-imagen.sh             construye y publica
#   DRY_RUN=1 scripts/publicar-imagen.sh   solo construye y etiqueta, no publica
#
# Tags que genera (ver docs/03-registro-imagenes.md):
#   sha-<commit>   siempre
#   X.Y.Z          si HEAD tiene un tag git vX.Y.Z
#   latest         si estás en main
#
# Requiere haber hecho antes: docker login ghcr.io
set -euo pipefail

IMAGE="ghcr.io/gomezthiago123/picopark-host"   # GHCR exige minúsculas
DRY_RUN="${DRY_RUN:-0}"

cd "$(git rev-parse --show-toplevel)"

if [[ -n "$(git status --porcelain)" ]]; then
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "Aviso: hay cambios sin commitear (se permite solo con DRY_RUN=1)." >&2
  else
    echo "Error: hay cambios sin commitear. Hacé commit antes de publicar:" >&2
    echo "el tag sha-<commit> tiene que corresponder exactamente al código de la imagen." >&2
    exit 1
  fi
fi

SHA="$(git rev-parse --short=7 HEAD)"
TAGS=("sha-$SHA")
VERSION="sha-$SHA"

GIT_TAG="$(git describe --tags --exact-match HEAD 2>/dev/null || true)"
if [[ "$GIT_TAG" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  VERSION="${BASH_REMATCH[1]}"
  TAGS+=("$VERSION")
fi

if [[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]]; then
  TAGS+=("latest")
fi

TAG_ARGS=()
for t in "${TAGS[@]}"; do TAG_ARGS+=(-t "$IMAGE:$t"); done

echo "Construyendo $IMAGE con tags: ${TAGS[*]}"
docker build \
  --build-arg VERSION="$VERSION" \
  --build-arg REVISION="$(git rev-parse HEAD)" \
  "${TAG_ARGS[@]}" \
  .

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY_RUN=1: imagen construida, no se publica."
  exit 0
fi

for t in "${TAGS[@]}"; do
  docker push "$IMAGE:$t"
done

echo
echo "Publicada. Para desplegar en la VM (con deploy/docker-compose.yml):"
echo "  IMAGE_TAG=sha-$SHA docker compose pull"
echo "  IMAGE_TAG=sha-$SHA docker compose up -d"
