#!/usr/bin/env bash
# Despliega (o actualiza) el stack de monitoreo en la VM y verifica que funcione.
#
#   GRAFANA_ADMIN_PASSWORD=... monitoring/desplegar.sh
#
# Lo ejecuta el workflow "Monitoreo" en el runner self-hosted de la VM.
# Estado en la VM: $MONITOREO_DIR (por defecto ~/picopark-monitoreo) con el compose,
# la configuración y un .env (solo legible por el usuario) con la contraseña de Grafana.
# Los datos de Prometheus y Grafana viven en volúmenes de Docker y no se borran.
set -euo pipefail

DIR="${MONITOREO_DIR:-$HOME/picopark-monitoreo}"
GRAFANA_PORT="${GRAFANA_PORT:-3060}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROM="http://127.0.0.1:19090"
GRAFANA="http://127.0.0.1:$GRAFANA_PORT"
PUERTOS="19090 19100 18081 $GRAFANA_PORT"          # ver monitoring/docker-compose.yml
OBLIGATORIOS="prometheus node-exporter cadvisor"   # el juego se informa pero no bloquea

log() { echo "==> $*"; }

: "${GRAFANA_ADMIN_PASSWORD:?Falta GRAFANA_ADMIN_PASSWORD (secreto del repo)}"
if [[ "$GRAFANA_ADMIN_PASSWORD" == *"'"* || "$GRAFANA_ADMIN_PASSWORD" == *$'\n'* ]]; then
  echo "La contraseña de Grafana no puede tener comillas simples ni saltos de línea." >&2
  exit 2
fi

# Valor de la primera serie de una consulta instantánea a Prometheus, o vacío si no hay.
# Nunca falla: con "set -e" una consulta sin resultados cortaría el script.
consulta() {
  curl -sfG "$PROM/api/v1/query" --data-urlencode "query=$1" \
    | grep -o '"value":\[[^]]*\]' | head -1 | sed -E 's/.*,"([^"]*)"\]/\1/' || true
}

# 1. Copiar configuración a la carpeta estable de la VM.
mkdir -p "$DIR"
chmod 700 "$DIR"
cd "$DIR"
rm -rf prometheus grafana
cp -r "$SRC/prometheus" "$SRC/grafana" "$SRC/docker-compose.yml" .
(umask 077; printf "GRAFANA_ADMIN_PASSWORD='%s'\nGRAFANA_PORT=%s\n" "$GRAFANA_ADMIN_PASSWORD" "$GRAFANA_PORT" > .env)

# 2. Descargar imágenes antes de bajar nada.
log "Descargando imágenes"
docker compose pull --quiet

# 3. Bajar la versión anterior (los datos quedan en los volúmenes) y comprobar que
#    los puertos estén libres: la VM es compartida y otro servicio podría estar usándolos.
log "Bajando la versión anterior del monitoreo"
docker compose down --remove-orphans
ocupados=""
for p in $PUERTOS; do
  if ss -ltnH "sport = :$p" | grep -q .; then ocupados="$ocupados $p"; fi
done
if [[ -n "$ocupados" ]]; then
  echo "::error::Puertos ocupados por otro servicio de la VM:$ocupados. Cambiarlos en monitoring/."
  for p in $ocupados; do ss -ltnH "sport = :$p"; done
  exit 1
fi

log "Levantando el stack"
docker compose up -d

# 4. Verificar.
log "Esperando a Prometheus"
for _ in $(seq 1 30); do curl -sf -o /dev/null "$PROM/-/ready" && break; sleep 2; done
curl -sf -o /dev/null "$PROM/-/ready" || { echo "::error::Prometheus no arrancó"; docker compose logs --tail 30 prometheus; exit 1; }

log "Esperando a que Prometheus lea todos los destinos (hasta 90 s)"
ok=false
for _ in $(seq 1 30); do
  ok=true
  for job in $OBLIGATORIOS; do
    [[ "$(consulta "up{job=\"$job\"}")" == "1" ]] || ok=false
  done
  $ok && break
  sleep 3
done

echo "Destino          Estado"
for job in $OBLIGATORIOS picopark-host; do
  v="$(consulta "up{job=\"$job\"}")"
  case "$v" in 1) e="UP" ;; 0) e="CAÍDO" ;; *) e="sin datos" ;; esac
  printf '%-16s %s\n' "$job" "$e"
done

if ! $ok; then
  echo "::error::Algún componente del monitoreo no responde"
  docker compose ps
  docker compose logs --tail 30
  exit 1
fi
[[ "$(consulta 'up{job="picopark-host"}')" == "1" ]] \
  || echo "::warning::El juego todavía no expone /metrics (¿ya se desplegó la versión con métricas?)"

log "Comprobando que haya métricas de la VM y de los contenedores"
echo "  Memoria usada de la VM:    $(consulta '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)' | cut -c1-5) %"
echo "  Contenedores observados:   $(consulta 'count(container_memory_working_set_bytes{name!=""})')"
[[ -n "$(consulta 'count(container_memory_working_set_bytes{name!=""})')" ]] \
  || { echo "::error::cAdvisor no está reportando contenedores"; exit 1; }

log "Esperando a Grafana"
for _ in $(seq 1 30); do curl -sf "$GRAFANA/api/health" | grep -q '"database": *"ok"' && break; sleep 2; done
curl -sf "$GRAFANA/api/health" | grep -q '"database": *"ok"' || { echo "::error::Grafana no arrancó"; docker compose logs --tail 30 grafana; exit 1; }

# La contraseña va por stdin (-K -) para que no aparezca en la lista de procesos.
if printf 'user = "admin:%s"\n' "$GRAFANA_ADMIN_PASSWORD" \
  | curl -sf -K - "$GRAFANA/api/dashboards/uid/picopark" | grep -q '"uid":"picopark"'; then
  log "Dashboard 'PicoPark · VM y contenedores' cargado"
else
  echo "::warning::No se pudo confirmar el dashboard (¿cambiaron la contraseña de admin desde Grafana?)"
fi

log "OK: monitoreo funcionando. Grafana en el puerto $GRAFANA_PORT"
