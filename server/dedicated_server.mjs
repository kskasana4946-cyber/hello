#!/usr/bin/env node
// server/dedicated_server.mjs
// Apex Grand Prix: Uncapped Next-Gen Edition - High-Performance 24/7 Dedicated Server
// Pure Node.js zero-dependency HTTP + WebSocket RFC 6455 Server

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.PORT || '8080', 10);
const TICK_RATE_HZ = 60;
const TICK_INTERVAL_MS = Math.floor(1000 / TICK_RATE_HZ);

console.log('🏁=================================================================🏁');
console.log('   APEX GRAND PRIX: NEXT-GEN EDITION - 24/7 DEDICATED MULTIPLAYER');
console.log('🏁=================================================================🏁');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.pak': 'application/octet-stream',
};

// ============================================================================
// 1. MINIMAL NATIVE WEBSOCKET IMPLEMENTATION (RFC 6455 ZERO DEPENDENCY)
// ============================================================================

class NativeWebSocketConnection {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.isAlive = true;
    this.onMessage = null;
    this.onClose = null;

    socket.on('data', (chunk) => this.handleData(chunk));
    socket.on('close', () => {
      this.isAlive = false;
      if (this.onClose) this.onClose();
    });
    socket.on('error', () => {
      this.isAlive = false;
      socket.destroy();
    });
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const firstByte = this.buffer[0];
      const secondByte = this.buffer[1];
      const opcode = firstByte & 0x0f;
      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLength = secondByte & 0x7f;
      let offset = 2;

      if (payloadLength === 126) {
        if (this.buffer.length < 4) return;
        payloadLength = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLength === 127) {
        if (this.buffer.length < 10) return;
        payloadLength = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }

      let maskKey = null;
      if (isMasked) {
        if (this.buffer.length < offset + 4) return;
        maskKey = this.buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      if (this.buffer.length < offset + payloadLength) return;

      const payload = this.buffer.subarray(offset, offset + payloadLength);
      this.buffer = this.buffer.subarray(offset + payloadLength);

      if (maskKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i % 4];
        }
      }

      if (opcode === 0x08) {
        // Close frame
        this.socket.end();
        return;
      } else if (opcode === 0x09) {
        // Ping -> send Pong
        this.sendRaw(payload, 0x0a);
      } else if (opcode === 0x01 || opcode === 0x02) {
        // Text or binary frame
        const msgStr = payload.toString('utf-8');
        if (this.onMessage) this.onMessage(msgStr);
      }
    }
  }

  send(data) {
    if (!this.isAlive || this.socket.destroyed) return;
    const payload = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
    this.sendRaw(payload, 0x01);
  }

  sendRaw(payload, opcode) {
    const len = payload.length;
    let header;
    if (len <= 125) {
      header = Buffer.from([0x80 | opcode, len]);
    } else if (len <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    try {
      this.socket.write(Buffer.concat([header, payload]));
    } catch {}
  }
}

// ============================================================================
// 2. MULTIPLAYER ROOM & MATCHMAKING MANAGER
// ============================================================================

class PlayerSession {
  constructor(id, ws, name = 'Racer') {
    this.id = id;
    this.ws = ws;
    this.name = name;
    this.roomId = null;
    this.carId = 'mini_jcw';
    this.liveryIndex = 0;
    this.ready = false;
    this.pingMs = 0;
    this.state = {
      x: 0,
      y: 0,
      z: 0,
      rotY: 0,
      speedKph: 0,
      steer: 0,
      throttle: 0,
      brake: 0,
      nitro: false,
      lap: 0,
      sector: 0,
      timestamp: Date.now(),
    };
  }
}

class RaceRoom {
  constructor(id, name, trackId = 'track_golden_gp', maxPlayers = 8) {
    this.id = id;
    this.name = name;
    this.trackId = trackId;
    this.maxPlayers = maxPlayers;
    this.players = new Map();
    this.status = 'LOBBY'; // 'LOBBY' | 'STARTING' | 'RACING' | 'FINISHED'
    this.countdown = 0;
    this.raceStartTime = 0;
  }

  broadcast(message, excludePlayerId = null) {
    const raw = typeof message === 'string' ? message : JSON.stringify(message);
    for (const player of this.players.values()) {
      if (player.id !== excludePlayerId) {
        player.ws.send(raw);
      }
    }
  }

  addPlayer(player) {
    if (this.players.size >= this.maxPlayers) return false;
    this.players.set(player.id, player);
    player.roomId = this.id;
    return true;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  getSnapshot() {
    const playersList = [];
    for (const p of this.players.values()) {
      playersList.push({
        id: p.id,
        name: p.name,
        carId: p.carId,
        liveryIndex: p.liveryIndex,
        ready: p.ready,
        pingMs: p.pingMs,
        state: p.state,
      });
    }
    return {
      roomId: this.id,
      name: this.name,
      trackId: this.trackId,
      status: this.status,
      playerCount: this.players.size,
      maxPlayers: this.maxPlayers,
      countdown: this.countdown,
      players: playersList,
    };
  }
}

const rooms = new Map();
const players = new Map();
let nextPlayerSeq = 1;

// Default initial room
const defaultRoom = new RaceRoom('apex-public-1', 'Apex Grand Prix Global Sprint', 'track_golden_gp', 8);
rooms.set(defaultRoom.id, defaultRoom);

// Authoritative 60Hz Server Tick Loop
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.status === 'RACING') {
      // Broadcast state synchronization packet
      const packet = {
        type: 'SYNC',
        roomId: room.id,
        tick: Date.now(),
        racers: Array.from(room.players.values()).map((p) => ({
          id: p.id,
          state: p.state,
        })),
      };
      room.broadcast(packet);
    }
  }
}, TICK_INTERVAL_MS);

// ============================================================================
// 3. HTTP SERVER & ASSET DELIVERY
// ============================================================================

const server = http.createServer((req, res) => {
  // Security headers & WebAssembly Cross-Origin Isolation
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API endpoints for room stats
  if (req.url === '/api/rooms') {
    const list = Array.from(rooms.values()).map((r) => r.getSnapshot());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ rooms: list, totalPlayers: players.size }));
    return;
  }

  let reqPath = req.url.split('?')[0].replace(/^\/+/, '');
  if (!reqPath) reqPath = 'index.html';

  let filePath = path.join(ROOT_DIR, 'dist', reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT_DIR, reqPath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const stat = fs.statSync(filePath);
    const totalSize = stat.size;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);

    const range = req.headers.range;
    if (range && range.startsWith('bytes=')) {
      const parts = range.substring(6).split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const clampedEnd = Math.min(end, totalSize - 1);
      const chunkSize = clampedEnd - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${clampedEnd}/${totalSize}`,
        'Content-Length': chunkSize,
      });
      fs.createReadStream(filePath, { start, end: clampedEnd }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': totalSize });
      fs.createReadStream(filePath).pipe(res);
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

// ============================================================================
// 4. WEBSOCKET UPGRADE HANDLER
// ============================================================================

server.on('upgrade', (req, socket, head) => {
  if (req.headers['upgrade']?.toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  // Compute WebSocket accept hash
  const sha1 = crypto.createHash('sha1');
  sha1.update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
  const acceptKey = sha1.digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
    '\r\n'
  );

  const ws = new NativeWebSocketConnection(socket);
  const playerId = `racer_${nextPlayerSeq++}_${Math.random().toString(36).substring(2, 6)}`;
  const player = new PlayerSession(playerId, ws);
  players.set(playerId, player);

  // Send Welcome Packet
  ws.send({
    type: 'CONNECTED',
    playerId: player.id,
    serverTickRate: TICK_RATE_HZ,
  });

  ws.onMessage = (raw) => {
    try {
      const msg = JSON.parse(raw);
      handleClientMessage(player, msg);
    } catch {}
  };

  ws.onClose = () => {
    if (player.roomId) {
      const room = rooms.get(player.roomId);
      if (room) {
        room.removePlayer(player.id);
        room.broadcast({
          type: 'PLAYER_LEFT',
          playerId: player.id,
          room: room.getSnapshot(),
        });
      }
    }
    players.delete(player.id);
  };
});

function handleClientMessage(player, msg) {
  switch (msg.type) {
    case 'PING': {
      player.ws.send({ type: 'PONG', clientTime: msg.clientTime, serverTime: Date.now() });
      break;
    }

    case 'LIST_ROOMS': {
      const list = Array.from(rooms.values()).map((r) => r.getSnapshot());
      player.ws.send({ type: 'ROOMS_LIST', rooms: list });
      break;
    }

    case 'CREATE_ROOM': {
      const roomId = `room_${Date.now().toString(36)}`;
      const room = new RaceRoom(roomId, msg.name || 'Custom GP', msg.trackId || 'track_golden_gp', msg.maxPlayers || 8);
      rooms.set(roomId, room);
      room.addPlayer(player);
      player.ws.send({ type: 'ROOM_JOINED', room: room.getSnapshot() });
      break;
    }

    case 'JOIN_ROOM': {
      const room = rooms.get(msg.roomId) || defaultRoom;
      if (room.addPlayer(player)) {
        player.carId = msg.carId || player.carId;
        player.liveryIndex = msg.liveryIndex ?? player.liveryIndex;
        player.ws.send({ type: 'ROOM_JOINED', room: room.getSnapshot() });
        room.broadcast({ type: 'PLAYER_JOINED', player: { id: player.id, name: player.name }, room: room.getSnapshot() }, player.id);
      } else {
        player.ws.send({ type: 'ERROR', message: 'Room is full' });
      }
      break;
    }

    case 'SET_READY': {
      player.ready = Boolean(msg.ready);
      player.carId = msg.carId || player.carId;
      player.liveryIndex = msg.liveryIndex ?? player.liveryIndex;
      if (player.roomId) {
        const room = rooms.get(player.roomId);
        if (room) {
          room.broadcast({ type: 'ROOM_UPDATE', room: room.getSnapshot() });
          
          // Check if all players ready
          const allReady = Array.from(room.players.values()).every((p) => p.ready);
          if (allReady && room.players.size >= 1 && room.status === 'LOBBY') {
            room.status = 'STARTING';
            room.countdown = 3;
            room.broadcast({ type: 'COUNTDOWN', countdown: room.countdown });
            const countdownInterval = setInterval(() => {
              room.countdown--;
              if (room.countdown <= 0) {
                clearInterval(countdownInterval);
                room.status = 'RACING';
                room.raceStartTime = Date.now();
                room.broadcast({ type: 'RACE_START', startTime: room.raceStartTime });
              } else {
                room.broadcast({ type: 'COUNTDOWN', countdown: room.countdown });
              }
            }, 1000);
          }
        }
      }
      break;
    }

    case 'UPDATE_STATE': {
      if (!msg.state) return;
      // Anti-cheat validation: clamp extreme impossible velocities (> 500 KPH)
      const speed = Math.abs(msg.state.speedKph || 0);
      if (speed > 520) {
        msg.state.speedKph = 500;
      }
      player.state = {
        x: msg.state.x || 0,
        y: msg.state.y || 0,
        z: msg.state.z || 0,
        rotY: msg.state.rotY || 0,
        speedKph: msg.state.speedKph || 0,
        steer: msg.state.steer || 0,
        throttle: msg.state.throttle || 0,
        brake: msg.state.brake || 0,
        nitro: Boolean(msg.state.nitro),
        lap: msg.state.lap || 0,
        sector: msg.state.sector || 0,
        timestamp: Date.now(),
      };
      break;
    }
  }
}

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Dedicated Server is ONLINE and LISTENING on:`);
  console.log(`   - Local Access:     http://localhost:${PORT}`);
  console.log(`   - Network Access:   http://0.0.0.0:${PORT}`);
  console.log(`   - WebSocket Engine: ws://0.0.0.0:${PORT}\n`);
  console.log(`Ready for 24/7 continuous multiplayer sessions.\n`);
});
