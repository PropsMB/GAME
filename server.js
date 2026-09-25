const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const ARENA = { w: 2000, h: 1400 };
const POWERUP_TYPES = ['heal', 'speed', 'damage'];

const players = new Map(); // id -> {ws,name,color,x,y,angle,hp,kills}
const powerups = new Map(); // id -> {x,y,type}

function genId() { return 'p' + Math.random().toString(36).slice(2, 9); }
function rand(a, b) { return a + Math.random() * (b - a); }

function broadcast(msg, exceptId) {
  const data = JSON.stringify(msg);
  for (const [id, p] of players) {
    if (id === exceptId) continue;
    if (p.ws.readyState === 1) p.ws.send(data);
  }
}

function trySpawnPowerup() {
  if (powerups.size >= 3) return;
  if (Math.random() > 0.5) return;
  const id = genId();
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  const x = rand(80, ARENA.w - 80), y = rand(80, ARENA.h - 80);
  powerups.set(id, { x, y, type });
  broadcast({ t: 'powerup_spawn', id, x, y, type });
}
setInterval(trySpawnPowerup, 4500);

wss.on('connection', (ws) => {
  let id = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.t === 'join') {
      id = genId();
      players.set(id, {
        ws, name: String(msg.name || 'Gracz').slice(0, 14), color: msg.color || '#5eead4',
        x: msg.x || ARENA.w / 2, y: msg.y || ARENA.h / 2, angle: 0, hp: 100, kills: 0
      });
      ws.send(JSON.stringify({
        t: 'welcome', id,
        players: [...players.entries()].filter(([pid]) => pid !== id)
          .map(([pid, p]) => ({ id: pid, name: p.name, color: p.color, x: p.x, y: p.y, angle: p.angle, hp: p.hp, kills: p.kills })),
        powerups: [...powerups.entries()].map(([pid, p]) => ({ id: pid, ...p }))
      }));
      return;
    }
    if (!id || !players.has(id)) return;
    const me = players.get(id);

    if (msg.t === 'presence') {
      me.x = msg.x; me.y = msg.y; me.angle = msg.angle; me.hp = msg.hp; me.kills = msg.kills;
      broadcast({ t: 'presence', id, x: me.x, y: me.y, angle: me.angle, hp: me.hp, color: me.color, name: me.name, kills: me.kills }, id);
    } else if (msg.t === 'shoot') {
      broadcast({ t: 'shoot', id, x: msg.x, y: msg.y, a: msg.a, color: me.color, dmg: msg.dmg, name: me.name }, id);
    } else if (msg.t === 'hit') {
      broadcast({ t: 'hit', targetId: msg.targetId, byId: msg.byId }, id);
    } else if (msg.t === 'kill') {
      broadcast({ t: 'kill', killerId: msg.killerId, victimId: msg.victimId, killerName: msg.killerName, victimName: msg.victimName });
    } else if (msg.t === 'pickup') {
      if (powerups.has(msg.id)) {
        powerups.delete(msg.id);
        broadcast({ t: 'powerup_remove', id: msg.id });
      }
    }
  });

  ws.on('close', () => {
    if (id && players.has(id)) {
      players.delete(id);
      broadcast({ t: 'leave', id });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Arena Shooter server running on port ' + PORT));
