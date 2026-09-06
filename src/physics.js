// Fixed-step playfield simulation. Units are table units; +y is up-table.
export const RADIUS = 0.19;
export const BUMPERS = [
  { x: -3.05, y: 15.9, r: 0.65 },
  { x: -3.65, y: 13.8, r: 0.65 },
  { x: -2.4, y: 12.4, r: 0.65 },
];
export const TARGETS = Array.from({ length: 5 }, (_, i) => ({
  x: -3.8 + i * 0.49,
  y: 9.45 + i * 0.11,
  r: 0.23,
}));
export const WALLS = [
  [-4.65, 2.8, -4.65, 17.2],
  [-4.65, 17.2, -4, 18.5],
  [-4, 18.5, -2.6, 19],
  [-2.6, 19, 3.6, 19],
  [3.6, 19, 4.6, 18.4],
  [4.6, 18.4, 4.6, 3],
  [5.5, 0.6, 5.5, 18.7],
  [5.5, 18.7, 4.8, 19.6],
  [4.8, 19.6, -2.6, 19.6],
  [-4.65, 2.8, -3.75, 1.3],
  [-3.75, 1.3, -1.18, 0.1],
  [4.6, 3, 3.7, 1.3],
  [3.7, 1.3, 1.18, 0.1],
  [-3.83, 3, -2.15, 2.35],
  [3.83, 3, 2.15, 2.35],
  [-3.83, 3, -3.95, 6.2],
  [3.83, 3, 3.95, 6.2],
  [-3.4, 6.5, -3.25, 4.1],
  [-3.25, 4.1, -2.25, 3.6],
  [-2.25, 3.6, -3.4, 6.5],
  [3.4, 6.5, 3.25, 4.1],
  [3.25, 4.1, 2.25, 3.6],
  [2.25, 3.6, 3.4, 6.5],
  // castle perimeter leaves the front scoop accessible
  [-1.35, 13.5, -1.35, 16.6],
  [-1.35, 16.6, 1.35, 16.6],
  [1.35, 16.6, 1.35, 13.5],
  [-1.35, 13.5, -0.55, 13.1],
  [0.55, 13.1, 1.35, 13.5],
];
export function closestPoint(x, y, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    t = Math.max(
      0,
      Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)),
    );
  return { x: ax + t * dx, y: ay + t * dy, t };
}
export function collideSegment(
  b,
  ax,
  ay,
  bx,
  by,
  r = 0.07,
  restitution = 0.82,
) {
  const p = closestPoint(b.x, b.y, ax, ay, bx, by);
  let dx = b.x - p.x,
    dy = b.y - p.y,
    d = Math.hypot(dx, dy);
  if (d >= RADIUS + r) return false;
  if (d < 1e-7) {
    dx = -(by - ay);
    dy = bx - ax;
    d = Math.hypot(dx, dy) || 1;
  }
  const nx = dx / d,
    ny = dy / d,
    overlap = RADIUS + r - Math.hypot(b.x - p.x, b.y - p.y);
  b.x += nx * (overlap + 0.001);
  b.y += ny * (overlap + 0.001);
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + restitution) * vn * nx;
    b.vy -= (1 + restitution) * vn * ny;
  }
  return vn < -0.4;
}
export class Pinball {
  constructor(onEvent = () => {}) {
    this.onEvent = onEvent;
    this.state = "ready";
    this.balls = [];
    this.score = 0;
    this.ballNumber = 1;
    this.multiplier = 1;
    this.locks = 0;
    this.rampCombos = 0;
    this.targets = Array(5).fill(false);
    this.time = 0;
    this.charge = 0;
    this.charging = false;
    this.inputs = { left: false, right: false };
    this.flippers = [
      { x: -2.12, y: 2.35, side: 1, angle: -0.38, omega: 0 },
      { x: 2.12, y: 2.35, side: -1, angle: -0.38, omega: 0 },
      { x: 3.85, y: 11.65, side: -1, angle: -0.3, omega: 0, length: 1.05 },
    ];
    this.nextId = 0;
    this.saveUntil = 0;
    this.rushUntil = 0;
    this.tilt = 0;
    this.tilted = false;
    this.jackpot = 100000;
    this.lastRamp = -1;
    this.comboUntil = 0;
    this.cooldowns = new Map();
  }
  event(type, data = {}) {
    this.onEvent({ type, ...data });
  }
  start() {
    this.score = 0;
    this.ballNumber = 1;
    this.multiplier = 1;
    this.locks = 0;
    this.targets.fill(false);
    this.rampCombos = 0;
    this.time = 0;
    this.saveUntil = 0;
    this.rushUntil = 0;
    this.tilt = 0;
    this.tilted = false;
    this.jackpot = 100000;
    this.lastRamp = -1;
    this.balls = [];
    this.state = "playing";
    this.charging = false;
    this.charge = 0;
    this.inputs.left = this.inputs.right = false;
    this.cooldowns.clear();
    this.spawn();
    this.event("start");
  }
  spawn(x = 5.05, y = 1.6, vx = 0, vy = 0, lane = true) {
    const b = {
      id: ++this.nextId,
      x,
      y,
      vx,
      vy,
      h: RADIUS,
      lane,
      path: null,
      age: 0,
    };
    this.balls.push(b);
    return b;
  }
  points(n, label, x = 0, y = 10) {
    if (this.tilted) return;
    const value = n * this.multiplier * (this.rushUntil > this.time ? 2 : 1);
    this.score += value;
    this.event("score", { value, label, x, y });
  }
  beginCharge() {
    if (
      this.state !== "playing" ||
      !this.balls.some((b) => b.lane && b.vy === 0)
    )
      return;
    this.charging = true;
  }
  launch() {
    if (this.state !== "playing") return;
    const b = this.balls.find((b) => b.lane && b.vy === 0);
    if (b) {
      b.power = this.charge;
      b.vy = 22 + this.charge * 8;
      if (!b.saved) this.saveUntil = this.time + 12;
      this.event("launch");
    }
    this.charging = false;
    this.charge = 0;
  }
  pause() {
    if (this.state === "playing") {
      this.state = "paused";
      this.charging = false;
      this.charge = 0;
      this.inputs.left = this.inputs.right = false;
    } else if (this.state === "paused") this.state = "playing";
  }
  nudge() {
    if (this.state !== "playing" || this.tilted) return;
    this.tilt += 1.05;
    if (this.tilt >= 2.8) {
      this.tilted = true;
      this.saveUntil = 0;
      this.event("tilt");
    } else {
      for (const b of this.balls)
        if (!b.lane && !b.path) {
          b.vy += 2.8;
          b.vx += b.x > 0 ? -1.5 : 1.5;
        }
      this.event("nudge", { danger: this.tilt > 1.8 });
    }
  }
  cooldown(key, seconds) {
    if ((this.cooldowns.get(key) || 0) > this.time) return false;
    this.cooldowns.set(key, this.time + seconds);
    return true;
  }
  ramp(b, side) {
    b.path = { kind: "ramp", side, t: 0, duration: 2.3 };
    b.vx = b.vy = 0;
    this.points(5000, "SUGAR RAMP", b.x, b.y);
    if (
      this.lastRamp !== side &&
      this.lastRamp !== -1 &&
      this.time < this.comboUntil
    ) {
      this.rampCombos++;
      this.multiplier = Math.min(5, this.multiplier + 1);
      this.event("combo");
    }
    this.lastRamp = side;
    this.comboUntil = this.time + 25;
    this.event("ramp", { side });
  }
  scoop(b, kind) {
    b.path = { kind, t: 0, duration: 1.3, x: b.x, y: b.y };
    b.vx = b.vy = 0;
    if (kind === "lock" && this.balls.length > 1) {
      this.points(2500, "LOCK BONUS", b.x, b.y);
      this.event("castle");
    } else if (kind === "lock") {
      this.locks++;
      this.points(10000, "BALL LOCKED", b.x, b.y);
      if (this.locks >= 3) {
        this.locks = 0;
        this.saveUntil = this.time + 15;
        this.spawn(-1, 17, 2, -5, false);
        this.spawn(1, 17, -2, -6, false);
        this.event("multiball");
      } else this.event("lock");
    } else if (kind === "castle") {
      if (this.balls.length > 1) {
        this.points(this.jackpot, "JACKPOT", 0, 13);
        this.jackpot += 25000;
        this.event("jackpot");
      } else {
        this.points(7500, "CASTLE BONUS", 0, 13);
        this.event("castle");
      }
    } else {
      this.points(4000, "CHOCOLATE SWIRL", b.x, b.y);
      this.event("swirl");
    }
  }
  drain(b) {
    this.balls = this.balls.filter((v) => v !== b);
    if (this.balls.length) return;
    if (!this.tilted && this.time < this.saveUntil) {
      const saved = this.spawn();
      saved.saved = true;
      this.event("save");
      return;
    }
    this.event("drain");
    this.ballNumber++;
    this.tilted = false;
    this.tilt = 0;
    this.multiplier = 1;
    if (this.ballNumber > 3) {
      this.ballNumber = 3;
      this.state = "gameover";
      this.event("gameover");
    } else {
      this.spawn();
      this.event("newball");
    }
  }
  step(dt) {
    if (this.state !== "playing") return;
    this.time += dt;
    this.tilt = Math.max(0, this.tilt - dt * 0.18);
    if (this.charging) this.charge = Math.min(1, this.charge + dt * 0.75);
    for (const [i, f] of this.flippers.entries()) {
      const active =
        !this.tilted && (i === 0 ? this.inputs.left : this.inputs.right);
      const target = active ? 0.48 : -0.38,
        old = f.angle;
      f.angle += Math.max(-dt * 14, Math.min(dt * 14, target - f.angle));
      f.omega = (f.angle - old) / dt;
    }
    for (const b of [...this.balls]) {
      b.age += dt;
      if (b.path) {
        b.path.t += dt;
        if (b.path.t >= b.path.duration) {
          const p = b.path;
          b.path = null;
          b.h = RADIUS;
          if (p.kind === "ramp") {
            b.x = p.side === 0 ? -3.55 : 3.55;
            b.y = 5.6;
            b.vx = p.side === 0 ? 1.2 : -1.2;
            b.vy = -5;
          } else {
            b.vx = p.kind === "lock" ? -4 : 2;
            b.vy = -8;
            b.y -= 0.7;
          }
        }
        continue;
      }
      if (b.lane) {
        if (b.vy === 0) continue;
        b.vy -= 5.6 * dt;
        b.y += b.vy * dt;
        if (b.y > 18.6) {
          b.lane = false;
          b.x = 4.1;
          b.y = 18.2;
          b.vx = -9;
          b.vy = -1;
          this.points(b.power > 0.8 ? 2500 : 1000, "SKILL SHOT", b.x, b.y);
        } else if (b.y < 1.6) {
          b.y = 1.6;
          b.vy = 0;
        }
        continue;
      }
      b.vy -= 5.6 * dt;
      b.vx *= Math.exp(-0.018 * dt);
      b.vy *= Math.exp(-0.018 * dt);
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 28) {
        b.vx *= 28 / speed;
        b.vy *= 28 / speed;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -0.4) {
        this.drain(b);
        continue;
      }
      if (b.x > 4.42) {
        b.x = 4.42;
        b.vx = -Math.abs(b.vx) * 0.8;
      }
      // Shot entrances are sensors; balls follow the elevated physical track after entry.
      if (b.vy > 2 && b.y > 6.85 && b.y < 7.65) {
        if (Math.abs(b.x + 2.65) < 0.47) {
          this.ramp(b, 0);
          continue;
        }
        if (Math.abs(b.x - 2.65) < 0.47) {
          this.ramp(b, 1);
          continue;
        }
      }
      if (b.y > 12.85 && b.y < 13.6 && Math.abs(b.x) < 0.55 && b.vy > 0) {
        this.scoop(b, "castle");
        continue;
      }
      if (Math.hypot(b.x - 3.05, b.y - 15.1) < 0.52) {
        this.scoop(b, "lock");
        continue;
      }
      if (Math.hypot(b.x - 3.25, b.y - 9.1) < 0.43) {
        this.scoop(b, "swirl");
        continue;
      }
      WALLS.forEach((w, i) => {
        if (collideSegment(b, ...w)) {
          if (i >= 16 && i <= 21 && this.cooldown("sling" + i, 0.12)) {
            b.vx += (i < 19 ? 1 : -1) * 3;
            b.vy += 3;
            this.points(150, "SLING", b.x, b.y);
            this.event("sling", { side: i < 19 ? 0 : 1 });
          } else if (this.cooldown("wall" + b.id, 0.12)) this.event("wall");
        }
      });
      BUMPERS.forEach((p, i) => {
        const dx = b.x - p.x,
          dy = b.y - p.y,
          d = Math.hypot(dx, dy);
        if (d < p.r + RADIUS) {
          const nx = dx / (d || 1),
            ny = dy / (d || 1);
          b.x = p.x + nx * (p.r + RADIUS + 0.002);
          b.y = p.y + ny * (p.r + RADIUS + 0.002);
          const vn = b.vx * nx + b.vy * ny;
          b.vx -= Math.min(0, vn) * nx;
          b.vy -= Math.min(0, vn) * ny;
          b.vx += nx * 8;
          b.vy += ny * 8;
          if (this.cooldown("bumper" + i, 0.1)) {
            this.points(500, "POPPING!", p.x, p.y);
            this.event("bumper", { index: i });
          }
        }
      });
      TARGETS.forEach((p, i) => {
        if (
          !this.targets[i] &&
          collideSegment(b, p.x - 0.2, p.y, p.x + 0.2, p.y, 0.12, 0.95) &&
          this.cooldown("target" + i, 0.2)
        ) {
          this.targets[i] = true;
          this.points(1000, "SWEET HIT", p.x, p.y);
          this.event("target", { index: i });
          if (this.targets.every(Boolean)) {
            this.rushUntil = this.time + 30;
            this.targets.fill(false);
            this.points(10000, "SUGAR RUSH", 0, 10);
            this.event("rush");
          }
        }
      });
      for (const f of this.flippers) {
        const len = f.length || 1.7,
          ex = f.x + f.side * Math.cos(f.angle) * len,
          ey = f.y + Math.sin(f.angle) * len;
        const p = closestPoint(b.x, b.y, f.x, f.y, ex, ey);
        const dx = b.x - p.x,
          dy = b.y - p.y,
          d = Math.hypot(dx, dy);
        if (d < RADIUS + 0.16) {
          const nx = dx / (d || 1),
            ny = dy / (d || 1);
          b.x = p.x + nx * (RADIUS + 0.162);
          b.y = p.y + ny * (RADIUS + 0.162);
          const sx = -f.side * Math.sin(f.angle) * len * p.t * f.omega,
            sy = Math.cos(f.angle) * len * p.t * f.omega;
          const vn = (b.vx - sx) * nx + (b.vy - sy) * ny;
          if (vn < 0) {
            b.vx -= 1.7 * vn * nx;
            b.vy -= 1.7 * vn * ny;
          }
          if (f.omega > 1 && dy > -0.12 && this.cooldown("flip" + b.id, 0.12)) {
            b.vy = Math.max(b.vy, 15 + 7 * p.t);
            b.vx = f.side * (5 - 10 * p.t);
            this.event("flipper");
          }
        }
      }
    }
    for (let i = 0; i < this.balls.length; i++)
      for (let j = i + 1; j < this.balls.length; j++) {
        const a = this.balls[i],
          b = this.balls[j];
        if (a.path || b.path || a.lane || b.lane) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy);
        if (d > 0 && d < RADIUS * 2) {
          const nx = dx / d,
            ny = dy / d,
            o = (RADIUS * 2 - d) / 2;
          a.x -= nx * o;
          a.y -= ny * o;
          b.x += nx * o;
          b.y += ny * o;
          const v = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (v > 0) {
            a.vx -= v * nx;
            a.vy -= v * ny;
            b.vx += v * nx;
            b.vy += v * ny;
          }
        }
      }
  }
  snapshot() {
    return {
      state: this.state,
      score: this.score,
      ballNumber: this.ballNumber,
      multiplier: this.multiplier,
      locks: this.locks,
      targets: [...this.targets],
      balls: this.balls.map((b) => ({ ...b })),
      time: this.time,
      tilted: this.tilted,
      rushUntil: this.rushUntil,
    };
  }
}
