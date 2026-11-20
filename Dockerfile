FROM node:22-alpine
WORKDIR /app/host
COPY host/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY host/ .
EXPOSE 3000

# Metadatos OCI. GHCR usa "source" para vincular la imagen con el repo;
# version y revision permiten saber de qué commit sale cada imagen.
ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/GomezThiago123/PicoPark" \
      org.opencontainers.image.title="picopark-host" \
      org.opencontainers.image.description="Servidor host de Pico Park (Node.js + socket.io)" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"

CMD ["npm", "start"]
