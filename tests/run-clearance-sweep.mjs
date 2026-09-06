import { writeFile } from 'node:fs/promises';
import { Pinball, initPhysics } from '../src/physics.js';
import { sweepTable } from './clearance-sweep.js';
await initPhysics();
const g = new Pinball();
try {
 const report = sweepTable(g);
 await writeFile('test-results/clearance-node.json', JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
} finally { g.dispose(); }
