import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pinball, initPhysics } from '../src/physics.js';
import { SCOOPS, STEP } from '../src/layout.js';
await initPhysics();
const advance = (g, seconds) => { for(let i=0;i<seconds/STEP;i++) g.step(STEP); };
function scenario(name, run) {
  test(name, () => { const g = new Pinball(); try { g.start(); run(g); } finally { g.dispose(); } });
}
scenario('pause freezes the complete rigid-body game state', g => {
  g.launch(); g.pause();
  const before = g.snapshot(); advance(g, 2);
  assert.deepEqual(g.snapshot(), before);
  g.pause(); advance(g, 0.1); assert(g.time > 0);
});
scenario('ball save keeps the life and relaunch does not extend its deadline', g => {
  g.launch(); const deadline = g.saveUntil;
  g.time = 5; g.drain(g.balls[0]);
  assert.equal(g.ballNumber, 1);
  g.launch(); assert.equal(g.saveUntil, deadline);
});
scenario('three expired drains end the game and restart removes the old bodies', g => {
  for(let i=0;i<3;i++) { g.saveUntil=0; g.drain(g.balls[0]); }
  assert.equal(g.state,'gameover'); assert.equal(g.balls.length,0);
  g.start(); assert.equal(g.ballNumber,1); assert.equal(g.score,0);
  assert.equal(g.world.bodies.len(), g.flippers.length + g.targets.length + 2);
});
scenario('rapid nudging tilts and disables awards and save', g => {
  g.nudge(); g.nudge(); g.nudge(); assert(g.tilted);
  g.points(1000); assert.equal(g.score,0);
  g.drain(g.balls[0]); assert.equal(g.ballNumber,2); assert(!g.tilted);
});
scenario('three physical lock captures release the same three rigid bodies', g => {
  const lock = SCOOPS.find(s=>s.kind==='lock'), ids=[];
  for(let i=0;i<3;i++) {
    const b=g.balls[0]; ids.push(b.id); b.lane=false;
    b.body.setTranslation({x:lock.x,y:0.5,z:-lock.y},true);
    b.body.setLinvel({x:0,y:0,z:0},true);
    for(let j=0;j<240 && !b.locked && !b.capture;j++) g.step(STEP);
    assert(i===2 ? g.balls.length===3 : g.lockedBalls.length===i+1);
  }
  assert.deepEqual(g.balls.map(b=>b.id).sort(),ids.sort());
  advance(g,3); assert(g.balls.every(b=>!b.capture));
});
for (const side of [-1, 1]) scenario(`${side < 0 ? 'left' : 'right'} powered flipper drives a full-table shot`, g => {
  const b=g.balls[0]; b.lane=false;
  b.body.setTranslation({x:side*1.1,y:0.2,z:-2.22},true);
  b.body.setLinvel({x:0,y:0,z:3},true);
  g.inputs[side < 0 ? 'left' : 'right']=true; advance(g,0.08);
  assert(b.vy>35, `uphill speed was ${b.vy}`);
  assert(b.vy<55, 'the powered stroke must remain controlled');
  let furthest=b.y;
  for(let i=0;i<480 && g.balls.includes(b);i++) { g.step(STEP); furthest=Math.max(furthest,b.y); }
  assert(furthest>13, `shot only reached ${furthest}`);
});
scenario('extended play keeps rigid-body positions and velocities finite', g => {
  for(let i=0;i<240*60 && g.state==='playing';i++) {
    if(g.readyBall()) {g.charge=1;g.launch();}
    g.inputs.left=i%140<40; g.inputs.right=i%160<50;
    g.step(STEP);
    for(const b of g.balls) assert(Number.isFinite(b.x+b.y+b.h+b.vx+b.vy+b.vh));
  }
  assert(g.score>0);
});
