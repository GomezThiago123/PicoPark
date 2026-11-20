# 04 · CI con GitHub Actions

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Las ejecuciones se ven en <https://github.com/GomezThiago123/PicoPark/actions>.

## Cuándo corre

| Evento | Verifica y prueba | Publica en GHCR | Tags |
|--------|:-:|:-:|------|
| Push a `main` | Sí | Sí | `sha-<commit>`, `latest` |
| Push de un tag `vX.Y.Z` | Sí | Sí | `sha-<commit>`, `X.Y.Z` |
| Pull request a `main` | Sí | No | — |
| Manual (botón *Run workflow*) | Sí | Sí | según la rama |

Los tags siguen la convención del módulo 03 (ver [03-registro-imagenes.md](03-registro-imagenes.md)).

## Jobs

```
host ──────► imagen
gamepad
```

1. **host — instalar y verificar**: `npm ci` con el `package-lock.json` y `node --check` sobre `server.js` y `public/game.js`. El host es JavaScript sin paso de compilación, así que el "build" es instalar las dependencias exactas y verificar que el código parsea.
2. **gamepad — chequeo de tipos**: `npm ci` y `tsc --noEmit`. Es la verificación de compilación de la app móvil. El APK se genera con EAS (servicio de Expo), fuera de este pipeline.
3. **imagen — build, prueba y publicación** (solo si `host` pasó):
   1. `docker/metadata-action` calcula los tags y los labels OCI (commit, fecha, repo).
   2. Construye la imagen con caché de GitHub Actions.
   3. **Smoke test**: levanta el contenedor y verifica que respondan el lobby (`/`), el cliente de socket.io y el endpoint del QR (`/qr`).
   4. Login en GHCR con el `GITHUB_TOKEN` del workflow y `docker push` de **la misma imagen que pasó la prueba**, sin reconstruirla.

## Tests

El proyecto no tiene tests automatizados propios. El pipeline incluye lo que sí se puede verificar:

- La sintaxis del host (`node --check`).
- Los tipos del gamepad (`tsc --noEmit`).
- El smoke test de la imagen: si el servidor no arranca o falta una ruta, no se publica la imagen.

Cuando se agreguen tests (por ejemplo `npm test` en `host/`), se suma un paso `npm test` en el job `host`.

## Credenciales

No hay secretos guardados en el repo ni en la configuración de Actions. El workflow usa el `GITHUB_TOKEN`, que GitHub crea en cada ejecución y vence cuando termina. Tiene permiso `packages: write` solo en el job `imagen`; el resto del workflow tiene únicamente `contents: read`.

El paquete `picopark-host` se creó desde la laptop con un token personal, así que puede ser necesario darle acceso al repositorio una sola vez. En la página del paquete: **Package settings → Manage Actions access → Add repository → PicoPark**, con rol **Write**.

## Evidencia

- En la pestaña **Actions** del repo, cada push a `main` muestra una ejecución de **CI** con los tres jobs en verde.
- El resumen de la ejecución lista los tags publicados.
- En la página del paquete aparece el nuevo `sha-<commit>` del push, y `latest` apunta a esa imagen.

Para desplegar esa imagen en la VM, se cambia `IMAGE_TAG` en `~/PicoPark/deploy/.env` y se corre `docker compose pull && docker compose up -d`. El módulo 05 automatiza ese paso.
