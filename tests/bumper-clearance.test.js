import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pinball, initPhysics } from '../src/physics.js';
await initPhysics();

test('ball clears the middle-left bumper and outer rail without ball search or nudging', () => {
  for (const x of [-4.3, -4.22, -4.1]) {
    const g = new Pinball();
    try {
      g.start();
      const b = g.balls[0];
      b.lane = false;
      b.body.setTranslation({ x, y: 0.2, z: -14.7 }, true);
      b.body.setLinvel({ x: 0, y: 0, z: 3 }, true);
      let cleared = false;
      // Stop before the eight-second automatic ball-search timeout.
      for (let i = 0; i < 3 * 240; i++) {
        g.step(1 / 240);
        if (b.y < 12.5) { cleared = true; break; }
      }
      assert(cleared, `ball at x=${x} must roll past the bumper`);
    } finally { g.dispose(); }
  }
});

test('upper-left ramp support leaves the outer orbit clear', () => {
  for (const x of [-4.1, -4, -3.9]) {
    const g = new Pinball();
    try {
      g.start();
      const b = g.balls[0];
      b.lane = false;
      b.body.setTranslation({ x, y: 0.2, z: -18.04 }, true);
      b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      let cleared = false;
      for (let i = 0; i < 3 * 240; i++) {
        g.step(1 / 240);
        if (b.y < 16) { cleared = true; break; }
      }
      assert(cleared, `ball at x=${x} must roll past the upper support`);
    } finally { g.dispose(); }
  }
});

test('fully charged plunger sends settled balls up the lane instead of ejecting them backwards', () => {
  for (const delay of [0, 0.25, 0.5, 1, 2]) {
    const g = new Pinball();
    try {
      g.start();
      for (let i = 0; i < delay * 240; i++) g.step(1 / 240);
      g.beginCharge();
      for (let i = 0; i < 360; i++) g.step(1 / 240);
      assert.equal(g.charge, 1);
      g.launch();
      const b = g.balls[0];
      for (let i = 0; i < 3 * 240 && b.lane; i++) {
        g.step(1 / 240);
        assert(b.y > 0.6, 'ball must not leave the bottom of the shooter lane');
        assert(g.balls.includes(b), 'the launched ball must remain in play');
      }
      assert.equal(b.lane, false, 'full-power launch must enter the main playfield');
    } finally { g.dispose(); }
  }
});
