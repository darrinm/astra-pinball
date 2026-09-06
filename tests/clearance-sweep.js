import RAPIER from '@dimforge/rapier3d-compat';
import { RAMPS, RADIUS, STEP } from '../src/layout.js';

// Reusable in Node and Vite/Chrome, so the browser can include the Blender meshes.
export function sweepTable(g, { spacing = 0.65, seconds = 6 } = {}) {
  const seeds = [];
  for (let y = 1; y < 19.2; y += spacing)
    for (let x = -4.3; x < 4.4; x += spacing)
      for (const vx of [-5, 0, 5]) seeds.push({ x, y, h: RADIUS + 0.025, vx, vy: vx === 0 ? 0 : -4 });
  for (const r of RAMPS)
    for (let i = 5; i < r.center.length - 5; i += 10) {
      const p = r.center[i], tangent = r.curve.getTangent(i / 160);
      seeds.push({ x: p.x, y: -p.z, h: p.y + RADIUS + 0.025, vx: tangent.x * 12, vy: -tangent.z * 12 });
    }
  const clusters = new Map();
  let tested = 0, skipped = 0;
  const shape = new RAPIER.Ball(RADIUS - 0.002);
  for (const seed of seeds) {
    g.start();
    g.step(STEP);
    let obstructed = false;
    g.world.intersectionsWithShape({ x: seed.x, y: seed.h, z: -seed.y }, { x: 0, y: 0, z: 0, w: 1 }, shape,
      () => { obstructed = true; return false; }, undefined, undefined, undefined, undefined,
      c => g.meta.get(c.handle)?.kind !== 'ball');
    if (obstructed) { skipped++; continue; }
    tested++;
    const b = g.balls[0];
    b.lane = false; b.launched = true;
    b.body.setTranslation({ x: seed.x, y: seed.h, z: -seed.y }, true);
    b.body.setLinvel({ x: seed.vx, y: 0, z: -seed.vy }, true);
    const history = [];
    for (let step = 0; step < seconds / STEP; step++) {
      g.step(STEP);
      if (!g.balls.includes(b) || b.capture || b.locked || b.lane) break;
      if (step % 60 !== 0) continue;
      history.push({ x: b.x, y: b.y, h: b.h });
      if (history.length > 7) history.shift();
      if (history.length === 7 && b.y > 1 && history.every(p => Math.hypot(p.x-b.x, p.y-b.y, p.h-b.h) < 0.12)) {
        const key = [b.x,b.y,b.h].map(v => Math.round(v / 0.35)).join(':');
        const contacts = [];
        g.world.contactPairsWith(b.collider, c => contacts.push(g.meta.get(c.handle)));
        const old = clusters.get(key);
        if (old) old.count++;
        else clusters.set(key, { count: 1, at: { x: b.x, y: b.y, h: b.h }, seed, contacts });
        break;
      }
    }
  }
  g.pause();
  return { tested, skipped, seeds: seeds.length, traps: [...clusters.values()].sort((a,b) => b.count-a.count) };
}
