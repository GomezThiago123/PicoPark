const socket = io();
socket.emit('joinAsHost');

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const overlay = document.getElementById('overlay');

let levelData    = null;
let currentState = null;
let serverInfo   = null;
let qrImage      = null;
let flashMsg     = null;
let flashTimer   = 0;
let playerCount  = 0;
let lobbyPlayers = [];
let gamePhase    = 'lobby'; // 'lobby' | 'playing'

// ─── Eventos de red ────────────────────────────────────────────────────────

socket.on('serverInfo', async (info) => {
  serverInfo = info;
  try {
    const res  = await fetch('/qr');
    const data = await res.json();
    const img  = new Image();
    img.src    = data.qr;
    img.onload = () => { qrImage = img; };
  } catch (_) {}
});

socket.on('levelData', (data) => {
  levelData = data;
  canvas.width  = data.width;
  canvas.height = data.height;
});

socket.on('playerCount', ({ count }) => { playerCount = count; });

socket.on('lobbyUpdate', ({ players, count }) => {
  lobbyPlayers = players;
  playerCount  = count;
});

socket.on('gameStarted', () => {
  gamePhase = 'playing';
});

socket.on('gameState', (state) => {
  currentState = state;
  playerCount  = Object.keys(state.players).length;
});

socket.on('playerJoined', ({ name, count }) => {
  playerCount = count;
  flash(`${name} se unió (${count}/4)`, 2500);
});

socket.on('playerLeft', ({ count }) => {
  playerCount = count;
  flash(`Jugador desconectado (${count}/4)`, 2500);
});

socket.on('keyCollected', ({ playerName }) => {
  flash(`¡${playerName} recogió la llave!`, 2000);
});

socket.on('keyRespawned', () => {
  flash('¡La llave reapareció!', 2500);
});

socket.on('levelComplete', ({ level }) => {
  const isLast = level >= 2;
  document.getElementById('overlayTitle').textContent    = `¡Nivel ${level} completado!`;
  document.getElementById('overlaySubtitle').textContent = isLast
    ? '¡Completaron el juego! Gracias por jugar.'
    : 'Todos los jugadores llegaron a la salida';
  const btn = document.getElementById('overlayBtn');
  if (isLast) {
    btn.textContent = '¡Ganaron! 🎉';
    btn.onclick     = () => { overlay.style.display = 'none'; };
  } else {
    btn.textContent = 'Siguiente Nivel →';
    btn.onclick     = () => { socket.emit('nextLevel'); overlay.style.display = 'none'; };
  }
  overlay.style.display = 'block';
});

socket.on('levelStart', ({ level }) => {
  flash(`Nivel ${level}`, 2000);
});

socket.on('gameOver', () => {
  document.getElementById('overlayTitle').textContent    = '¡Ganaron!';
  document.getElementById('overlaySubtitle').textContent = 'Completaron todos los niveles';
  document.getElementById('overlayBtn').textContent      = '¡Felicidades! 🎉';
  document.getElementById('overlayBtn').onclick          = () => { overlay.style.display = 'none'; };
  overlay.style.display = 'block';
});

function flash(text, duration = 2000) {
  flashMsg   = text;
  flashTimer = duration;
}

// ─── Render ────────────────────────────────────────────────────────────────

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#0d0d2b');
  grad.addColorStop(1, '#1a1a3e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawPlatforms() {
  if (!levelData) return;
  for (const p of levelData.platforms) {
    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(p.x - p.w / 2 + 3, p.y - p.h / 2 + 3, p.w, p.h);
    // Plataforma
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    // Borde superior
    ctx.fillStyle = '#718096';
    ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, 4);
  }
}

function drawBoxes(boxes) {
  if (!boxes) return;
  for (const b of boxes) {
    const { x, y } = b;
    const hw = BOX_W / 2, hh = BOX_H / 2;
    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - hw + 3, y + hh, BOX_W, 5);
    // Cuerpo
    ctx.fillStyle = '#8B6318';
    ctx.fillRect(x - hw, y - hh, BOX_W, BOX_H);
    // Borde
    ctx.strokeStyle = '#5a3d0a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - hw, y - hh, BOX_W, BOX_H);
    // Cruz de madera
    ctx.strokeStyle = '#5a3d0a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - hw + 3, y - hh + 3); ctx.lineTo(x + hw - 3, y + hh - 3);
    ctx.moveTo(x + hw - 3, y - hh + 3); ctx.lineTo(x - hw + 3, y + hh - 3);
    ctx.stroke();
  }
}

const BOX_W = 38, BOX_H = 38;

function drawKey(key) {
  if (!key || key.collected) return;
  const { x, y } = key;
  ctx.save();
  // Brillo animado
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 20);
  glow.addColorStop(0, 'rgba(255,215,0,0.4)');
  glow.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fill();
  // Círculo de la llave
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#B8860B';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#B8860B';
  ctx.stroke();
  // Agujero
  ctx.fillStyle = '#0d0d2b';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  // Mango
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(x + 7, y - 3, 18, 6);
  ctx.fillRect(x + 18, y + 3, 5, 5);
  ctx.fillRect(x + 11, y + 3, 5, 5);
  ctx.restore();
}

function drawDoor(door, keyCollected) {
  if (!door) return;
  const { x, y } = door;
  ctx.save();
  // Marco
  ctx.fillStyle = keyCollected ? '#1a6b3a' : '#4a4a4a';
  ctx.fillRect(x - 22, y - 44, 44, 66);
  // Interior
  ctx.fillStyle = keyCollected ? '#27ae60' : '#666';
  ctx.fillRect(x - 18, y - 40, 36, 60);
  // Cerradura
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(x + 10, y - 12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + 7, y - 12, 6, 8);
  // Label
  ctx.fillStyle = 'white';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(keyCollected ? 'SALIDA' : 'SALIDA', x, y + 30);
  ctx.restore();
}

function drawPlayer(p) {
  const { x, y, color, name, atDoor } = p;
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const dk = darken(color);
  const lt = lighten(color);

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x - 12, y + 17, 30, 5);

  // Cola (detrás del cuerpo)
  ctx.fillStyle = color;
  ctx.fillRect(x + 14, y + 2,  12, 8);
  ctx.fillRect(x + 18, y - 5,  8,  9);
  ctx.strokeStyle = dk; ctx.lineWidth = 2;
  ctx.strokeRect(x + 14, y + 2, 12, 8);
  ctx.strokeRect(x + 18, y - 5, 8,  9);

  // Cuerpo principal
  ctx.fillStyle = color;
  ctx.fillRect(x - 14, y - 18, 28, 36);
  ctx.strokeStyle = dk; ctx.lineWidth = 2;
  ctx.strokeRect(x - 14, y - 18, 28, 36);

  // Orejas
  ctx.fillStyle = dk;
  ctx.fillRect(x - 13, y - 30, 10, 14);
  ctx.fillRect(x + 3,  y - 30, 10, 14);
  // Interior de orejas
  ctx.fillStyle = lt;
  ctx.fillRect(x - 11, y - 28,  6, 9);
  ctx.fillRect(x + 5,  y - 28,  6, 9);

  // Ojos (negro + brillo)
  ctx.fillStyle = '#111';
  ctx.fillRect(x - 11, y - 13, 8, 7);
  ctx.fillRect(x + 3,  y - 13, 8, 7);
  ctx.fillStyle = 'white';
  ctx.fillRect(x - 10, y - 12, 3, 3);
  ctx.fillRect(x + 4,  y - 12, 3, 3);

  // Nariz
  ctx.fillStyle = dk;
  ctx.fillRect(x - 3, y - 4, 6, 4);

  // Boca (dos líneas)
  ctx.fillRect(x - 5, y + 1, 3, 2);
  ctx.fillRect(x + 2, y + 1, 3, 2);

  // Nombre
  ctx.fillStyle = 'white';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur  = 3;
  ctx.fillText(name, x, y - 36);
  ctx.shadowBlur = 0;

  // Checkmark en la puerta
  if (atDoor) {
    ctx.fillStyle = '#2ecc71';
    ctx.font = '16px monospace';
    ctx.fillText('✓', x, y - 48);
  }

  ctx.restore();
}

function lighten(hex) {
  const r = Math.min(255, parseInt(hex.slice(1,3), 16) + 60);
  const g = Math.min(255, parseInt(hex.slice(3,5), 16) + 60);
  const b = Math.min(255, parseInt(hex.slice(5,7), 16) + 60);
  return `rgb(${r},${g},${b})`;
}

function darken(hex) {
  const r = Math.max(0, parseInt(hex.slice(1,3), 16) - 55);
  const g = Math.max(0, parseInt(hex.slice(3,5), 16) - 55);
  const b = Math.max(0, parseInt(hex.slice(5,7), 16) - 55);
  return `rgb(${r},${g},${b})`;
}

function drawHUD(state) {
  const pList = Object.values(state.players);
  const atDoor = pList.filter(p => p.atDoor).length;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(10, 10, 240, 32);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`Nivel ${state.level}  |  Jugadores: ${pList.length}/4`, 20, 31);
  if (state.key.collected) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(10, 48, 210, 28);
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`En salida: ${atDoor}/4`, 20, 67);
  }
  ctx.restore();
}

function drawLobby() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#0d0d2b';
  ctx.fillRect(0, 0, W, H);

  // Título
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PICO PARK', W / 2, 60);

  // QR centrado
  const qrSize = 220;
  const qrX = W / 2 - qrSize / 2;
  const qrY = 90;
  if (qrImage) {
    ctx.fillStyle = 'white';
    ctx.fillRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
  }
  if (serverInfo) {
    ctx.fillStyle = '#aaa';
    ctx.font = '15px monospace';
    ctx.fillText(`${serverInfo.ip}:${serverInfo.port}`, W / 2, qrY + qrSize + 26);
  }

  // Lista de jugadores
  const listY = qrY + qrSize + 55;
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#888';
  ctx.fillText('Jugadores conectados:', W / 2, listY);

  const slots = [0, 1, 2, 3];
  slots.forEach((i) => {
    const px = W / 2 - 220 + i * 115;
    const py = listY + 20;
    const p  = lobbyPlayers.find(lp => lp.index === i);
    ctx.fillStyle = p ? p.color : 'rgba(255,255,255,0.1)';
    ctx.fillRect(px, py, 90, 50);
    ctx.fillStyle = p ? 'white' : 'rgba(255,255,255,0.25)';
    ctx.font = p ? 'bold 14px monospace' : '13px monospace';
    ctx.fillText(p ? p.name : `P${i + 1}`, px + 45, py + 30);
  });

  // Botón Iniciar
  const btnW = 220, btnH = 52;
  const btnX = W / 2 - btnW / 2;
  const btnY = listY + 95;
  const canStart = lobbyPlayers.length > 0;
  ctx.fillStyle = canStart ? '#e74c3c' : '#444';
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 10);
  ctx.fill();
  ctx.fillStyle = canStart ? 'white' : '#777';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('INICIAR JUEGO', W / 2, btnY + 34);

  // Guardar zona del botón para click
  canvas._startBtn = canStart ? { x: btnX, y: btnY, w: btnW, h: btnH } : null;
}

function drawFlash() {
  if (!flashMsg || flashTimer <= 0) return;
  const W = canvas.width;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(W / 2 - 180, 55, 360, 40);
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(flashMsg, W / 2, 81);
  ctx.restore();
}

function drawWaiting() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < W; i += 60) ctx.fillRect(i, 0, 1, H);
  for (let j = 0; j < H; j += 60) ctx.fillRect(0, j, W, 1);

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(W / 2 - 280, H / 2 - 80, 560, 160);
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 - 280, H / 2 - 80, 560, 160);

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 38px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PICO PARK', W / 2, H / 2 - 20);

  ctx.fillStyle = '#aaa';
  ctx.font = '16px monospace';
  ctx.fillText(`Esperando jugadores... (${playerCount}/4)`, W / 2, H / 2 + 20);
  ctx.fillText('Escanea el QR con el gamepad para unirte', W / 2, H / 2 + 46);
}

let lastTime = 0;
function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (flashTimer > 0) flashTimer -= dt;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gamePhase === 'lobby') {
    drawLobby();
  } else {
    drawBackground();
    if (!currentState) {
      drawWaiting();
    } else {
      drawPlatforms();
      drawBoxes(currentState.boxes);
      drawDoor(currentState.door, currentState.key.collected);
      drawKey(currentState.key);
      for (const p of Object.values(currentState.players)) drawPlayer(p);
      drawHUD(currentState);
    }
    drawFlash();
  }
  requestAnimationFrame(loop);
}

canvas.addEventListener('click', (e) => {
  if (gamePhase !== 'lobby') return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left)  * (canvas.width  / rect.width);
  const y = (e.clientY - rect.top)   * (canvas.height / rect.height);
  const btn = canvas._startBtn;
  if (btn && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
    socket.emit('startGame');
  }
});

requestAnimationFrame(loop);
