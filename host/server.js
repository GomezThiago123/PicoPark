const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Matter = require('matter-js');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');

const { Engine, World, Bodies, Body } = Matter;

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

const PORT = 3000;

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

const LOCAL_IP = getLocalIP();

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
const NAMES  = ['Rojo', 'Azul', 'Verde', 'Amarillo'];
const PW = 32, PH = 40;
const SPEED = 3.5;
const JUMP_FORCE = -0.013;

const LEVELS = {
  1: {
    width: 1200, height: 600,
    platforms: [
      { x: 600, y: 580, w: 1200, h: 40 },
      { x: 200, y: 460, w: 160,  h: 20 },
      { x: 500, y: 360, w: 160,  h: 20 },
      { x: 850, y: 300, w: 160,  h: 20 },
    ],
    keyPos:  { x: 850, y: 255 },
    doorPos: { x: 1130, y: 536 },
    spawns:  [{ x: 80, y: 525 }, { x: 135, y: 525 }, { x: 190, y: 525 }, { x: 245, y: 525 }],
  },
  2: {
    width: 1200, height: 600,
    platforms: [
      { x: 600, y: 580, w: 1200, h: 40 },
      { x: 150, y: 480, w: 140,  h: 20 },
      { x: 430, y: 380, w: 140,  h: 20 },
      { x: 600, y: 200, w: 160,  h: 20 },  // plataforma alta — requiere apilarse
      { x: 1000, y: 400, w: 160, h: 20 },
    ],
    keyPos:  { x: 600, y: 150 },
    doorPos: { x: 1080, y: 358 },
    spawns:  [{ x: 80, y: 525 }, { x: 135, y: 525 }, { x: 190, y: 525 }, { x: 245, y: 525 }],
  },
};

// Estado global
let engine = null;
let world  = null;
const players    = {};  // socketId -> { body, color, name, index, inputs, atDoor }
let playerSlots  = 0;
let keyState     = { x: 0, y: 0, collected: false, holder: null };
let doorPos      = { x: 0, y: 0 };
let currentLevel = 1;
let gameStatus   = 'waiting'; // 'waiting' | 'playing' | 'complete'

// ─── Física ────────────────────────────────────────────────────────────────

function initLevel(num) {
  if (engine) { World.clear(world); Engine.clear(engine); }
  engine = Engine.create({ gravity: { y: 1.5 } });
  world  = engine.world;

  const lvl = LEVELS[num];
  World.add(world, lvl.platforms.map(p =>
    Bodies.rectangle(p.x, p.y, p.w, p.h, { isStatic: true, friction: 0.5, restitution: 0 })
  ));

  keyState  = { x: lvl.keyPos.x, y: lvl.keyPos.y, collected: false, holder: null };
  doorPos   = { x: lvl.doorPos.x, y: lvl.doorPos.y };
  gameStatus = 'playing';

  // Recrear cuerpos de jugadores existentes en el nuevo nivel
  let i = 0;
  for (const id in players) {
    const spawn = lvl.spawns[i] || lvl.spawns[0];
    players[id].body = makeBody(id, spawn);
    players[id].atDoor = false;
    players[id].inputs = { left: false, right: false, jump: false };
    World.add(world, players[id].body);
    i++;
  }
}

function makeBody(socketId, spawn) {
  return Bodies.rectangle(spawn.x, spawn.y, PW, PH, {
    label: `player_${socketId}`,
    friction: 0.3,
    frictionAir: 0.015,
    restitution: 0,
    inertia: Infinity,
    inverseInertia: 0,
  });
}

function addPlayer(socketId) {
  const index = playerSlots % 4;
  playerSlots++;
  const spawn = LEVELS[currentLevel].spawns[index];
  const body  = makeBody(socketId, spawn);
  World.add(world, body);
  players[socketId] = {
    body, index,
    color:  COLORS[index],
    name:   NAMES[index],
    inputs: { left: false, right: false, jump: false },
    atDoor: false,
  };
  return players[socketId];
}

function isOnGround(body) {
  const footY    = body.position.y + PH / 2;
  const footX    = body.position.x;
  const threshold = 4 + Math.abs(body.velocity.y);

  for (const b of world.bodies) {
    if (b === body) continue;
    if (b.isStatic) {
      const { min, max } = b.bounds;
      if (footX > min.x - 2 && footX < max.x + 2 &&
          footY >= min.y - threshold && footY <= min.y + threshold) return true;
    } else {
      // Pararse encima de otro jugador (Nivel 2)
      const otherTop  = b.position.y - PH / 2;
      const otherLeft = b.position.x - PW / 2;
      const otherRight = b.position.x + PW / 2;
      if (footX > otherLeft && footX < otherRight && Math.abs(footY - otherTop) < threshold) return true;
    }
  }
  return false;
}

// ─── Game Loop (30 FPS) ────────────────────────────────────────────────────

function tick() {
  if (gameStatus !== 'playing') return;

  for (const id in players) {
    const p = players[id];
    const { body, inputs } = p;
    const onGround = isOnGround(body);

    let vx = body.velocity.x;
    if (inputs.left)       vx = -SPEED;
    else if (inputs.right) vx =  SPEED;
    else                   vx *= 0.75;
    vx = Math.max(-SPEED, Math.min(SPEED, vx));

    Body.setVelocity(body, { x: vx, y: body.velocity.y });

    if (inputs.jump && onGround) {
      Body.applyForce(body, body.position, { x: 0, y: JUMP_FORCE * body.mass });
      inputs.jump = false;
    }

    // Recoger llave
    if (!keyState.collected) {
      const dx = body.position.x - keyState.x;
      const dy = body.position.y - keyState.y;
      if (dx * dx + dy * dy < 900) {
        keyState.collected = true;
        keyState.holder    = id;
        io.emit('keyCollected', { playerName: p.name });
      }
    }

    // Llave sigue al portador
    if (keyState.holder === id) {
      keyState.x = body.position.x;
      keyState.y = body.position.y - PH / 2 - 10;
    }

    // Verificar puerta
    if (keyState.collected) {
      const dx = body.position.x - doorPos.x;
      const dy = body.position.y - doorPos.y;
      p.atDoor = (dx * dx + dy * dy) < 1600;
    } else {
      p.atDoor = false;
    }
  }

  Engine.update(engine, 1000 / 30);

  // Verificar victoria: los 4 jugadores en la puerta con la llave
  const pList = Object.values(players);
  if (pList.length === 4 && keyState.collected && pList.every(p => p.atDoor)) {
    gameStatus = 'complete';
    io.emit('levelComplete', { level: currentLevel });
    return;
  }

  // Serializar y transmitir estado
  const state = {
    status: gameStatus,
    level:  currentLevel,
    key:    { x: keyState.x, y: keyState.y, collected: keyState.collected },
    door:   doorPos,
    players: {},
  };
  for (const id in players) {
    const p = players[id];
    state.players[id] = {
      x: p.body.position.x,
      y: p.body.position.y,
      color: p.color,
      name:  p.name,
      index: p.index,
      atDoor: p.atDoor,
    };
  }
  io.emit('gameState', state);
}

setInterval(tick, 1000 / 30);

// ─── WebSocket ─────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('+ Conexión:', socket.id);

  socket.on('joinAsHost', () => {
    socket.emit('serverInfo', { ip: LOCAL_IP, port: PORT });
    socket.emit('levelData', LEVELS[currentLevel]);
    socket.emit('playerCount', { count: Object.keys(players).length });
  });

  socket.on('joinAsPlayer', () => {
    if (Object.keys(players).length >= 4) {
      socket.emit('gameFull');
      return;
    }
    if (Object.keys(players).length === 0) initLevel(currentLevel);
    const p = addPlayer(socket.id);
    socket.emit('playerAssigned', { id: socket.id, color: p.color, name: p.name, index: p.index });
    io.emit('playerJoined', { id: socket.id, color: p.color, name: p.name, count: Object.keys(players).length });
    console.log(`  ${p.name} unido (${Object.keys(players).length}/4)`);
  });

  socket.on('input', ({ key, pressed }) => {
    const p = players[socket.id];
    if (!p) return;
    if (key === 'left')       p.inputs.left  = pressed;
    else if (key === 'right') p.inputs.right = pressed;
    else if (key === 'jump' && pressed) {
      p.inputs.jump = true;
      setTimeout(() => { if (p.inputs.jump) p.inputs.jump = false; }, 200);
    }
  });

  socket.on('nextLevel', () => {
    if (gameStatus !== 'complete') return;
    if (currentLevel >= Object.keys(LEVELS).length) {
      io.emit('gameOver');
      return;
    }
    currentLevel++;
    initLevel(currentLevel);
    io.emit('levelData', LEVELS[currentLevel]);
    io.emit('levelStart', { level: currentLevel });
    console.log(`Nivel ${currentLevel} iniciado`);
  });

  socket.on('disconnect', () => {
    console.log('- Desconexión:', socket.id);
    if (players[socket.id]) {
      if (world) World.remove(world, players[socket.id].body);
      delete players[socket.id];
      io.emit('playerLeft', { id: socket.id, count: Object.keys(players).length });
    }
  });
});

// ─── Endpoint QR ──────────────────────────────────────────────────────────

app.get('/qr', async (req, res) => {
  try {
    const addr = `${LOCAL_IP}:${PORT}`;
    const qr   = await QRCode.toDataURL(addr);
    res.json({ qr, ip: LOCAL_IP, port: PORT, addr });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Inicio ────────────────────────────────────────────────────────────────

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\nPicoPark corriendo:`);
  console.log(`  Local: http://localhost:${PORT}`);
  console.log(`  LAN:   http://${LOCAL_IP}:${PORT}`);
  console.log(`  Gamepad conectar a: ${LOCAL_IP}:${PORT}\n`);
});
