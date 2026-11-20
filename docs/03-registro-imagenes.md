# 03 · Registro de imágenes

Registro elegido: **GitHub Container Registry (ghcr.io)**.

El código ya vive en GitHub, y en los módulos 04 y 05 GitHub Actions puede publicar en GHCR con el `GITHUB_TOKEN` del propio workflow, sin guardar credenciales extra en el repo.

## Convención de nombres y tags

Imagen: `ghcr.io/gomezthiago123/picopark-host` (GHCR exige el owner en minúsculas).

| Tag | Ejemplo | Cuándo se genera | ¿Cambia? |
|-----|---------|------------------|----------|
| `sha-<commit>` | `sha-a4f60f7` | En cada publicación | No |
| `X.Y.Z` | `1.0.0` | Si el commit tiene un tag git `vX.Y.Z` | No |
| `latest` | `latest` | Si se publica desde `main` | Sí |

- **Para desplegar se usa siempre un tag que no cambia** (`sha-…` o `X.Y.Z`): así se sabe exactamente qué código corre en la VM y se puede volver a una versión anterior. `latest` está solo por comodidad.
- Es el mismo esquema que genera `docker/metadata-action`, así que el CI del módulo 04 lo puede reutilizar tal cual.
- La imagen lleva labels OCI (`source`, `version`, `revision`). GHCR usa `source` para vincular el paquete al repo, y `revision` guarda el commit completo:

  ```bash
  docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' \
    ghcr.io/gomezthiago123/picopark-host:sha-a4f60f7
  ```

## Autenticación segura

Cada máquina usa un token con el permiso mínimo que necesita:

| Máquina | Para qué | Token (PAT classic) |
|---------|----------|---------------------|
| Laptop | Publicar | Solo `write:packages`, con vencimiento |
| VM | Descargar | Solo `read:packages`, con vencimiento |

Si alguien obtiene el token de la VM, puede bajar la imagen pero no puede publicar ni tocar el repo.

1. Crear el token en <https://github.com/settings/tokens/new> marcando solo el scope indicado y con fecha de vencimiento.
2. Iniciar sesión:

   ```bash
   docker login ghcr.io -u GomezThiago123
   # Password: pegar el token (no se muestra ni queda en el historial)
   ```

   Para scripts se usa `--password-stdin`, nunca `-p <token>`, porque `-p` deja el token en el historial y en `ps`.

Docker guarda la credencial en `~/.docker/config.json` en base64, que **no es cifrado**. Por eso los tokens tienen permisos mínimos y vencimiento. Para borrar la credencial: `docker logout ghcr.io`.

El token nunca va en el Dockerfile, en el compose ni en el repo.

## Publicar una imagen

Desde la laptop, con el árbol de git limpio (el script se niega a publicar si hay cambios sin commitear, porque el tag `sha-…` no correspondería al código):

```bash
git tag v1.0.0                 # opcional: agrega el tag 1.0.0
scripts/publicar-imagen.sh
```

`DRY_RUN=1 scripts/publicar-imagen.sh` construye y etiqueta la imagen sin publicarla.

El paquete queda en <https://github.com/users/GomezThiago123/packages/container/package/picopark-host>. Los paquetes nuevos de GHCR son **privados** por defecto.

## Descargar y ejecutar en la VM

La VM no construye nada: usa [`deploy/docker-compose.yml`](../deploy/docker-compose.yml), que solo tiene `image:` (sin `build:`).

```bash
# desde la laptop
scp deploy/docker-compose.yml <usuario>@10.56.31.44:~/picopark/

# en la VM
cd ~/picopark
docker login ghcr.io -u GomezThiago123      # token read:packages
echo "IMAGE_TAG=sha-a4f60f7" > .env
docker compose pull
docker compose up -d
```

Si en la VM ya corre un `picopark-host` construido desde el código, primero hay que bajarlo (`docker compose down` en esa carpeta), porque usa el mismo nombre de contenedor y el mismo puerto.

Para actualizar o volver atrás, se cambia `IMAGE_TAG` en `.env` y se repite `pull` + `up -d`.

## Evidencia

En la VM:

```bash
docker images ghcr.io/gomezthiago123/picopark-host
docker compose ps
docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' \
  ghcr.io/gomezthiago123/picopark-host:sha-a4f60f7
```

- La imagen aparece con su tag `sha-…` y el contenedor está `Up` en el puerto 3050.
- El label `revision` coincide con el commit en GitHub.
- La VM no tiene el código fuente ni corrió `docker build`.
