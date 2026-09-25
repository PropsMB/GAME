const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- persistent all-time leaderboard (survives restarts, resets on redeploy) ---
const LB_FILE = path.join(__dirname, 'leaderboard.json');
let leaderboard = {};
try { leaderboard = JSON.parse(fs.readFileSync(LB_FILE, 'utf8')); } catch { leaderboard = {}; }
function saveLeaderboard() { fs.writeFile(LB_FILE, JSON.stringify(leaderboard), () => {}); }
function topList() {
  return Object.entries(leaderboard).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, kills]) => ({ name, kills }));
}

const ARENA = { w: 2000, h: 1400 };
const POWERUP_TYPES = ['heal', 'speed', 'damage'];
const OBSTACLES = [
  { x: 300, y: 300, w: 170, h: 60 }, { x: 900, y: 160, w: 60, h: 220 }, { x: 1550, y: 380, w: 150, h: 150 },
  { x: 560, y: 780, w: 230, h: 60 }, { x: 1220, y: 880, w: 60, h: 230 }, { x: 1720, y: 980, w: 160, h: 110 },
  { x: 100, y: 1080, w: 150, h: 150 }, { x: 980, y: 600, w: 110, h: 110 }, { x: 1400, y: 150, w: 150, h: 60 },
  { x: 200, y: 650, w: 60, h: 180 }
];
function overlapsObstacle(x, y, pad) {
  return OBSTACLES.some(o => x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad);
}

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
  let x, y, tries = 0;
  do { x = rand(80, ARENA.w - 80); y = rand(80, ARENA.h - 80); tries++; }
  while (overlapsObstacle(x, y, 20) && tries < 20);
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
        skin: String(msg.skin || 'aqua').slice(0, 20),
        x: msg.x || ARENA.w / 2, y: msg.y || ARENA.h / 2, angle: 0, hp: 100, kills: 0
      });
      ws.send(JSON.stringify({
        t: 'welcome', id,
        players: [...players.entries()].filter(([pid]) => pid !== id)
          .map(([pid, p]) => ({ id: pid, name: p.name, color: p.color, skin: p.skin, x: p.x, y: p.y, angle: p.angle, hp: p.hp, kills: p.kills })),
        powerups: [...powerups.entries()].map(([pid, p]) => ({ id: pid, ...p })),
        leaderboard: topList()
      }));
      return;
    }
    if (!id || !players.has(id)) return;
    const me = players.get(id);

    if (msg.t === 'presence') {
      me.x = msg.x; me.y = msg.y; me.angle = msg.angle; me.hp = msg.hp; me.kills = msg.kills;
      broadcast({ t: 'presence', id, x: me.x, y: me.y, angle: me.angle, hp: me.hp, color: me.color, skin: me.skin, name: me.name, kills: me.kills }, id);
    } else if (msg.t === 'shoot') {
      broadcast({ t: 'shoot', id, x: msg.x, y: msg.y, a: msg.a, color: me.color, dmg: msg.dmg, name: me.name }, id);
    } else if (msg.t === 'hit') {
      broadcast({ t: 'hit', targetId: msg.targetId, byId: msg.byId }, id);
    } else if (msg.t === 'kill') {
      broadcast({ t: 'kill', killerId: msg.killerId, victimId: msg.victimId, killerName: msg.killerName, victimName: msg.victimName });
      if (msg.killerName) {
        leaderboard[msg.killerName] = (leaderboard[msg.killerName] || 0) + 1;
        saveLeaderboard();
        broadcast({ t: 'leaderboard', list: topList() });
      }
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
