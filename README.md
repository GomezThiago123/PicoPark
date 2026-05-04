# Pico Park — WebSockets

Juego cooperativo multijugador con servidor Node.js y app móvil React Native.

## Estructura

```
PicoPark/
├── host/        # Servidor del juego (Node.js + socket.io + Matter.js)
└── gamepad/     # App móvil del control (React Native + Expo)
```

---

## Host (PC)

### Instalación

```bash
cd host
npm install
```

### Iniciar

```bash
npm start
# o en desarrollo con auto-reload:
npm run dev
```

Abrí el navegador en `http://localhost:3000`.
La IP de la LAN aparece en la consola (ej. `192.168.1.15:3000`).

### Stack
- **Express** — servidor HTTP + archivos estáticos
- **Socket.io** — WebSockets bidireccionales (broadcast de estado, recepción de inputs)
- **Matter.js** — motor de físicas (gravedad, colisiones, apilar jugadores)
- **QRCode** — genera el QR para emparejar el gamepad

---

## Gamepad (Móvil)

### Instalación

```bash
cd gamepad
npm install
```

### Correr en modo desarrollo

```bash
npm start
# Luego escanear el QR con Expo Go (Android/iOS)
```

### Compilar APK (Android)

```bash
# Requiere cuenta en expo.dev y EAS CLI instalado
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

### Stack
- **Expo** (SDK 51) — toolchain React Native
- **socket.io-client** — conexión WebSocket al servidor
- **expo-barcode-scanner** — escanear QR para conectarse
- **expo-keep-awake** — evita que la pantalla se bloquee

---

## Cómo jugar

1. Iniciar el servidor: `cd host && npm start`
2. Abrir `http://localhost:3000` en la PC (pantalla del juego)
3. Los jugadores abren la app en el celular → ingresan la IP o escanean el QR
4. Una vez conectados los 4 jugadores, la partida comienza automáticamente

### Controles
- **◄ ►** — moverse
- **A** — saltar (también se puede saltar encima de otros jugadores en el Nivel 2)

### Niveles
| Nivel | Objetivo |
|-------|----------|
| 1 | Llegar a la llave y luego todos a la puerta |
| 2 | Apilarse para alcanzar la plataforma elevada donde está la llave |

---

## Arquitectura de red

```
Celular (Gamepad)                     PC (Host)
     │                                    │
     │  emit('input', {key, pressed})     │
     │ ─────────────────────────────────► │
     │                                    │  Motor de físicas (30 FPS)
     │  emit('gameState', {...})          │
     │ ◄───────────────────────────────── │
     │                                    │
```

Cada 33ms el servidor corre un tick del motor de físicas y transmite el estado completo a todos los clientes conectados.
