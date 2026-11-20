FROM node:22-alpine
WORKDIR /app/host
COPY host/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY host/ .
EXPOSE 3000
CMD ["npm", "start"]
