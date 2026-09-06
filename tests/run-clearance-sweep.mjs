import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Pinball, initPhysics } from '../src/physics.js';
import { sweepTable } from './clearance-sweep.js';
await initPhysics();
const g = new Pinball();
try {
 const baseline = JSON.parse(await readFile(new URL("./clearance-baseline.json",import.meta.url)));
 const report = sweepTable(g, { regressions: baseline.traps });
 await mkdir("test-results", {recursive:true});
 await writeFile('test-results/clearance-node.json', JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 if(report.traps.length) process.exitCode=1;
} finally { g.dispose(); }
