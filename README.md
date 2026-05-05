# Pico Park — WebSockets

Juego cooperativo multijugador inspirado en Pico Park. Servidor Node.js con motor de físicas y app móvil React Native como control inalámbrico.

## Estructura

```
PicoPark/
├── host/        # Servidor + juego visual (Node.js + socket.io + Matter.js)
└── gamepad/     # App móvil del control (React Native + Expo SDK 55)
```

---

## Cómo jugar

1. Iniciar el servidor: `cd host && npm start`
2. Abrir `http://localhost:3000` en la PC — aparece la pantalla de **lobby** con un QR
3. Los jugadores abren la app en el celular → ingresan la IP o escanean el QR
4. El host hace click en **INICIAR JUEGO** → el QR desaparece y empieza la partida

### Controles del gamepad
| Botón | Acción |
|-------|--------|
| ◄ ►  | Moverse izquierda / derecha |
| **A** | Saltar (también sobre otros jugadores) |

### Niveles
| Nivel | Objetivo | Cajas |
|-------|----------|-------|
| 1 | Uno recoge la llave, todos llegan a la puerta | 2 cajas empujables |
| 2 | Apilarse encima de otros jugadores para la plataforma elevada | 3 cajas empujables |

---

## Mecánicas implementadas

- **Cajas empujables:** objetos dinámicos que responden a la física. Dos jugadores empujando desde el mismo lado las mueven más rápido (suma de fuerzas).
- **Apilamiento:** los jugadores pueden pararse encima de otros para formar torres.
- **Colisión entre jugadores:** no se atraviesan de costado ni se empujan.
- **Respawn de llave:** si el portador cae al vacío, la llave reaparece en su posición original.
- **Condición de victoria:** la puerta no se abre sin la llave y el nivel no termina hasta que los 4 jugadores estén en la salida.
- **Wake Lock:** la pantalla del celular no se apaga durante el juego.

---

## Host (PC)

### Instalación y uso
```bash
cd host
npm install
npm start
# Abrí http://localhost:3000
```

### Stack técnico
- **Express** — servidor HTTP y archivos estáticos
- **Socket.io** — WebSockets bidireccionales (broadcast a 60 FPS)
- **Matter.js** — motor de físicas (gravedad, colisiones, cajas, apilamiento)
- **QRCode** — genera el QR para emparejar gamepads
- **Canvas 2D** — renderer del juego con personajes pixel-art (gatos)

### Arquitectura de red
```
Celular (Gamepad)                     PC (Host)
     │                                    │
     │  emit('input', {key, pressed})     │
     │ ─────────────────────────────────► │
     │                                    │  Game loop 60 FPS
     │  emit('gameState', {...})          │  Matter.js physics
     │ ◄───────────────────────────────── │
```

---

## Gamepad (Móvil)

### Instalación y uso
```bash
cd gamepad
bun install       # o npm install --legacy-peer-deps
bun start         # escanear el QR con Expo Go
```

### Compilar APK (Android)
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

### Stack técnico
- **Expo SDK 55** — React Native 0.83, React 19
- **socket.io-client** — conexión WebSocket al servidor
- **expo-camera** — escanear QR para conectarse
- **expo-keep-awake** — wake lock de pantalla
- Control multi-touch con zona única (DPad + salto simultáneos sin conflicto)

---

## Requisitos
- Node.js 18+
- Bun (recomendado) o npm
- Expo Go en el celular — [expo.dev/go](https://expo.dev/go)
- PC y celulares en la **misma red WiFi**
