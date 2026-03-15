const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  health: document.getElementById('health'),
  armor: document.getElementById('armor'),
  points: document.getElementById('points'),
  weapon: document.getElementById('weapon'),
  ammo: document.getElementById('ammo'),
  threat: document.getElementById('threat'),
  district: document.getElementById('district'),
  car: document.getElementById('car'),
  shop: document.getElementById('shopPanel'),
};

const world = { w: 3400, h: 2200 };
const camera = { x: 0, y: 0 };

const player = {
  x: 580, y: 420, angle: 0, r: 15, speed: 200,
  health: 100, armor: 0, points: 0, inCar: false,
  weapon: 'Pistol', ammo: Infinity,
  unlocked: new Set(['Pistol']),
  pistolMul: 1,
};

const cars = [
  { name: 'Dodge-Charger Inspired', x: 710, y: 520, w: 80, h: 40, color: '#2b77c0', hp: 120, maxHp: 120, speedMul: 1 },
  { name: 'Dodge-Challenger Inspired', x: 1880, y: 980, w: 78, h: 38, color: '#8f2bd8', hp: 110, maxHp: 110, speedMul: 1 },
];
let activeCar = null;

const pickups = [];
for (let i = 0; i < 18; i++) {
  pickups.push({
    x: 250 + Math.random() * (world.w - 500),
    y: 250 + Math.random() * (world.h - 500),
    type: Math.random() < 0.5 ? 'ammo' : 'gun',
    gun: Math.random() < 0.45 ? 'SMG' : 'Rifle',
    alive: true,
  });
}

const safehouse = { x: 520, y: 370, w: 180, h: 120 };
const bullets = [];
const zombies = [];

let keys = new Set();
let mouse = { x: 0, y: 0, down: false };
let threat = 1;
let threatTimer = 0;
let shotCooldown = 0;
let reloadTimer = 0;

const weaponStats = {
  Pistol: { dmg: 24, rpm: 300, spread: 0.03, color: '#ffd166' },
  SMG: { dmg: 15, rpm: 620, spread: 0.08, color: '#9cff57' },
  Rifle: { dmg: 33, rpm: 420, spread: 0.02, color: '#7bd6ff' },
};

const districtZones = [
  { name: 'University Core', x: 0, y: 0, w: 1200, h: 900, color: '#2f5131' },
  { name: 'Downtown Hayes', x: 1200, y: 0, w: 1200, h: 900, color: '#51402f' },
  { name: 'Residential Grid', x: 0, y: 900, w: 1200, h: 1300, color: '#38465a' },
  { name: 'Industrial Edge', x: 1200, y: 900, w: 1200, h: 1300, color: '#4d3758' },
  { name: 'Highway & Outskirts', x: 2400, y: 0, w: 1000, h: 2200, color: '#5a2f37' },
];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(a, b, c, d) { return Math.hypot(c - a, d - b); }

window.addEventListener('keydown', e => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'e') toggleCar();
  if (e.key.toLowerCase() === 'f') interactShop();
  if (e.key.toLowerCase() === 'r') tryReload();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});
canvas.addEventListener('mousedown', () => mouse.down = true);
window.addEventListener('mouseup', () => mouse.down = false);

ui.shop.addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  buyUpgrade(e.target.dataset.buy);
});

function zoneName(x, y) {
  const z = districtZones.find(z => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h);
  return z ? z.name : 'Unknown';
}

function spawnZombie() {
  let edge = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  if (edge === 0) { x = Math.random() * world.w; y = 40; }
  if (edge === 1) { x = Math.random() * world.w; y = world.h - 40; }
  if (edge === 2) { x = 40; y = Math.random() * world.h; }
  if (edge === 3) { x = world.w - 40; y = Math.random() * world.h; }
  const t = Math.random();
  const type = t < 0.65 ? 'Rusher' : (t < 0.9 ? 'Bruiser' : 'Shrieker');
  zombies.push({
    x, y, r: type === 'Bruiser' ? 20 : 14,
    type,
    hp: type === 'Bruiser' ? 140 : (type === 'Shrieker' ? 70 : 55),
    speed: type === 'Bruiser' ? 65 : (type === 'Shrieker' ? 95 : 120),
    color: type === 'Bruiser' ? '#9c3f3f' : (type === 'Shrieker' ? '#d3b63e' : '#7aaf52'),
  });
}

function toggleCar() {
  if (player.inCar) {
    player.inCar = false;
    if (activeCar) {
      player.x = activeCar.x + activeCar.w * 0.6;
      player.y = activeCar.y + activeCar.h * 0.6;
    }
    return;
  }
  const near = cars.find(c => dist(player.x, player.y, c.x + c.w/2, c.y + c.h/2) < 65);
  if (near) {
    player.inCar = true;
    activeCar = near;
  }
}

function interactShop() {
  const inside = player.x > safehouse.x && player.x < safehouse.x + safehouse.w && player.y > safehouse.y && player.y < safehouse.y + safehouse.h;
  if (inside) ui.shop.classList.toggle('hidden');
}

function tryReload() {
  if (player.weapon === 'Pistol') return;
  reloadTimer = 1.0;
}

function buyUpgrade(id) {
  const costs = { armor: 120, pistol: 140, smg: 220, rifle: 320, carArmor: 260, carSpeed: 240 };
  if (player.points < costs[id]) return;
  player.points -= costs[id];
  if (id === 'armor') player.armor = clamp(player.armor + 25, 0, 100);
  if (id === 'pistol') player.pistolMul += 0.2;
  if (id === 'smg') player.unlocked.add('SMG');
  if (id === 'rifle') player.unlocked.add('Rifle');
  if (id === 'carArmor') cars.forEach(c => { c.maxHp += 35; c.hp += 35; });
  if (id === 'carSpeed') cars.forEach(c => c.speedMul += 0.2);
  if (player.weapon !== 'Pistol' && !player.unlocked.has(player.weapon)) player.weapon = 'Pistol';
}

window.addEventListener('keydown', e => {
  if (e.key === '1') player.weapon = 'Pistol';
  if (e.key === '2' && player.unlocked.has('SMG')) player.weapon = 'SMG';
  if (e.key === '3' && player.unlocked.has('Rifle')) player.weapon = 'Rifle';
});

function update(dt) {
  threatTimer += dt;
  if (threatTimer > 6) {
    threat = clamp(threat - 1, 1, 5);
    threatTimer = 0;
  }

  const sprint = keys.has('shift') ? 1.35 : 1;
  if (!player.inCar) {
    let dx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    let dy = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    const m = Math.hypot(dx, dy) || 1;
    player.x += (dx / m) * player.speed * sprint * dt;
    player.y += (dy / m) * player.speed * sprint * dt;
  } else if (activeCar) {
    let dx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    let dy = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    const m = Math.hypot(dx, dy) || 1;
    const speed = 330 * activeCar.speedMul;
    activeCar.x += (dx / m) * speed * dt;
    activeCar.y += (dy / m) * speed * dt;
    activeCar.x = clamp(activeCar.x, 0, world.w - activeCar.w);
    activeCar.y = clamp(activeCar.y, 0, world.h - activeCar.h);
    player.x = activeCar.x + activeCar.w / 2;
    player.y = activeCar.y + activeCar.h / 2;
  }

  player.x = clamp(player.x, 0, world.w);
  player.y = clamp(player.y, 0, world.h);

  const targetWX = camera.x + mouse.x;
  const targetWY = camera.y + mouse.y;
  player.angle = Math.atan2(targetWY - player.y, targetWX - player.x);

  shotCooldown -= dt;
  if (reloadTimer > 0) {
    reloadTimer -= dt;
    if (reloadTimer <= 0) player.ammo = Infinity;
  }

  if (mouse.down && shotCooldown <= 0 && reloadTimer <= 0) {
    const w = weaponStats[player.weapon];
    const secPerShot = 60 / w.rpm;
    shotCooldown = secPerShot;
    const spread = (Math.random() - 0.5) * w.spread;
    const a = player.angle + spread;
    bullets.push({ x: player.x, y: player.y, vx: Math.cos(a) * 650, vy: Math.sin(a) * 650, dmg: w.dmg * (player.weapon === 'Pistol' ? player.pistolMul : 1), life: 1.2, color: w.color });
    threat = clamp(threat + 1, 1, 5);
    threatTimer = 0;
  }

  for (const b of bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
  }
  for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].life <= 0) bullets.splice(i, 1);

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (!p.alive) continue;
    if (dist(player.x, player.y, p.x, p.y) < 28) {
      p.alive = false;
      if (p.type === 'gun') player.unlocked.add(p.gun);
      else player.points += 15;
    }
  }

  const spawnBudget = Math.floor(threat * 0.9 + 0.5);
  while (zombies.length < 8 + threat * 8) spawnZombie();
  for (let s = 0; s < spawnBudget; s++) if (Math.random() < 0.02 * threat) spawnZombie();

  for (let zi = zombies.length - 1; zi >= 0; zi--) {
    const z = zombies[zi];
    const tx = player.x, ty = player.y;
    const a = Math.atan2(ty - z.y, tx - z.x);
    z.x += Math.cos(a) * z.speed * dt;
    z.y += Math.sin(a) * z.speed * dt;

    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (dist(z.x, z.y, b.x, b.y) < z.r + 3) {
        z.hp -= b.dmg;
        bullets.splice(bi, 1);
        if (z.hp <= 0) {
          player.points += z.type === 'Bruiser' ? 25 : (z.type === 'Shrieker' ? 20 : 12);
          zombies.splice(zi, 1);
          break;
        }
      }
    }
  }

  for (const z of zombies) {
    if (player.inCar && activeCar) {
      const cx = activeCar.x + activeCar.w / 2;
      const cy = activeCar.y + activeCar.h / 2;
      if (dist(cx, cy, z.x, z.y) < Math.max(activeCar.w, activeCar.h) * 0.6 + z.r) {
        z.hp -= 80;
        activeCar.hp -= z.type === 'Bruiser' ? 10 : 4;
      }
    } else if (dist(player.x, player.y, z.x, z.y) < player.r + z.r) {
      const d = z.type === 'Bruiser' ? 18 : 11;
      if (player.armor > 0) player.armor = clamp(player.armor - d * 0.8 * dt * 6, 0, 100);
      else player.health -= d * dt;
    }
  }

  for (let i = zombies.length - 1; i >= 0; i--) if (zombies[i].hp <= 0) zombies.splice(i, 1);

  if (activeCar && activeCar.hp <= 0) {
    player.inCar = false;
    activeCar.hp = 25;
  }

  if (player.health <= 0) {
    player.health = 100; player.armor = 0; player.points = Math.max(0, player.points - 150);
    player.x = 570; player.y = 460; threat = 1; zombies.length = 0;
  }

  camera.x = clamp(player.x - canvas.width / 2, 0, world.w - canvas.width);
  camera.y = clamp(player.y - canvas.height / 2, 0, world.h - canvas.height);

  ui.health.textContent = Math.round(player.health);
  ui.armor.textContent = Math.round(player.armor);
  ui.points.textContent = Math.round(player.points);
  ui.weapon.textContent = `${player.weapon} (1/2/3)`;
  ui.ammo.textContent = reloadTimer > 0 ? 'Reloading...' : '∞';
  ui.threat.textContent = threat;
  ui.district.textContent = zoneName(player.x, player.y);
  ui.car.textContent = player.inCar && activeCar ? `${activeCar.name} HP ${Math.round(activeCar.hp)}/${Math.round(activeCar.maxHp)}` : 'On Foot';
}

function drawGrid() {
  ctx.strokeStyle = '#232323';
  ctx.lineWidth = 1;
  for (let x = 0; x <= world.w; x += 100) {
    ctx.beginPath(); ctx.moveTo(x - camera.x, -camera.y); ctx.lineTo(x - camera.x, world.h - camera.y); ctx.stroke();
  }
  for (let y = 0; y <= world.h; y += 100) {
    ctx.beginPath(); ctx.moveTo(-camera.x, y - camera.y); ctx.lineTo(world.w - camera.x, y - camera.y); ctx.stroke();
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const z of districtZones) {
    ctx.fillStyle = z.color;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(z.x - camera.x, z.y - camera.y, z.w, z.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ddd';
    ctx.font = '16px sans-serif';
    ctx.fillText(z.name, z.x - camera.x + 12, z.y - camera.y + 22);
  }

  drawGrid();

  ctx.fillStyle = '#395142';
  ctx.fillRect(safehouse.x - camera.x, safehouse.y - camera.y, safehouse.w, safehouse.h);
  ctx.fillStyle = '#d9ffe4';
  ctx.fillText('Safehouse (F to open shop)', safehouse.x - camera.x + 10, safehouse.y - camera.y + 20);

  for (const p of pickups) {
    if (!p.alive) continue;
    ctx.fillStyle = p.type === 'gun' ? '#66d1ff' : '#ffdf6e';
    ctx.beginPath(); ctx.arc(p.x - camera.x, p.y - camera.y, 8, 0, Math.PI * 2); ctx.fill();
  }

  for (const c of cars) {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x - camera.x, c.y - camera.y, c.w, c.h);
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${Math.round(c.hp)}`, c.x - camera.x + c.w/2 - 9, c.y - camera.y - 6);
  }

  for (const b of bullets) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - camera.x - 2, b.y - camera.y - 2, 4, 4);
  }

  for (const z of zombies) {
    ctx.fillStyle = z.color;
    ctx.beginPath(); ctx.arc(z.x - camera.x, z.y - camera.y, z.r, 0, Math.PI * 2); ctx.fill();
  }

  if (!player.inCar) {
    ctx.save();
    ctx.translate(player.x - camera.x, player.y - camera.y);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(-12, 10); ctx.lineTo(-8, 0); ctx.lineTo(-12, -10); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = `rgba(255,0,0,${0.08 * threat})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
