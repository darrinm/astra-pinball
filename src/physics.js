import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import {
  RADIUS,
  STEP,
  GRAVITY,
  BUMPERS,
  TARGETS,
  WALLS,
  FLIPPERS,
  SLINGS,
  SCOOPS,
  RAMPS,
  floorGeometry,
  flipperGeometry,
  slingGeometry,
  geometryArrays,
  vec,
} from "./layout.js";
export { RADIUS, BUMPERS, TARGETS, WALLS } from "./layout.js";
let initialized = false;
let initializing;
export function initPhysics() {
  return (initializing ??= RAPIER.init().then(() => {
    initialized = true;
  }));
}
const MASS = 0.08;
const quatY = (a) => ({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) });

export class Pinball {
  constructor(onEvent = () => {}) {
    this.onEvent = onEvent;
    this.state = "ready";
    this.balls = [];
    this.lockedBalls = [];
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
    this.flippers = FLIPPERS.map((f) => ({ ...f, angle: -0.38, omega: 0 }));
    this.nextId = 0;
    this.saveUntil = 0;
    this.rushUntil = 0;
    this.tilt = 0;
    this.tilted = false;
    this.jackpot = 100000;
    this.lastRamp = -1;
    this.comboUntil = 0;
    this.cooldowns = new Map();
    this.meta = new Map();
    this.bankResetAt = 0;
    this.panels = [];
    this.castleColliders = [];
    if (initialized) {
      this.buildWorld();
      this.ready = Promise.resolve();
    } else this.ready = initPhysics().then(() => this.buildWorld());
  }
  event(type, data = {}) {
    this.onEvent({ type, ...data });
  }
  addCollider(desc, metadata = {}, body) {
    const c = this.world.createCollider(
      desc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    this.meta.set(c.handle, metadata);
    return c;
  }
  trimesh(geometry, metadata = {}, friction = 0.12) {
    const a = geometryArrays(geometry);
    return this.addCollider(
      RAPIER.ColliderDesc.trimesh(a.vertices, a.indices)
        .setFriction(friction)
        .setRestitution(0.08),
      metadata,
    );
  }
  segment(a, b, r = 0.065, metadata = {}, friction = 0.02) {
    const d = new Vector3().subVectors(b, a),
      mid = new Vector3().addVectors(a, b).multiplyScalar(0.5),
      q = new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        d.clone().normalize(),
      );
    return this.addCollider(
      RAPIER.ColliderDesc.capsule(d.length() / 2, r)
        .setTranslation(mid.x, mid.y, mid.z)
        .setRotation(q)
        .setFriction(friction)
        .setRestitution(0.45),
      metadata,
    );
  }
  buildWorld() {
    this.world = new RAPIER.World(GRAVITY);
    this.world.timestep = STEP;
    this.world.numSolverIterations = 10;
    this.world.maxCcdSubsteps = 4;
    this.queue = new RAPIER.EventQueue(true);
    const floor = floorGeometry();
    this.trimesh(floor, { kind: "floor" }, 0.18);
    floor.dispose();
    WALLS.forEach((w, i) =>
      this.segment(
        vec(w[0], w[1], 0.24),
        vec(w[2], w[3], 0.24),
        i < 8 ? 0.12 : 0.065,
        { kind: "wall" },
      ),
    );
    SLINGS.forEach((points, i) => {
      const g = slingGeometry(points);
      this.trimesh(g, { kind: "sling", index: i });
      g.dispose();
    });
    BUMPERS.forEach((p, i) =>
      this.addCollider(
        RAPIER.ColliderDesc.cylinder(0.37, p.r)
          .setTranslation(p.x, 0.37, -p.y)
          .setFriction(0.15)
          .setRestitution(0.35),
        { kind: "bumper", index: i },
      ),
    );
    this.targetBodies = TARGETS.map((p, i) => {
      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          p.x,
          0.39,
          -p.y,
        ),
      );
      this.addCollider(
        RAPIER.ColliderDesc.cuboid(
          p.width / 2,
          p.height / 2,
          p.depth / 2,
        ).setRestitution(0.3),
        { kind: "target", index: i },
        rb,
      );
      return rb;
    });
    this.flipperBodies = this.flippers.map((f, i) => {
      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(f.x, 0.25, -f.y)
          .setRotation(quatY(f.side * f.angle)),
      );
      const g = flipperGeometry(f);
      this.addCollider(
        RAPIER.ColliderDesc.convexHull(geometryArrays(g).vertices)
          .setFriction(0.6)
          .setRestitution(0.3),
        { kind: "flipper", index: i },
        rb,
      );
      g.dispose();
      return rb;
    });
    RAMPS.forEach((r, side) => {
      this.trimesh(r.surface, { kind: "ramp", side }, 0.04);
      r.guards.forEach((g) =>
        this.trimesh(g, { kind: "rampGuard", side }, 0.04),
      );
      r.wires.forEach((line) => {
        for (let i = 1; i < line.length; i++)
          this.segment(
            line[i - 1],
            line[i],
            0.045,
            { kind: "wire", side },
            0.04,
          );
      });
      r.bases.forEach(g => this.addCollider(RAPIER.ColliderDesc.convexHull(geometryArrays(g).vertices).setFriction(0.02), { kind: "rampBase", side }));
      r.braces.forEach(([a,b]) => this.segment(a,b,0.045,{ kind: "brace", side }));
      r.posts.forEach((p) =>
        this.segment(new Vector3(p.x, 0, p.z), p, 0.045, { kind: "post" }),
      );
    });
    for (const s of SCOOPS) {
      const bottom = -s.depth;
      this.addCollider(
        RAPIER.ColliderDesc.cylinder(0.06, s.r)
          .setTranslation(s.x, bottom - 0.06, -s.y)
          .setFriction(0.5)
          .setRestitution(0),
        { kind: "cup", scoop: s.kind },
      );
      for (let i = 0; i < 28; i++) {
        const a = (i * Math.PI * 2) / 28,
          b = ((i + 1) * Math.PI * 2) / 28;
        this.segment(
          vec(
            s.x + Math.cos(a) * (s.r + 0.035),
            s.y + Math.sin(a) * (s.r + 0.035),
            bottom / 2,
          ),
          vec(
            s.x + Math.cos(b) * (s.r + 0.035),
            s.y + Math.sin(b) * (s.r + 0.035),
            bottom / 2,
          ),
          0.04,
          { kind: "cupWall" },
        );
        const mid = (a + b) / 2;
        this.addCollider(
          RAPIER.ColliderDesc.cuboid(0.07, s.depth / 2, 0.055)
            .setTranslation(
              s.x + Math.cos(mid) * (s.r + 0.035),
              bottom / 2,
              -s.y - Math.sin(mid) * (s.r + 0.035),
            )
            .setRotation(quatY(-mid))
            .setRestitution(0),
          { kind: "cupWall" },
        );
      }
    }
    this.plunger = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        5.05,
        0.21,
        -1.2,
      ),
    );
    this.addCollider(
      RAPIER.ColliderDesc.cuboid(0.25, 0.21, 0.11).setRestitution(0.1),
      { kind: "plunger" },
      this.plunger,
    );
  }
  installCastleMeshes(meshes) {
    for (const { vertices, indices } of meshes)
      this.castleColliders.push(
        this.addCollider(
          RAPIER.ColliderDesc.trimesh(vertices, indices)
            .setFriction(0.2)
            .setRestitution(0.1),
          { kind: "castleMesh" },
        ),
      );
  }
  start() {
    if (!this.world) throw new Error("Physics is still loading");
    for (const b of [...this.balls, ...this.lockedBalls]) this.removeBody(b);
    this.balls = [];
    this.lockedBalls = [];
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
    this.bankResetAt = 0;
    this.state = "playing";
    this.charging = false;
    this.charge = 0;
    this.inputs.left = this.inputs.right = false;
    this.cooldowns.clear();
    this.flippers.forEach((f, i) => {
      f.angle = -0.38;
      f.omega = 0;
      this.flipperBodies[i].setRotation(quatY(f.side * f.angle), true);
    });
    this.targetBodies.forEach((b, i) =>
      b.setTranslation({ x: TARGETS[i].x, y: 0.39, z: -TARGETS[i].y }, true),
    );
    this.spawn();
    this.event("start");
  }
  spawn(x = 5.05, y = 1.6, vx = 0, vy = 0, lane = true, h = RADIUS + 0.02) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, h, -y)
        .setLinvel(vx, 0, -vy)
        .setCcdEnabled(true)
        .setLinearDamping(0.005)
        .setAngularDamping(0.025)
        .setCanSleep(false),
    );
    const b = {
      id: ++this.nextId,
      x,
      y,
      h,
      vx,
      vy,
      vh: 0,
      lane,
      launched: !lane,
      age: 0,
      capture: null,
      rampSide: null,
      rampCrest: false,
      body,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      stalled: 0,
    };
    b.collider = this.addCollider(
      RAPIER.ColliderDesc.ball(RADIUS)
        .setMass(MASS)
        .setFriction(0.2)
        .setRestitution(0.08)
        .setContactSkin(0.001),
      { kind: "ball", ball: b },
      body,
    );
    this.balls.push(b);
    return b;
  }
  sync(b) {
    const p = b.body.translation(),
      v = b.body.linvel();
    b.x = p.x;
    b.y = -p.z;
    b.h = p.y;
    b.vx = v.x;
    b.vy = -v.z;
    b.vh = v.y;
    b.rotation = { ...b.body.rotation() };
  }
  removeBody(b) {
    if (b.body?.isValid()) {
      this.meta.delete(b.collider.handle);
      this.world.removeRigidBody(b.body);
    }
  }
  points(n, label, x = 0, y = 10) {
    if (this.tilted) return;
    const value = n * this.multiplier * (this.rushUntil > this.time ? 2 : 1);
    this.score += value;
    this.event("score", { value, label, x, y });
  }
  readyBall() {
    return this.balls.find((b) => b.lane && !b.launched);
  }
  beginCharge() {
    if (this.state === "playing" && this.readyBall()) this.charging = true;
  }
  launch() {
    if (this.state !== "playing") return;
    const b = this.readyBall();
    if (b) {
      b.power = this.charge;
      b.body.applyImpulse(
        { x: 0, y: 0, z: -(25 + this.charge * 20) * MASS },
        true,
      );
      b.launched = true;
      if (!b.saved && !b.hasLaunchedOnce) this.saveUntil = this.time + 12;
      b.hasLaunchedOnce = true;
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
        if (!b.lane && !b.capture)
          b.body.applyImpulse(
            {
              x: (b.x > 0 ? -1.2 : 1.2) * MASS,
              y: 0.35 * MASS,
              z: -2.5 * MASS,
            },
            true,
          );
      this.event("nudge", { danger: this.tilt > 1.8 });
    }
  }
  cooldown(key, seconds) {
    if ((this.cooldowns.get(key) || 0) > this.time) return false;
    this.cooldowns.set(key, this.time + seconds);
    return true;
  }
  rampCompleted(b, side) {
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
    if (b.capture || b.locked) return;
    b.capture = { kind, releaseAt: this.time + 1.1, phase: "holding" };
    if (kind === "lock" && this.balls.length === 1) {
      this.points(10000, "BALL LOCKED", b.x, b.y);
      this.locks++;
      if (this.locks < 3) {
        b.locked = true;
        b.capture = null;
        this.balls = this.balls.filter((v) => v !== b);
        this.lockedBalls.push(b);
        const replacement = this.spawn();
        replacement.saved = true;
        this.event("lock");
      } else {
        const released = [b, ...this.lockedBalls.toReversed()];
        this.lockedBalls = [];
        this.balls = released;
        this.locks = 0;
        released.forEach((ball, i) => {
          ball.locked = false;
          ball.capture = {
            kind: "lock",
            releaseAt: this.time + 1 + i * 0.6,
            phase: "holding",
          };
        });
        this.saveUntil = this.time + 15;
        this.event("multiball");
      }
    } else if (kind === "lock") {
      this.points(2500, "LOCK BONUS", b.x, b.y);
      this.event("lockbonus");
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
    if (!this.balls.includes(b)) return;
    this.balls = this.balls.filter((v) => v !== b);
    this.removeBody(b);
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
  hit(b, other) {
    if (!other || b.capture || b.locked) return;
    if (
      other.kind === "bumper" &&
      this.cooldown("bumper" + other.index, 0.12)
    ) {
      const p = BUMPERS[other.index],
        dx = b.x - p.x,
        dy = b.y - p.y,
        d = Math.hypot(dx, dy) || 1;
      b.body.applyImpulse(
        { x: (dx / d) * 9 * MASS, y: 0, z: (-dy / d) * 9 * MASS },
        true,
      );
      this.points(500, "POPPING!", p.x, p.y);
      this.event("bumper", { index: other.index });
    }
    if (
      other.kind === "target" &&
      !this.targets[other.index] &&
      this.cooldown("target" + other.index, 0.15)
    ) {
      this.targets[other.index] = true;
      const p = TARGETS[other.index];
      this.points(1000, "SWEET HIT", p.x, p.y);
      this.event("target", { index: other.index });
      if (this.targets.every(Boolean)) {
        this.bankResetAt = this.time + 0.8;
        this.rushUntil = this.time + 30;
        this.points(10000, "SUGAR RUSH");
        this.event("rush");
      }
    }
    if (other.kind === "sling" && this.cooldown("sling" + other.index, 0.15)) {
      b.body.applyImpulse(
        { x: (other.index === 0 ? 1 : -1) * 4 * MASS, y: 0, z: -3 * MASS },
        true,
      );
      this.points(150, "SLING", b.x, b.y);
      this.event("sling", { side: other.index });
    }
    if (other.kind === "flipper" && this.cooldown("flipper" + b.id, 0.1))
      this.event("flipper");
    if (other.kind === "wall" && this.cooldown("wall" + b.id, 0.15))
      this.event("wall");
    if (other.kind === "ramp" && b.h < 0.45 && b.y < 8.2 && b.vy > 0) {
      b.rampSide = other.side;
      b.rampCrest = false;
    }
  }
  step(dt = STEP) {
    if (this.state !== "playing") return;
    this.time += dt;
    this.world.timestep = dt;
    this.tilt = Math.max(0, this.tilt - dt * 0.18);
    if (this.charging) this.charge = Math.min(1, this.charge + dt * 0.75);
    // Return the plunger over several physics steps. Snapping it forward at
    // full charge overlaps the ball and can knock it backwards out of the lane.
    const plungerZ = this.plunger.translation().z;
    const plungerTarget = -(1.2 - this.charge * 0.6);
    this.plunger.setNextKinematicTranslation({
      x: 5.05,
      y: 0.21,
      z: plungerZ + Math.max(-20 * dt, Math.min(20 * dt, plungerTarget - plungerZ)),
    });
    this.flippers.forEach((f, i) => {
      const active =
          !this.tilted && (i === 0 ? this.inputs.left : this.inputs.right),
        old = f.angle,
        target = active ? 0.48 : -0.38;
      f.angle += Math.max(-dt * 14, Math.min(dt * 14, target - f.angle));
      f.omega = (f.angle - old) / dt;
      this.flipperBodies[i].setNextKinematicRotation(quatY(f.side * f.angle));
    });
    if (this.bankResetAt && this.time >= this.bankResetAt) {
      this.targets.fill(false);
      this.bankResetAt = 0;
    }
    this.targetBodies.forEach((b, i) =>
      b.setNextKinematicTranslation({
        x: TARGETS[i].x,
        y: this.targets[i] ? -0.4 : 0.39,
        z: -TARGETS[i].y,
      }),
    );
    this.world.step(this.queue);
    [...this.balls, ...this.lockedBalls].forEach((b) => this.sync(b));
    this.queue.drainCollisionEvents((a, c, started) => {
      if (!started) return;
      const ma = this.meta.get(a),
        mc = this.meta.get(c);
      if (ma?.kind === "ball") this.hit(ma.ball, mc);
      if (mc?.kind === "ball") this.hit(mc.ball, ma);
    });
    for (const b of [...this.balls]) {
      b.age += dt;
      if (b.capture) {
        const cap = b.capture;
        if (cap.phase === "holding" && this.time >= cap.releaseAt) {
          const v = b.body.linvel();
          b.body.applyImpulse(
            {
              x: -v.x * MASS,
              y: (cap.kind === "lock" ? 35 : 25) * MASS,
              z: -v.z * MASS,
            },
            true,
          );
          cap.phase = "rising";
          cap.timeout = this.time + 1.2;
        } else if (cap.phase === "rising" && b.h > 0.25) {
          b.body.applyImpulse(
            { x: (cap.kind === "lock" ? -3 : 1.5) * MASS, y: 0, z: 7 * MASS },
            true,
          );
          b.capture = null;
          b.scoopCooldown = this.time + 1;
        } else if (cap.phase === "rising" && this.time > cap.timeout) {
          cap.phase = "holding";
          cap.releaseAt = this.time + 0.5;
        }
        continue;
      }
      // A ball returning through the shooter gate is available to relaunch.
      if (!b.lane && b.x > 4.85 && b.y < 16.5 && b.h < 0.5) b.lane = true;
      if (b.lane) {
        if (b.x < 4.5 && b.y > 16.5) {
          b.lane = false;
          this.points(b.power > 0.8 ? 2500 : 1000, "SKILL SHOT", b.x, b.y);
        } else if (b.launched && b.y < 1.8 && Math.abs(b.vy) < 1) {
          b.launched = false;
        }
      }
      const scoop = SCOOPS.find(
        (s) => Math.hypot(b.x - s.x, b.y - s.y) < s.r && b.h < -0.23,
      );
      if (scoop && (b.scoopCooldown || 0) < this.time) {
        this.scoop(b, scoop.kind);
        continue;
      }
      if (b.y < -0.9 || b.h < -2.8 || Math.abs(b.x) > 7) {
        this.drain(b);
        continue;
      }
      if (b.rampSide !== null) {
        if (b.h > 1.8) b.rampCrest = true;
        const exit = RAMPS[b.rampSide].exit;
        if (
          b.rampCrest &&
          Math.hypot(b.x - exit.x, b.y + exit.z) < 0.8 &&
          b.h < 0.6
        ) {
          this.rampCompleted(b, b.rampSide);
          b.rampSide = null;
        } else if (b.h < 0.3 && b.y < 7 && !b.rampCrest) b.rampSide = null;
      }
      // Mechanical ball search: pulse the table after a genuinely stalled free ball.
      if (
        !b.lane &&
        Math.hypot(b.vx, b.vy, b.vh) < 0.12 &&
        !this.inputs.left &&
        !this.inputs.right
      )
        b.stalled += dt;
      else b.stalled = 0;
      if (b.stalled > 8) {
        b.stalled = 0;
        b.body.applyImpulse({ x: 0.7 * MASS, y: 2 * MASS, z: -2 * MASS }, true);
        this.event("ballsearch");
      }
    }
  }
  snapshot() {
    return {
      engine: "Rapier 3D",
      state: this.state,
      score: this.score,
      ballNumber: this.ballNumber,
      multiplier: this.multiplier,
      locks: this.locks,
      targets: [...this.targets],
      balls: this.balls.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        h: b.h,
        vx: b.vx,
        vy: b.vy,
        vh: b.vh,
        lane: b.lane,
        launched: b.launched,
        rotation: b.rotation,
        capture: b.capture ? { ...b.capture } : null,
      })),
      lockedBalls: this.lockedBalls.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        h: b.h,
      })),
      time: this.time,
      tilted: this.tilted,
      rushUntil: this.rushUntil,
    };
  }
  dispose() {
    this.queue?.free();
    this.world?.free();
  }
}
