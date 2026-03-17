try {
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d');

const ui = {
  healthFill: document.getElementById('healthFill'),
  healthText: document.getElementById('healthText'),
  armor: document.getElementById('armor'),
  points: document.getElementById('points'),
  pickupHint: document.getElementById('pickupHint'),
  weapon: document.getElementById('weapon'),
  ammo: document.getElementById('ammo'),
  threat: document.getElementById('threat'),
  district: document.getElementById('district'),
  car: document.getElementById('car'),
  mission: document.getElementById('mission'),
  shop: document.getElementById('shopPanel'),
  missionPanel: document.getElementById('missionPanel'),
};

let minimapLarge = false;
function toggleMinimapSize() {
  minimapLarge = !minimapLarge;
  if (minimapLarge) {
    minimap.classList.add('minimap-large');
    minimap.classList.remove('minimap-small');
  } else {
    minimap.classList.add('minimap-small');
    minimap.classList.remove('minimap-large');
  }
}


const world = { w: 4200, h: 2600 };
const camera = { x: 0, y: 0 };
const keys = new Set();
const mouse = { x: 0, y: 0, down: false };

const districtZones = [
  { name: 'University Core', x: 0, y: 0, w: 1400, h: 1100, color: '#2f5131' },
  { name: 'Downtown Hayes', x: 1400, y: 0, w: 1400, h: 1100, color: '#57432f' },
  { name: 'Residential Grid', x: 0, y: 1100, w: 1400, h: 1500, color: '#32455a' },
  { name: 'Industrial Edge', x: 1400, y: 1100, w: 1400, h: 1500, color: '#4f3759' },
  { name: 'Highway & Outskirts', x: 2800, y: 0, w: 1400, h: 2600, color: '#4e2e34' },
];

const roads = [
  { x: 0, y: 520, w: world.w, h: 120 },
  { x: 1180, y: 0, w: 120, h: world.h },
  { x: 2580, y: 0, w: 120, h: world.h },
  { x: 0, y: 1600, w: world.w, h: 130 },
];

const safehouse = { x: 430, y: 340, w: 220, h: 140 };
const missionBoard = { x: 690, y: 330, w: 120, h: 90 };

const player = {
  x: 540, y: 450, angle: 0, r: 14, speed: 210,
  health: 100, armor: 0, points: 180,
  inCar: false, weapon: 'Pistol', pistolMul: 1,
  unlocked: new Set(['Pistol']),
  ammo: { Pistol: 45, SMG: 0, Rifle: 0 },
  hasZaaadrink: false,
};

const cars = [
  { name: 'Charger Inspired', x: 760, y: 560, w: 86, h: 42, color: '#2d75c3', hp: 140, maxHp: 140, speedMul: 1, vx: 0, vy: 0 },
  { name: 'Challenger Inspired', x: 2100, y: 860, w: 84, h: 40, color: '#8a2ad3', hp: 130, maxHp: 130, speedMul: 1, vx: 0, vy: 0 },
];
let activeCar = null;

const pickups = [];
const bullets = [];
const zombies = [];
const survivors = [];

const weaponRacks = [
  { x: 1250, y: 540, gun: 'SMG', cost: 900 },
  { x: 2420, y: 620, gun: 'Rifle', cost: 1200 },
];

for (let i = 0; i < 32; i++) {
  pickups.push({
    x: 150 + Math.random() * (world.w - 300),
    y: 150 + Math.random() * (world.h - 300),
    type: Math.random() < 0.4 ? 'cash' : 'gun',
    gun: Math.random() < 0.52 ? 'SMG' : 'Rifle',
    alive: true,
  });
}

const weaponStats = {
  Pistol: { dmg: 22, rpm: 280, spread: 0.03, color: '#ffd166', mag: 15, reload: 1.0 },
  SMG: { dmg: 14, rpm: 720, spread: 0.08, color: '#9cff57', mag: 36, reload: 1.2 },
  Rifle: { dmg: 34, rpm: 430, spread: 0.018, color: '#7bd6ff', mag: 24, reload: 1.4 },
};

let threat = 1;
let threatTimer = 0;
let shotCooldown = 0;
let reloadTimer = 0;
let mag = { Pistol: 15, SMG: 0, Rifle: 0 };
let mission = { type: null, stage: 0, objective: null, reward: 0, progress: 0, total: 0 };

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function zoneName(x, y) {
  const z = districtZones.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
  return z ? z.name : 'Unknown';
}
function randRange(min, max) { return min + Math.random() * (max - min); }

function worldToScreen(x, y) { return { x: x - camera.x, y: y - camera.y }; }

function spawnZombie(near = null) {
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  if (near) {
    x = clamp(near.x + randRange(-360, 360), 40, world.w - 40);
    y = clamp(near.y + randRange(-360, 360), 40, world.h - 40);
  } else {
    x = edge % 2 ? randRange(0, world.w) : (edge === 0 ? 30 : world.w - 30);
    y = edge % 2 ? (edge === 1 ? 30 : world.h - 30) : randRange(0, world.h);
  }
  const r = Math.random();
  const type = r < 0.62 ? 'Rusher' : (r < 0.88 ? 'Bruiser' : 'Shrieker');
  zombies.push({
    x, y, type,
    hp: type === 'Bruiser' ? 90 : type === 'Shrieker' ? 50 : 35,
    r: type === 'Bruiser' ? 20 : 14,
    speed: type === 'Bruiser' ? 65 : type === 'Shrieker' ? 90 : 110,
    color: type === 'Bruiser' ? '#9d3f3f' : (type === 'Shrieker' ? '#d7bb3c' : '#7aaf52'),
  });
}

function openMission(type) {
  if (mission.type) return;
  if (type === 'rescue') {
    mission = { type, stage: 1, objective: { x: 1750, y: 1400 }, reward: 260, progress: 0, total: 3 };
    survivors.length = 0;
    for (let i = 0; i < mission.total; i++) survivors.push({ x: mission.objective.x + randRange(-70, 70), y: mission.objective.y + randRange(-70, 70), rescued: false });
  }
  if (type === 'heist') {
    mission = { type, stage: 1, objective: { x: 2360, y: 360 }, reward: 340, progress: 0, total: 4 };
  }
  if (type === 'horde') {
    mission = { type, stage: 1, objective: { x: 1770, y: 560 }, reward: 420, progress: 0, total: 18 };
    for (let i = 0; i < 15; i++) spawnZombie(mission.objective);
  }
}

function completeMission() {
  player.points += mission.reward;
  threat = clamp(threat - 1, 1, 5);
  mission = { type: null, stage: 0, objective: null, reward: 0, progress: 0, total: 0 };
}

function toggleCar() {
  if (player.inCar) {
    player.inCar = false;
    player.x = activeCar.x + activeCar.w + 10;
    player.y = activeCar.y + activeCar.h * 0.5;
    return;
  }
  const near = cars.find(c => dist(player.x, player.y, c.x + c.w/2, c.y + c.h/2) < 70);
  if (near && near.hp > 0) { activeCar = near; player.inCar = true; }
}

function tryReload() {
  const w = player.weapon;
  if (w === 'Pistol') return;
  if (reloadTimer > 0) return;
  const reserve = player.ammo[w];
  const need = weaponStats[w].mag - mag[w];
  if (reserve <= 0 || need <= 0) return;
  reloadTimer = weaponStats[w].reload;
}

function buyUpgrade(id) {
  const costs = { armor: 120, zaaadrink: 1500, pistol: 140, smg: 220, rifle: 320, medkit: 90, carArmor: 260, carSpeed: 240 };
  if (player.points < costs[id]) return;
  if (id === 'zaaadrink' && player.hasZaaadrink) return;
  player.points -= costs[id];

  if (id === 'armor') player.armor = clamp(player.armor + 25, 0, 100);
  if (id === 'zaaadrink') player.armor = 100;
  if (id === 'zaaadrink') {
    if (!player.hasZaaadrink) {
      player.hasZaaadrink = true;
      player.armor = 100;
    }
  }
  if (id === 'pistol') player.pistolMul += 0.2;
  if (id === 'smg') { player.unlocked.add('SMG'); player.ammo.SMG += 180; mag.SMG = Math.max(mag.SMG, 36); }
  if (id === 'rifle') { player.unlocked.add('Rifle'); player.ammo.Rifle += 90; mag.Rifle = Math.max(mag.Rifle, 24); }
  if (id === 'carArmor') cars.forEach(c => { c.maxHp += 35; c.hp += 35; });
  if (id === 'carSpeed') cars.forEach(c => c.speedMul += 0.2);
}

function interact() {
  const inSafehouse = player.x > safehouse.x && player.x < safehouse.x + safehouse.w && player.y > safehouse.y && player.y < safehouse.y + safehouse.h;
  const atMissionBoard = dist(player.x, player.y, missionBoard.x + 45, missionBoard.y + 35) < 90;
  const rack = weaponRacks.find(r => dist(player.x, player.y, r.x, r.y) < 70);

  if (rack) {
    if (player.unlocked.has(rack.gun)) {
      ui.pickupHint.textContent = `You already have ${rack.gun}.`;
    } else if (player.points >= rack.cost) {
      player.points -= rack.cost;
      player.unlocked.add(rack.gun);
      player.ammo[rack.gun] += weaponStats[rack.gun].mag * 2;
      ui.pickupHint.textContent = `Purchased ${rack.gun}!`;
    } else {
      ui.pickupHint.textContent = `Need ${rack.cost} pts to buy ${rack.gun}.`;
    }
    return;
  }

  if (inSafehouse) ui.shop.classList.toggle('hidden');
  if (atMissionBoard) ui.missionPanel.classList.toggle('hidden');
}

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'e') toggleCar();
  if (k === 'f') interact();
  if (k === 'r') tryReload();
  if (k === 'm') toggleMinimapSize();

  if (e.key === '1') player.weapon = 'Pistol';
  if (e.key === '2' && player.unlocked.has('SMG')) player.weapon = 'SMG';
  if (e.key === '3' && player.unlocked.has('Rifle')) player.weapon = 'Rifle';
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
});
canvas.addEventListener('mousedown', () => mouse.down = true);
window.addEventListener('mouseup', () => mouse.down = false);

ui.shop.addEventListener('click', e => {
  if (e.target.tagName === 'BUTTON') buyUpgrade(e.target.dataset.buy);
});
ui.missionPanel.addEventListener('click', e => {
  if (e.target.tagName === 'BUTTON') {
    openMission(e.target.dataset.mission);
    ui.missionPanel.classList.add('hidden');
  }
});

function shoot() {
  const wname = player.weapon;
  const w = weaponStats[wname];
  if (shotCooldown > 0 || reloadTimer > 0) return;

  if (wname !== 'Pistol') {
    if (mag[wname] <= 0) return;
    mag[wname] -= 1;
  }

  const spread = (Math.random() - 0.5) * w.spread;
  const a = player.angle + spread;
  bullets.push({
    x: player.x, y: player.y,
    vx: Math.cos(a) * 720,
    vy: Math.sin(a) * 720,
    life: 1.0,
    dmg: w.dmg * (wname === 'Pistol' ? player.pistolMul : 1),
    color: w.color,
  });

  shotCooldown = 60 / w.rpm;
  threat = clamp(threat + 1, 1, 5);
  threatTimer = 0;
}

function updateMission() {
  if (!mission.type) return;

  if (mission.type === 'rescue') {
    for (const s of survivors) {
      if (!s.rescued && dist(player.x, player.y, s.x, s.y) < 38) {
        s.rescued = true;
        mission.progress += 1;
      }
    }
    if (mission.progress >= mission.total) mission.stage = 2;
    if (mission.stage === 2 && player.x > safehouse.x && player.x < safehouse.x + safehouse.w && player.y > safehouse.y && player.y < safehouse.y + safehouse.h) {
      completeMission();
    }
  }

  if (mission.type === 'heist') {
    if (dist(player.x, player.y, mission.objective.x, mission.objective.y) < 80 && mission.stage === 1) {
      mission.progress = mission.total;
      mission.stage = 2;
      threat = 5;
      for (let i = 0; i < 18; i++) spawnZombie(mission.objective);
    }
    if (mission.stage === 2 && player.x > safehouse.x && player.x < safehouse.x + safehouse.w && player.y > safehouse.y && player.y < safehouse.y + safehouse.h) completeMission();
  }

  if (mission.type === 'horde') {
    if (mission.stage === 1) {
      const local = zombies.filter(z => dist(z.x, z.y, mission.objective.x, mission.objective.y) < 450).length;
      mission.progress = mission.total - Math.min(mission.total, local);
      if (local <= 2) completeMission();
    }
  }
}

function update(dt) {
  shotCooldown -= dt;
  threatTimer += dt;
  if (threatTimer > 6.5) { threat = clamp(threat - 1, 1, 5); threatTimer = 0; }

  if (reloadTimer > 0) {
    reloadTimer -= dt;
    if (reloadTimer <= 0) {
      const w = player.weapon;
      const maxMag = weaponStats[w].mag;
      const need = maxMag - mag[w];
      const take = Math.min(need, player.ammo[w]);
      mag[w] += take;
      player.ammo[w] -= take;
    }
  }

  if (!player.inCar) {
    const sprint = keys.has('shift') ? 1.35 : 1;
    let dx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    let dy = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    const m = Math.hypot(dx, dy) || 1;
    player.x += (dx / m) * player.speed * sprint * dt;
    player.y += (dy / m) * player.speed * sprint * dt;
  } else if (activeCar) {
    const accel = keys.has('shift') ? 540 : 420;
    let ix = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    let iy = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    const m = Math.hypot(ix, iy) || 1;
    activeCar.vx += (ix / m) * accel * dt;
    activeCar.vy += (iy / m) * accel * dt;
    const top = 360 * activeCar.speedMul;
    const vel = Math.hypot(activeCar.vx, activeCar.vy);
    if (vel > top) {
      activeCar.vx = (activeCar.vx / vel) * top;
      activeCar.vy = (activeCar.vy / vel) * top;
    }
    activeCar.vx *= 0.96;
    activeCar.vy *= 0.96;
    activeCar.x += activeCar.vx * dt;
    activeCar.y += activeCar.vy * dt;
    activeCar.x = clamp(activeCar.x, 0, world.w - activeCar.w);
    activeCar.y = clamp(activeCar.y, 0, world.h - activeCar.h);
    player.x = activeCar.x + activeCar.w / 2;
    player.y = activeCar.y + activeCar.h / 2;
  }

  player.x = clamp(player.x, 0, world.w);
  player.y = clamp(player.y, 0, world.h);

  player.angle = Math.atan2(camera.y + mouse.y - player.y, camera.x + mouse.x - player.x);
  if (mouse.down && !player.inCar) shoot();

  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].life <= 0) bullets.splice(i, 1);

  for (const p of pickups) {
    if (!p.alive) continue;
    if (dist(player.x, player.y, p.x, p.y) < 28) {
      p.alive = false;
      if (p.type === 'gun') {
        player.unlocked.add(p.gun);
        if (p.gun === 'SMG') player.ammo.SMG += 60;
        if (p.gun === 'Rifle') player.ammo.Rifle += 24;
      } else player.points += 30;
    }
  }

  const minZ = 10 + threat * 7;
  while (zombies.length < minZ) spawnZombie();
  if (Math.random() < 0.02 * threat) spawnZombie(player);

  for (let zi = zombies.length - 1; zi >= 0; zi--) {
    const z = zombies[zi];
    const a = Math.atan2(player.y - z.y, player.x - z.x);
    z.x += Math.cos(a) * z.speed * dt;
    z.y += Math.sin(a) * z.speed * dt;

    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (dist(z.x, z.y, b.x, b.y) < z.r + 2) {
        z.hp -= b.dmg;
        bullets.splice(bi, 1);
        if (z.hp <= 0) {
          player.points += 50;
          zombies.splice(zi, 1);
          break;
        }
      }
    }
  }

  let nearHits = 0;
  for (const z of zombies) {
    if (player.inCar && activeCar) {
      const cx = activeCar.x + activeCar.w / 2;
      const cy = activeCar.y + activeCar.h / 2;
      if (dist(cx, cy, z.x, z.y) < Math.max(activeCar.w, activeCar.h) * 0.7 + z.r) {
        z.hp -= 100;
        activeCar.hp -= z.type === 'Bruiser' ? 11 : 5;
        nearHits += 1;
      }
    } else if (dist(player.x, player.y, z.x, z.y) < player.r + z.r) {
      const dmg = z.type === 'Bruiser' ? 10 : 6;
      if (player.armor > 0) player.armor = clamp(player.armor - dmg * dt * 4.5, 0, 100);
      else player.health -= dmg * dt;
    }
  }

  if (player.inCar && activeCar && nearHits > 5) {
    activeCar.hp -= nearHits * 0.8;
    activeCar.vx *= 0.75;
    activeCar.vy *= 0.75;
  }

  for (let i = zombies.length - 1; i >= 0; i--) if (zombies[i].hp <= 0) zombies.splice(i, 1);

  if (activeCar && activeCar.hp <= 0) {
    player.inCar = false;
    player.health = clamp(player.health - 20, 1, 100);
    activeCar.hp = 25;
    activeCar.vx = 0;
    activeCar.vy = 0;
  }

  if (player.health <= 0) {
    player.health = 100;
    player.armor = 0;
    player.points = Math.max(0, player.points - 160);
    player.x = 550;
    player.y = 430;
    threat = 1;
    mission = { type: null, stage: 0, objective: null, reward: 0, progress: 0, total: 0 };
  }

  updateMission();

  camera.x = clamp(player.x - canvas.width / 2, 0, world.w - canvas.width);
  camera.y = clamp(player.y - canvas.height / 2, 0, world.h - canvas.height);

  const healthPct = Math.max(0, Math.min(100, player.health));
  ui.healthFill.style.width = `${healthPct}%`;
  ui.healthText.textContent = `${Math.round(healthPct)}%`;

  if (ui.armor) ui.armor.textContent = Math.round(player.armor);
  if (ui.points) ui.points.textContent = player.points.toLocaleString();
  if (ui.weapon) ui.weapon.textContent = player.weapon;
  if (ui.ammo) ui.ammo.textContent = player.weapon === 'Pistol' ? `${mag.Pistol + player.ammo.Pistol}` : `${mag[player.weapon]}/${player.ammo[player.weapon]}`;
  if (ui.threat) ui.threat.textContent = threat;
  if (ui.district) ui.district.textContent = zoneName(player.x, player.y);
  if (ui.car) ui.car.textContent = player.inCar && activeCar ? `${activeCar.name} HP ${Math.round(activeCar.hp)}/${Math.round(activeCar.maxHp)}` : 'On Foot';

  const rackNear = weaponRacks.find(r => dist(player.x, player.y, r.x, r.y) < 70);
  if (rackNear) {
    if (player.unlocked.has(rackNear.gun)) ui.pickupHint.textContent = `You already own ${rackNear.gun}.`;
    else ui.pickupHint.textContent = `Press F to buy ${rackNear.gun} (${rackNear.cost} pts)`;
  } else {
    ui.pickupHint.textContent = '';
  }

  if (!mission.type) ui.mission.textContent = 'Go to Mission Board (safehouse)';
  else {
    const label = mission.type === 'rescue' ? `Rescue ${mission.progress}/${mission.total}` :
      mission.type === 'heist' ? (mission.stage === 1 ? 'Reach pharmacy target' : 'Escape to safehouse') :
      `Clear horde ${mission.progress}/${mission.total}`;
    ui.mission.textContent = label;
  }
}


function drawWorld() {
  for (const z of districtZones) {
    ctx.fillStyle = z.color;
    ctx.globalAlpha = 0.24;
    ctx.fillRect(z.x - camera.x, z.y - camera.y, z.w, z.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#dcdcdc';
    ctx.font = '16px sans-serif';
    ctx.fillText(z.name, z.x - camera.x + 12, z.y - camera.y + 22);
  }

  for (const r of roads) {
    ctx.fillStyle = '#262626';
    ctx.fillRect(r.x - camera.x, r.y - camera.y, r.w, r.h);
    ctx.strokeStyle = '#f3ce62';
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    if (r.w > r.h) {
      ctx.moveTo(r.x - camera.x, r.y - camera.y + r.h / 2);
      ctx.lineTo(r.x - camera.x + r.w, r.y - camera.y + r.h / 2);
    } else {
      ctx.moveTo(r.x - camera.x + r.w / 2, r.y - camera.y);
      ctx.lineTo(r.x - camera.x + r.w / 2, r.y - camera.y + r.h);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const rack of weaponRacks) {
    const p = worldToScreen(rack.x, rack.y);
    ctx.fillStyle = 'rgba(255, 206, 24, 0.9)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = '10px sans-serif';
    ctx.fillText(rack.gun, p.x + 14, p.y + 4);
  }

  ctx.fillStyle = '#3f5a45';
  ctx.fillRect(safehouse.x - camera.x, safehouse.y - camera.y, safehouse.w, safehouse.h);
  ctx.fillStyle = '#c7ffd6';
  ctx.fillText('Safehouse (F)', safehouse.x - camera.x + 8, safehouse.y - camera.y + 20);

  ctx.fillStyle = '#3b4d69';
  ctx.fillRect(missionBoard.x - camera.x, missionBoard.y - camera.y, missionBoard.w, missionBoard.h);
  ctx.fillStyle = '#f0f6ff';
  ctx.fillText('Mission Board (F)', missionBoard.x - camera.x + 6, missionBoard.y - camera.y + 20);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWorld();

  if (mission.type && mission.objective) {
    const p = worldToScreen(mission.objective.x, mission.objective.y);
    ctx.strokeStyle = '#fff34f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff34f'; ctx.fillText('Objective', p.x - 28, p.y - 36);
  }

  for (const s of survivors) {
    if (s.rescued) continue;
    const p = worldToScreen(s.x, s.y);
    ctx.fillStyle = '#91e2ff';
    ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
  }

  for (const p of pickups) {
    if (!p.alive) continue;
    const sp = worldToScreen(p.x, p.y);
    ctx.fillStyle = p.type === 'gun' ? '#61ceff' : '#ffdc6e';
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2); ctx.fill();
  }

  for (const c of cars) {
    const cp = worldToScreen(c.x, c.y);
    ctx.fillStyle = c.color;
    ctx.fillRect(cp.x, cp.y, c.w, c.h);
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${Math.round(c.hp)}`, cp.x + c.w / 2 - 8, cp.y - 4);
  }

  for (const b of bullets) {
    const p = worldToScreen(b.x, b.y);
    ctx.fillStyle = b.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }

  for (const z of zombies) {
    const zp = worldToScreen(z.x, z.y);
    ctx.fillStyle = z.color;
    ctx.beginPath(); ctx.arc(zp.x, zp.y, z.r, 0, Math.PI * 2); ctx.fill();
  }

  if (!player.inCar) {
    const p = worldToScreen(player.x, player.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(-12, 10); ctx.lineTo(-8, 0); ctx.lineTo(-12, -10); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = `rgba(255,0,0,${0.06 * threat})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function renderMinimap() {
  mctx.clearRect(0, 0, minimap.width, minimap.height);
  mctx.fillStyle = '#151515';
  mctx.fillRect(0, 0, minimap.width, minimap.height);

  for (const z of districtZones) {
    mctx.fillStyle = z.color;
    mctx.globalAlpha = 0.5;
    mctx.fillRect((z.x / world.w) * minimap.width, (z.y / world.h) * minimap.height, (z.w / world.w) * minimap.width, (z.h / world.h) * minimap.height);
  }
  mctx.globalAlpha = 1;

  const px = (player.x / world.w) * minimap.width;
  const py = (player.y / world.h) * minimap.height;
  mctx.fillStyle = '#ffffff';
  mctx.beginPath(); mctx.arc(px, py, 4, 0, Math.PI * 2); mctx.fill();

  if (mission.type && mission.objective) {
    mctx.strokeStyle = '#ffee59';
    mctx.beginPath();
    mctx.arc((mission.objective.x / world.w) * minimap.width, (mission.objective.y / world.h) * minimap.height, 5, 0, Math.PI * 2);
    mctx.stroke();
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  update(dt);
  render();
  renderMinimap();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
} catch (err) {
  const errEl = document.getElementById('error');
  if (errEl) {
    errEl.textContent = 'Game error: ' + err.message;
    errEl.style.display = 'block';
  } else {
    console.error('Game error:', err);
  }
}
