# 07 · Monitoreo: Prometheus, Node Exporter y Grafana

Dashboard: **http://10.56.31.44:3060** → *PicoPark · VM y contenedores*. Es la página de inicio de Grafana; el usuario es `admin`.

## Qué se monitorea

```
VM 10.56.31.44
 ├─ Node Exporter  127.0.0.1:19100 ─┐   CPU, memoria, disco y red de la VM
 ├─ cAdvisor       127.0.0.1:18081 ─┤   CPU, memoria, red y reinicios de cada contenedor
 ├─ picopark-host  :3050/metrics   ─┤   jugadores, loop del juego, event loop de Node
 │                                   ▼
 ├─ Prometheus     127.0.0.1:19090      lee cada 15 s, guarda 15 días (máx. 500 MB), evalúa alertas
 │                                  ▼
 └─ Grafana        :3060 (red)         dashboard; es lo único accesible desde la red
```

| Componente | Imagen | Qué aporta |
|---|---|---|
| Node Exporter | `prom/node-exporter:v1.12.1` | Métricas del sistema operativo de la VM |
| cAdvisor | `ghcr.io/google/cadvisor:v0.60.6` | Métricas por contenedor, de **todos** los contenedores de la VM, no solo del juego |
| `/metrics` del juego | `prom-client` en `host/server.js` | Métricas propias de la aplicación |
| Prometheus | `prom/prometheus:v3.16.0` | Recolección, almacenamiento y reglas de alerta |
| Grafana | `grafana/grafana:13.3.2` | Visualización |

### Métricas propias de la aplicación (`GET /metrics`)

| Métrica | Tipo | Significado |
|---|---|---|
| `picopark_players{estado}` | gauge | Jugadores en `lobby` y `jugando` |
| `picopark_socket_connections` | gauge | Conexiones WebSocket abiertas (pantalla del host + gamepads) |
| `picopark_game_status{estado}` | gauge | 1 en el estado actual: `lobby`, `jugando` o `nivel completo` |
| `picopark_level` | gauge | Nivel en curso |
| `picopark_tick_duration_seconds` | histograma | Duración de cada vuelta del loop de física (solo durante una partida) |
| `picopark_inputs_total` | contador | Botones recibidos de los gamepads |
| `picopark_levels_completed_total` | contador | Niveles terminados |
| `nodejs_*`, `process_*` | varios | Métricas estándar de Node: CPU, memoria, heap y retraso del event loop |

El smoke test del CI (módulo 04) verifica que `/metrics` responda: una imagen sin métricas no se publica.

## Cómo se interpreta el dashboard

### Estado general

| Panel | Qué mirar |
|---|---|
| **Servicios** | Un recuadro por cada destino que lee Prometheus. **UP** (verde) indica que respondió en la última lectura. **CAÍDO** (rojo) indica que no respondió: contenedor detenido, reiniciándose o colgado. |
| **Jugadores conectados** | Total actual (máximo 4). Muestra *sin datos* si el juego no responde. |
| **Alertas activas** | *Ninguna* (verde) o la cantidad de alertas disparadas (rojo). El detalle está en la tabla del final. |
| **VM encendida hace** | Si vuelve a cero, la VM se reinició. |

### VM (Node Exporter)

| Panel | Normal | Señal de problema |
|---|---|---|
| **CPU usada** | Picos cortos | Más de 85 % sostenido: falta CPU y todo se vuelve lento |
| **Memoria usada** | Estable | Cerca de 100 %: el kernel empieza a matar procesos. La caché no cuenta como usada. |
| **Carga del sistema vs núcleos** | Las líneas de carga por debajo de la de núcleos | Carga por encima de los núcleos: hay procesos esperando CPU |
| **Disco raíz** | Verde (menos de 70 %) | Amarillo desde 70 % y rojo desde 85 %. Cada despliegue deja la versión anterior del juego en la VM. Para liberar espacio se borran **solo las imágenes propias** que ya no se usan: `docker image ls ghcr.io/gomezthiago123/picopark-host` y `docker image rm <imagen:tag>`. En una VM compartida **no** hay que usar `docker image prune -a`, porque borra también imágenes de otros proyectos. |
| **Disco: lectura y escritura** | Picos durante despliegues (`docker pull`) | Escritura alta sostenida sin despliegues |
| **Red de la VM** | Picos en despliegues y durante las partidas | Tráfico alto sin partidas ni despliegues |

### Contenedores (cAdvisor)

| Panel | Cómo leerlo |
|---|---|
| **CPU por contenedor** | 100 % equivale a un núcleo entero. Sirve para ver qué contenedor consume la CPU que muestra el panel de la VM. Como la VM es compartida, se muestran los 8 que más usan. |
| **Memoria por contenedor** | Memoria en uso que no se puede liberar. Una línea que **solo sube** y nunca baja sugiere una pérdida de memoria. Se muestran los 8 que más usan. |
| **Red por contenedor** | Tráfico de cada contenedor. El del juego sube durante las partidas: el servidor manda el estado 60 veces por segundo. |
| **Tiempo desde el último inicio** | Si un contenedor muestra pocos segundos o minutos y no hubo despliegue, **se cayó y Docker lo reinició**. Es la forma de detectar caídas cortas que no llegan a disparar una alerta. |

Cada contenedor tiene siempre el mismo color, que se asigna por nombre, en los tres gráficos.

### Aplicación (PicoPark)

| Panel | Cómo leerlo |
|---|---|
| **Jugadores y conexiones** | Jugadores en lobby, en partida y conexiones abiertas. Conexiones sin jugadores son pantallas del host abiertas sin gamepads. |
| **Duración del tick de física** | **Es el panel clave para detectar un cuello de botella.** El juego corre a 60 FPS, así que cada tick tiene 16,7 ms (la línea roja). En las pruebas el p95 rondó los 2 ms. Si el p95 se acerca a la línea, el servidor no llega a procesar la física a tiempo y el juego se traba. |
| **Retraso del event loop** | Cuánto tarda Node en atender una tarea lista. Se mide cada 10 ms, así que **~10 ms es el valor normal en reposo**. Si sube por encima, el proceso está saturado y los inputs llegan tarde. |
| **Inputs por segundo** | Actividad real de juego: botones apretados por segundo. |
| **Partida / Nivel / Niveles completados** | Estado actual del juego. |

Cómo diagnosticar un juego lento:
- Si el tick y el event loop suben pero la CPU de la VM está baja, el problema es el código del juego.
- Si la CPU de la VM está alta, hay que mirar en *CPU por contenedor* quién la está usando.

## Alertas

Están definidas en [`monitoring/prometheus/alertas.yml`](../monitoring/prometheus/alertas.yml). No hay Alertmanager, así que no se envían avisos: las alertas se ven en el panel **Alertas activas** y en la tabla del final.

| Alerta | Condición | Severidad |
|---|---|---|
| `ServicioCaido` | Un destino no responde durante 1 minuto | crítica |
| `CPUAlta` | CPU de la VM por encima de 85 % durante 5 minutos | advertencia |
| `MemoriaAlta` | Memoria por encima de 90 % durante 5 minutos | advertencia |
| `DiscoCasiLleno` | Disco raíz por encima de 85 % durante 10 minutos | advertencia |
| `LoopDelJuegoLento` | p95 del tick por encima de 16,7 ms durante 2 minutos | advertencia |

El estado *pending* indica que la condición se cumple pero todavía no pasó el tiempo mínimo. Así se evitan alertas por picos de pocos segundos.

## Implementación

**Compose separado de infraestructura** ([`monitoring/docker-compose.yml`](../monitoring/docker-compose.yml), proyecto `picopark-monitoreo`), no el mismo compose del juego:

- El monitoreo no se reinicia en cada despliegue del juego. Si se reiniciara, perdería justamente el momento que interesa observar.
- Observa todos los contenedores de la VM, incluidos los de otros proyectos.

**Red del host y puertos.** Los cuatro servicios usan `network_mode: host`, que es lo que necesita Node Exporter para ver la red real de la VM:

- Prometheus, Node Exporter y cAdvisor escuchan solo en `127.0.0.1`. No son accesibles desde la red.
- Grafana escucha en el puerto **3060**.

**La VM es compartida.** Corren unos 17 contenedores de varios proyectos, y otro proyecto ya tiene su propio Prometheus, Node Exporter y Grafana en los puertos estándar (9090, 9100 y 3003). Por eso nuestro stack usa **19090, 19100 y 18081** y no toca nada de los demás. El primer despliegue falló justamente por ese choque de puertos. Desde entonces, el script baja nuestra versión anterior, **comprueba que los puertos estén libres** antes de levantar nada y, si alguno está ocupado, falla diciendo cuál y quién lo usa. cAdvisor observa todos los contenedores de la VM: sirve para ver si el juego anda lento porque otro proyecto está usando la CPU o la memoria.

**Despliegue automático.** El workflow [`Monitoreo`](../.github/workflows/monitoreo.yml) corre en el runner de la VM cada vez que cambia algo en `monitoring/`, o a mano con *Run workflow*. Ejecuta [`monitoring/desplegar.sh`](../monitoring/desplegar.sh), que:

1. Copia la configuración a `~/picopark-monitoreo` (carpeta con permisos 700).
2. Escribe un `.env` con la contraseña de Grafana, legible solo por el usuario.
3. Descarga las imágenes y recrea los contenedores.
4. Verifica que Prometheus lea Node Exporter, cAdvisor y a sí mismo (si alguno falla, el job queda en rojo) y que haya métricas de contenedores.
5. Verifica que Grafana esté sana y que el dashboard esté cargado. El estado del juego se informa pero no bloquea.

**Datos persistentes.** Prometheus y Grafana guardan sus datos en volúmenes de Docker (`prometheus-data`, `grafana-data`). Sobreviven a reinicios y redespliegues. Prometheus tiene un límite de 500 MB porque el disco de la VM está casi lleno (87 % al instalar el monitoreo).

**Dashboard como código.** El dashboard es [`monitoring/grafana/dashboards/picopark.json`](../monitoring/grafana/dashboards/picopark.json) y se carga solo. No se puede modificar desde la interfaz: los cambios se hacen en el archivo y se despliegan con un push.

## Acceso y credenciales

| Qué | Dónde |
|---|---|
| Usuario de Grafana | `admin` |
| Contraseña de Grafana | Secreto `GRAFANA_ADMIN_PASSWORD` del repo (Settings → Secrets and variables → Actions) y `~/picopark-monitoreo/.env` en la VM |
| Prometheus (diagnóstico) | No está expuesto. Hay que abrir un túnel desde la laptop: `ssh -L 19090:127.0.0.1:19090 Thiago@10.56.31.44` y entrar a http://localhost:19090 |

Grafana toma la contraseña **solo la primera vez que arranca**. Para cambiarla después, cambiala desde Grafana (Perfil → Cambiar contraseña) y actualizá también el secreto del repo, que el workflow usa para verificar el dashboard.

## Pruebas realizadas

Antes de subirlo, el stack completo se probó en la laptop con el mismo script de despliegue:

1. Los cuatro destinos quedaron **UP** y cAdvisor reportó 7 contenedores con Docker 29, que usa el almacenamiento de imágenes de containerd.
2. Las 26 consultas del dashboard devolvieron datos.
3. Una partida simulada (pantalla del host + 3 gamepads enviando inputs) llenó los paneles de la aplicación: tick p95 ≈ 2 ms, unos 40 inputs/s y 4 conexiones.
4. Se detuvo el contenedor del juego. Al minuto, el panel Servicios mostró **picopark-host CAÍDO**, se disparó `ServicioCaido` y *Jugadores conectados* pasó a *sin datos*.

## Evidencia

1. **Actions → Monitoreo**: el job en verde. Su log muestra la tabla de destinos UP y la cantidad de contenedores observados.
2. **http://10.56.31.44:3060**: el dashboard con datos de la VM, los contenedores y el juego. Conviene jugar una partida para que se llenen los paneles de la aplicación.
3. Para mostrar la detección de caídas: `docker stop picopark-host` en la VM y esperar un minuto. Aparece CAÍDO y la alerta. Después se vuelve a levantar con `cd ~/picopark-deploy && docker compose up -d`.
