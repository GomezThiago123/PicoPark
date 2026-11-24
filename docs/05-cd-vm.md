# 05 · CD hacia la VM

Cada push a `main` termina desplegado en la VM (`10.56.31.44:3050`) sin intervención manual:

```
push a main ─► CI (GitHub) ─────────────────────────► CD (runner en la VM)
               host ✓  gamepad ✓  imagen ✓ ─ GHCR ─►  desplegar.sh sha-<commit>
                                                       pull → up -d → verificar
                                                       (si falla: vuelve a la anterior)
```

- Job **Despliegue · VM** en [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
- Workflow manual **Desplegar versión** en [`.github/workflows/desplegar-version.yml`](../.github/workflows/desplegar-version.yml), para volver a una versión anterior.
- Script [`deploy/desplegar.sh`](../deploy/desplegar.sh), que corren los dos y que también se puede usar a mano.

## Alternativas evaluadas

| | SSH desde el pipeline | Runner self-hosted en la VM |
|---|---|---|
| Conexión | GitHub → VM (entrante, puerto 22) | VM → GitHub (saliente, HTTPS) |
| ¿Funciona con nuestra VM? | **No.** `10.56.31.44` es una IP privada: los runners de GitHub están en internet y no la alcanzan. Haría falta abrir un puerto en la red de la facultad o montar un túnel. | **Sí.** La VM ya sale a GitHub y a GHCR (hace `git pull` y `docker pull`). |
| Secretos en GitHub | Clave SSH privada, host y usuario | Ninguno |
| Superficie expuesta | Puerto SSH accesible desde internet | Nada nuevo abierto en la VM |

**Elegido: runner self-hosted.** Es la única opción que funciona sin cambiar la red, y además no requiere guardar ninguna credencial de la VM en GitHub.

## Instalación del runner (una sola vez, en la VM)

1. En GitHub: **Settings → Actions → Runners → New self-hosted runner**, sistema **Linux**, arquitectura **x64**.
2. En la VM, como el usuario `Thiago` (no como root), correr los comandos de la sección **Download** que muestra esa página. Crean `~/actions-runner`.
3. Configurar con el comando de la sección **Configure** de esa página, agregando nombre y etiqueta:

   ```bash
   ./config.sh --url https://github.com/GomezThiago123/PicoPark --token <TOKEN_DE_LA_PÁGINA> \
     --name picopark-vm --labels picopark-vm --unattended
   ```

4. Instalarlo como servicio, para que arranque solo cuando se reinicia la VM:

   ```bash
   sudo ./svc.sh install Thiago
   sudo ./svc.sh start
   sudo ./svc.sh status
   ```

5. En **Settings → Actions → Runners** tiene que aparecer `picopark-vm` en estado **Idle**.

Requisitos en la VM, ya cumplidos desde los módulos anteriores:
- `Thiago` puede usar Docker sin `sudo`.
- `curl` está instalado.
- Hay un `docker login ghcr.io` hecho con un token `read:packages`.

## Acceso y credenciales

| Credencial | Dónde está | Para qué | Vence / se revoca |
|---|---|---|---|
| Token de registro del runner | Solo se usa en `config.sh` | Registrar el runner | Vence en 1 hora y no se reutiliza |
| Credencial del runner | `~/actions-runner/.credentials` (solo legible por `Thiago`) | Que el runner reciba jobs de este repo | Se revoca quitando el runner en Settings → Runners |
| Token `read:packages` | `~/.docker/config.json` de la VM | `docker pull` desde GHCR | A los 30 días. Después hay que generar otro y repetir `docker login ghcr.io` |
| `GITHUB_TOKEN` | Lo crea GitHub en cada ejecución | Publicar la imagen (job `imagen`) | Vence al terminar el job |

- El runner corre como `Thiago`, no como root. Igual, estar en el grupo `docker` equivale en la práctica a ser root en la VM. Por eso se limita quién puede hacer que el runner ejecute algo (ver [Seguridad](#seguridad-del-runner-en-un-repo-público)).
- Si vence el token `read:packages`, el despliegue falla en el paso *Descargando* con `unauthorized` y **la versión actual sigue corriendo**.

## Variables y secretos

No hay secretos guardados en GitHub para el despliegue. La configuración es:

| Valor | Dónde | Valor actual |
|---|---|---|
| Imagen | `deploy/desplegar.sh`, `ci.yml` | `ghcr.io/gomezthiago123/picopark-host` |
| Tag a desplegar | Salida del job `imagen` (`needs.imagen.outputs.tag`) | `sha-<commit>` del push |
| Runner destino | `runs-on: [self-hosted, picopark-vm]` | Etiqueta `picopark-vm` |
| Carpeta de despliegue en la VM | `DEPLOY_DIR` | `~/picopark-deploy` |
| Puerto publicado | `HOST_PORT` | `3050` |
| IP y puerto que muestra el QR | `PUBLIC_IP`, `PUBLIC_PORT` en `host/server.js` | `10.56.31.44:3050` |
| Environment de GitHub | `environment: produccion` | URL `http://10.56.31.44:3050` |

`~/picopark-deploy` contiene el `docker-compose.yml` y un `.env` con el `IMAGE_TAG` y el `HOST_PORT` desplegados, que son el registro de qué versión corre. El script los reescribe en cada despliegue.

## Estrategia de actualización

1. **Solo tags que no cambian.** Se despliega `sha-<commit>`, nunca `latest`, así siempre se sabe qué código corre y a qué versión volver. El script rechaza cualquier otro formato.
2. **Primero descargar, después reemplazar.** `docker pull` corre antes de tocar el contenedor. Si la imagen no existe o falla la descarga, la versión actual sigue corriendo.
3. **Reemplazo directo.** `docker compose up -d` recrea el contenedor con la imagen nueva. Hay unos segundos sin servicio y las partidas en curso se cortan, porque el estado del juego vive en memoria. Para un único servidor de juego en una VM es aceptable; no se hace blue/green.
4. **Un despliegue a la vez.** `concurrency: despliegue-vm`. Si llegan dos pushes seguidos, el segundo espera al primero.
5. **Qué dispara un despliegue.** Solo push a `main` (o *Run workflow* sobre `main`). Los pull requests y los tags `vX.Y.Z` no despliegan.

## Verificación posterior al despliegue

`desplegar.sh` espera hasta 60 segundos a que se cumpla todo esto:

- El contenedor `picopark-host` está corriendo **con la imagen del tag pedido**.
- `GET /` responde 200 (el lobby).
- `GET /qr` devuelve la dirección para los gamepads.

Si se cumple, el job queda en verde y deja en el resumen la versión desplegada. GitHub registra el despliegue en el environment **produccion**, que aparece como *Deployments* en la página del repo con el historial de versiones.

Desde cualquier máquina de la red: abrir `http://10.56.31.44:3050`.

## Recuperación ante una versión fallida

| Situación | Qué pasa / qué hacer |
|---|---|
| La versión nueva no pasa la verificación | **Automático**: el script vuelve a la versión anterior (imagen y compose), la verifica y el job termina en rojo con el error y los logs del contenedor. |
| La versión pasa la verificación pero tiene un bug | **Actions → Desplegar versión → Run workflow** con el tag anterior (por ejemplo `sha-82bca35`). Los tags disponibles están en la [página del paquete](https://github.com/users/GomezThiago123/packages/container/package/picopark-host). Después, corregir con `git revert` + push, que despliega la corrección por el flujo normal. |
| GitHub no está disponible | En la VM: `cd ~/picopark-deploy`, poner el tag anterior en `IMAGE_TAG` dentro de `.env` y correr `docker compose up -d`. |
| El runner está apagado | El job queda *Queued* hasta que vuelve (máximo 24 h). La versión actual sigue corriendo. Ver con `sudo ~/actions-runner/svc.sh status`. |

## Seguridad del runner en un repo público

Un runner self-hosted ejecuta el código del workflow en la VM, y el repo es público. Medidas:

- Los jobs que usan el runner (`picopark-vm`) solo corren en **push a `main`** o en ejecución manual. Las dos cosas requieren permiso de escritura en el repo.
- **Settings → Actions → General → Fork pull request workflows from outside collaborators → "Require approval for all external contributors"**. Así, un pull request desde un fork no ejecuta nada sin aprobación, ni siquiera si modifica el workflow para apuntar al runner.
- El runner corre como usuario normal, sin root, y la VM no expone puertos nuevos.

## Pruebas realizadas

| # | Prueba | Resultado | Ejecución |
|---|--------|-----------|-----------|
| 1 | Push a `main` (commit `53fe98b`): CI completo + despliegue | ✓ La VM pasó de `sha-648930b` (despliegue manual del módulo 03) a `sha-53fe98b`, verificada | [run 45453191624](https://github.com/GomezThiago123/PicoPark/actions/runs/45453191624) |
| 2 | Rollback manual con *Desplegar versión* a `sha-82bca35` | ✓ La VM volvió a la versión anterior en ~40 s, verificada | [run 45453966647](https://github.com/GomezThiago123/PicoPark/actions/runs/45453966647) |
| 3 | Despliegue de una versión que no existe (`sha-0000000`) | ✓ Falla en *Descargando*, el job queda en rojo y **`sha-82bca35` sigue corriendo** (lobby HTTP 200) | [run 45454130051](https://github.com/GomezThiago123/PicoPark/actions/runs/45454130051) |
| 4 | Push de este documento a `main` | El CD despliega la versión nueva sin intervención y la VM sale de `sha-82bca35` | Último run de *CI* en Actions |
| 5 | Versión que arranca pero no responde (imagen con `exit 1`) | ✓ La verificación falla, el script vuelve solo a la versión anterior y la verifica (~70 s) | Probado en una copia aislada fuera de la VM |

## Evidencia

1. Hacer un push a `main`.
2. En **Actions**, la ejecución de **CI** muestra los cuatro jobs en verde. **Despliegue · VM** corre en el runner `picopark-vm` y su resumen dice qué `sha-…` se desplegó.
3. En la página del repo, **Deployments → produccion** muestra ese despliegue.
4. En la VM:

   ```bash
   cd ~/picopark-deploy && docker compose ps
   cat .env
   ```

   Aparece la imagen `sha-<commit del push>`.
5. `http://10.56.31.44:3050` muestra el cambio.
