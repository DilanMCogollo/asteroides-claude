'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    // Las balas no envuelven: se eliminan al salir de la pantalla
    const offScreen = this.x < 0 || this.x > W || this.y < 0 || this.y > H;
    if (this.ttl <= 0 || offScreen) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    // Verde con cámara lenta; en el último segundo alterna con blanco para avisar que se acaba
    const slowed = ship.slow > 0 && (ship.slow >= 1 || Math.floor(ship.slow * 8) % 2 !== 0);
    ctx.strokeStyle = slowed ? SLOW_COLOR : '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Power-ups (disparo triple, ángel de la guardia, cámara lenta, boost y bomba)
const TRIPLE_SHOT_DURATION = 10;    // segundos de efecto
const TRIPLE_SHOT_SPREAD   = 0.2;   // separación del abanico en radianes
const POWERUP_TTL          = 8;     // segundos en pantalla sin recoger
const POWERUP_EXTRA_CHANCE = 0.1;   // probabilidad por impacto tras la aparición garantizada
const POWERUP_MSG_DURATION = 2;     // segundos que se muestra la frase al recoger
const SHIP_COLOR_TRIPLE    = '#4da6ff';
const SHIELD_DURATION      = 5;     // segundos de efecto
const SHIELD_RADIUS        = 28;    // cubre la nariz de la nave, a 20 px del centro
const SHIELD_HIT_INVINCIBILITY = 1; // segundos para que los fragmentos no maten a la nave
const SHIELD_COLOR         = '#ffe600';
const SLOW_DURATION        = 6;     // segundos de efecto
const SLOW_FACTOR          = 0.5;   // multiplicador de velocidad de los asteroides
const SLOW_COLOR           = '#4dff88';
const BOOST_DURATION       = 8;     // segundos de efecto
const BOOST_THRUST_FACTOR  = 4;     // multiplicador de la aceleración
const BOOST_DRAG           = 0.975; // más freno que lo normal: duplica la velocidad máxima y derrapa la mitad
const BOOST_COLOR          = '#ff1a1a';
const NUKE_CHANCE         = 0.1;   // probabilidad de que un power-up sea la bomba
const NUKE_ANIM_DURATION   = 1.5;   // segundos de animación antes de pasar de nivel
const NUKE_FLASH_DURATION  = 0.3;   // segundos del destello inicial
const NUKE_COLOR           = '#ff5533';

const POWERUP_INFO = {
  triple: { color: SHIP_COLOR_TRIPLE, msg: '¡DISPARO TRIPLE!' },
  shield: { color: SHIELD_COLOR,      msg: '¡ÁNGEL DE LA GUARDIA!' },
  slow:   { color: SLOW_COLOR,        msg: '¡CÁMARA LENTA!' },
  boost:  { color: BOOST_COLOR,       msg: '¡GOTTA GO FAST!' },
  nuke:   { color: NUKE_COLOR,        msg: '¡BOMBA NUCLEAR! PULSA N' },
};
// La bomba queda fuera del sorteo uniforme porque tiene su propia probabilidad
const POWERUP_TYPES = Object.keys(POWERUP_INFO).filter(t => t !== 'nuke');

class PowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.type = !ship.hasNuke && Math.random() < NUKE_CHANCE
      ? 'nuke'
      : POWERUP_TYPES[randInt(0, POWERUP_TYPES.length - 1)];
    const angle = rand(0, Math.PI * 2);
    const speed = rand(15, 30);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = 12;
    this.ttl  = POWERUP_TTL;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo cuando está a punto de desaparecer
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    const { color } = POWERUP_INFO[this.type];
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    if (this.type === 'shield') {
      // Círculo interior a modo de aureola
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'slow') {
      // Manecillas de reloj
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(0, 0);
      ctx.lineTo(5, 3);
      ctx.stroke();
    } else if (this.type === 'boost') {
      // Rayo en zigzag
      ctx.beginPath();
      ctx.moveTo(3, -8);
      ctx.lineTo(-4, 1);
      ctx.lineTo(1, 1);
      ctx.lineTo(-3, 8);
      ctx.stroke();
    } else if (this.type === 'nuke') {
      // Símbolo de radiación: tres sectores
      for (let i = 0; i < 3; i++) {
        const mid = -Math.PI / 2 + i * (Math.PI * 2 / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 8, mid - Math.PI / 6, mid + Math.PI / 6);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Tres puntos en abanico
      for (const [dx, dy] of [[-5, 3], [0, -4], [5, 3]]) {
        ctx.beginPath();
        ctx.arc(dx, dy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() {
    // Fuera de reset(): nextLevel() llama a reset() y los efectos deben conservarse
    this.tripleShot = 0;
    this.shield     = 0;
    this.slow       = 0;
    this.boost      = 0;
    this.hasNuke    = false;
    this.reset();
  }

  // En el último segundo alterna para avisar que se acaba
  get boostVisible() {
    return this.boost > 0 && (this.boost >= 1 || Math.floor(this.boost * 8) % 2 !== 0);
  }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot    > 0) this.tripleShot    -= dt;
    if (this.shield        > 0) this.shield        -= dt;
    if (this.slow          > 0) this.slow          -= dt;
    if (this.boost         > 0) this.boost         -= dt;

    const boosted = this.boost > 0;
    const ROT  = 3.5;   // rad/s
    const THRUST = boosted ? 260 * BOOST_THRUST_FACTOR : 260;  // px/s²
    const DRAG   = boosted ? BOOST_DRAG : 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SHOT_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SHOT_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  drawShield() {
    if (this.shield <= 0) return;
    // Parpadeo en el último segundo para avisar que se acaba
    if (this.shield < 1 && Math.floor(this.shield * 8) % 2 === 0) return;

    ctx.save();
    ctx.strokeStyle = SHIELD_COLOR;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, SHIELD_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawBolts() {
    if (!this.boostVisible) return;

    // Se regeneran en cada frame, así que parpadean solos como la llama del propulsor
    const bolts = [];
    for (let i = 0; i < 3; i++) {
      const start = rand(0, Math.PI * 2);
      const segments = randInt(5, 6);
      const points = [];
      for (let j = 0; j <= segments; j++) {
        const a = start + j * 0.25;
        const r = rand(22, 32);   // la nariz está a 20 px del centro
        points.push([this.x + Math.cos(a) * r, this.y + Math.sin(a) * r]);
      }
      bolts.push(points);
    }

    ctx.save();
    ctx.lineJoin = 'round';
    // Rojo grueso y blanco fino encima, para dar efecto de brillo
    for (const [color, width] of [[BOOST_COLOR, 3], ['#fff', 1]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth   = width;
      for (const points of bolts) {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++)
          ctx.lineTo(points[i][0], points[i][1]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  draw() {
    if (this.dead) return;
    // Antes del parpadeo de la nave, para que sigan visibles mientras parpadea
    this.drawShield();
    this.drawBolts();
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = this.boostVisible ? BOOST_COLOR
      : this.tripleShot > 0 ? SHIP_COLOR_TRIPLE
      : '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let hitsUntilPowerUp;   // impactos que faltan para la aparición garantizada del nivel
let powerUpMsgTimer;
let powerUpMsgType;     // clave de POWERUP_INFO del último power-up recogido
let nukeAnimTimer;      // segundos que le quedan a la animación de la bomba

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps  = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  hitsUntilPowerUp = randInt(1, 3);
  powerUpMsgTimer  = 0;
  nukeAnimTimer    = 0;
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerUps  = [];
  hitsUntilPowerUp = randInt(1, 3);
  ship.reset();
  spawnAsteroids(3 + level);
}

function maybeSpawnPowerUp(x, y) {
  if (hitsUntilPowerUp > 0) {
    hitsUntilPowerUp--;
    if (hitsUntilPowerUp === 0) powerUps.push(new PowerUp(x, y));
  } else if (powerUps.length === 0 && Math.random() < POWERUP_EXTRA_CHANCE) {
    powerUps.push(new PowerUp(x, y));
  }
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

// Devuelve los fragmentos: quien llama decide cuándo agregarlos a `asteroids`
function destroyAsteroid(a) {
  a.dead = true;
  score += POINTS[a.size];
  explode(a.x, a.y, a.size * 5);
  maybeSpawnPowerUp(a.x, a.y);
  return a.split();
}

// No usa destroyAsteroid(): esta destrucción no deja fragmentos ni genera power-ups
function detonateNuke() {
  for (const a of asteroids) {
    score += POINTS[a.size];
    explode(a.x, a.y, a.size * 5);
  }
  asteroids = [];
  ship.hasNuke  = false;
  nukeAnimTimer = NUKE_ANIM_DURATION;
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  ship.tripleShot = 0;
  ship.slow       = 0;
  ship.boost      = 0;
  powerUpMsgTimer = 0;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  // Se lee en todos los estados: una pulsación estando muerto no debe detonar al reaparecer
  const nukePressed = pressed('KeyN');

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    powerUps.forEach(p => p.update(dt));
    powerUps = powerUps.filter(p => !p.dead);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  if (nukePressed && ship.hasNuke) detonateNuke();

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  // Se escala dt y no la velocidad: cubre fragmentos nuevos y no hay nada que restaurar
  const asteroidDt = ship.slow > 0 ? dt * SLOW_FACTOR : dt;
  asteroids.forEach(a => a.update(asteroidDt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));
  if (powerUpMsgTimer > 0) powerUpMsgTimer -= dt;
  if (nukeAnimTimer   > 0) nukeAnimTimer   -= dt;

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerUps  = powerUps.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        newAsteroids.push(...destroyAsteroid(a));
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs power-up
  for (const p of powerUps) {
    if (dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      if (p.type === 'shield') ship.shield = SHIELD_DURATION;
      else if (p.type === 'slow') ship.slow = SLOW_DURATION;
      else if (p.type === 'boost') ship.boost = BOOST_DURATION;
      else if (p.type === 'nuke') ship.hasNuke = true;
      else ship.tripleShot = TRIPLE_SHOT_DURATION;
      powerUpMsgType  = p.type;
      powerUpMsgTimer = POWERUP_MSG_DURATION;
    }
  }
  powerUps = powerUps.filter(p => !p.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    const hasShield = ship.shield > 0;
    const hitRadius = hasShield ? SHIELD_RADIUS : ship.radius;
    for (const a of asteroids) {
      if (dist(ship, a) < hitRadius + a.radius * 0.82) {
        if (hasShield) {
          ship.shield     = 0;
          ship.invincible = SHIELD_HIT_INVINCIBILITY;
          const fragments = destroyAsteroid(a);
          asteroids = asteroids.filter(x => !x.dead).concat(fragments);
        } else {
          killShip();
        }
        break;
      }
    }
  }

  // Nivel completado; espera a la bomba porque nextLevel() borra las partículas
  if (asteroids.length === 0 && nukeAnimTimer <= 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  if (ship.hasNuke) {
    ctx.textAlign = 'left';
    ctx.fillStyle = NUKE_COLOR;
    ctx.fillText('BOMBA [N]', 14, 46);
  }
}

function drawPowerUpMsg() {
  if (powerUpMsgTimer <= 0) return;
  const { color, msg } = POWERUP_INFO[powerUpMsgType];
  ctx.save();
  ctx.globalAlpha = Math.min(powerUpMsgTimer / 0.5, 1);  // se desvanece en el último medio segundo
  ctx.textAlign   = 'center';
  ctx.fillStyle   = color;
  ctx.font        = 'bold 22px monospace';
  ctx.fillText(msg, W / 2, 70);
  ctx.restore();
}

function drawNukeAnim() {
  if (nukeAnimTimer <= 0) return;
  const elapsed = NUKE_ANIM_DURATION - nukeAnimTimer;

  ctx.save();
  // Destello blanco inicial
  if (elapsed < NUKE_FLASH_DURATION) {
    ctx.globalAlpha = 1 - elapsed / NUKE_FLASH_DURATION;
    ctx.fillStyle   = '#fff';
    ctx.fillRect(0, 0, W, H);
  }

  // El texto crece durante toda la animación y se desvanece en el último medio segundo
  ctx.globalAlpha  = Math.min(nukeAnimTimer / 0.5, 1);
  ctx.translate(W / 2, H / 2);
  const scale = 0.6 + 0.8 * (elapsed / NUKE_ANIM_DURATION);
  ctx.scale(scale, scale);
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = NUKE_COLOR;
  ctx.font         = 'bold 60px monospace';
  ctx.fillText('¡NUCLEAR!', 0, 0);
  ctx.restore();
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  powerUps.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();
  drawPowerUpMsg();
  drawNukeAnim();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
