import { test } from "node:test";
import assert from "node:assert/strict";
import { Pinball, collideSegment, TARGETS, BUMPERS } from "../src/physics.js";
const advance = (g, t) => {
  for (let i = 0; i < t * 240; i++) g.step(1 / 240);
};
test("plunger delivers a ball into the playfield", () => {
  const g = new Pinball();
  g.start();
  g.beginCharge();
  advance(g, 1);
  g.launch();
  advance(g, 1.2);
  assert.equal(g.balls[0].lane, false);
  assert(g.score >= 1000);
  assert(g.balls[0].x < 4.6);
});
test("fixed stepping stays finite for a full autonomous game", () => {
  const g = new Pinball();
  g.start();
  for (let i = 0; i < 240 * 180 && g.state === "playing"; i++) {
    if (g.balls.some((b) => b.lane && b.vy === 0)) g.launch();
    g.inputs.left = i % 140 < 40;
    g.inputs.right = i % 160 < 50;
    g.step(1 / 240);
    for (const b of g.balls) assert(Number.isFinite(b.x + b.y + b.vx + b.vy));
  }
  assert(g.score > 0);
});
test("collision reflects inward velocity and separates penetration", () => {
  const b = { x: 0, y: 0.1, vx: 1, vy: -4 };
  assert(collideSegment(b, -1, 0, 1, 0));
  assert(b.vy > 0);
  assert(b.y >= 0.26);
});
test("fresh ball save does not consume a ball", () => {
  const g = new Pinball();
  g.start();
  g.saveUntil = 12;
  g.drain(g.balls[0]);
  assert.equal(g.ballNumber, 1);
  assert.equal(g.balls.length, 1);
  assert(g.balls[0].lane);
});
test("three expired drains end the game and restart clears prior state", () => {
  const g = new Pinball();
  g.start();
  for (let i = 0; i < 3; i++) {
    g.time = 100;
    g.drain(g.balls[0]);
  }
  assert.equal(g.state, "gameover");
  assert.equal(g.balls.length, 0);
  g.start();
  assert.equal(g.ballNumber, 1);
  assert.equal(g.score, 0);
  assert.equal(g.balls.length, 1);
});
test("alternating ramps builds capped multiplier and returns to inlane", () => {
  const g = new Pinball();
  g.start();
  const b = g.balls[0];
  b.lane = false;
  for (let i = 0; i < 8; i++) {
    g.ramp(b, i % 2);
    advance(g, 2.31);
  }
  assert.equal(g.multiplier, 5);
  assert.equal(g.rampCombos, 7);
  assert.equal(b.path, null);
  assert(b.y < 5.7 && b.y > 5.4);
});
test("three locks create multiball, castle awards jackpot, one drain preserves ball number", () => {
  const g = new Pinball();
  g.start();
  const b = g.balls[0];
  b.lane = false;
  for (let i = 0; i < 3; i++) g.scoop(b, "lock");
  assert.equal(g.balls.length, 3);
  assert.equal(g.locks, 0);
  const before = g.score;
  g.scoop(b, "castle");
  assert.equal(g.score - before, 100000);
  g.drain(b);
  assert.equal(g.ballNumber, 1);
  assert.equal(g.balls.length, 2);
});
test("target bank starts timed double scoring", () => {
  const g = new Pinball();
  g.start();
  g.balls = [];
  for (const p of TARGETS) {
    const b = g.spawn(p.x, p.y - 0.29, 0, 5, false);
    g.step(1 / 240);
    g.balls = [];
  }
  assert(g.rushUntil > g.time);
  assert(g.targets.every((v) => !v));
  const score = g.score;
  g.points(100, "test");
  assert.equal(g.score - score, 200);
});
test("rapid nudging tilts and disables score and save", () => {
  const g = new Pinball();
  g.start();
  g.nudge();
  g.nudge();
  g.nudge();
  assert(g.tilted);
  g.points(1000);
  assert.equal(g.score, 0);
  g.drain(g.balls[0]);
  assert.equal(g.ballNumber, 2);
  assert(!g.tilted);
});
test("pause freezes physics, charging, and game clock", () => {
  const g = new Pinball();
  g.start();
  g.launch();
  g.pause();
  const before = JSON.stringify(g.snapshot());
  advance(g, 10);
  assert.equal(JSON.stringify(g.snapshot()), before);
  g.pause();
  advance(g, 0.1);
  assert(g.time > 0);
});
test("moving lower flipper gives an upward shot", () => {
  const g = new Pinball();
  g.start();
  g.balls = [];
  g.spawn(-1.1, 2.22, 0, -3, false);
  g.inputs.left = true;
  advance(g, 0.07);
  assert(g.balls[0].vy > 10);
});

test("multiball locks cannot grow the ball count beyond three", () => {
  const g = new Pinball();
  g.start();
  const b = g.balls[0];
  for (let i = 0; i < 15; i++) g.scoop(b, "lock");
  assert.equal(g.balls.length, 3);
});
test("relaunching a saved ball does not extend the save timer", () => {
  const g = new Pinball();
  g.start();
  g.launch();
  const end = g.saveUntil;
  g.time = 5;
  g.drain(g.balls[0]);
  g.launch();
  assert.equal(g.saveUntil, end);
});
