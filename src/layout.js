import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

// Table coordinates: x across, y uphill, h above the playfield.
// One table unit = 5 cm. Gravity is expressed in these same units.
export const RADIUS = 0.19;
export const STEP = 1 / 240;
export const GRAVITY = { x: 0, y: -194.9, z: 22.2 };
export const BUMPERS = [
  { x: -3.05, y: 15.9, r: 0.65 },
  // Leave a full ball-width lane between the bumper skirt and the outer rail.
  { x: -3.3, y: 13.8, r: 0.65 },
  { x: -2.4, y: 12.4, r: 0.65 },
];
export const TARGETS = Array.from({ length: 5 }, (_, i) => ({
  x: -3.8 + i * 0.49,
  y: 9.45 + i * 0.11,
  r: 0.23,
  width: 0.34,
  depth: 0.18,
  height: 0.65,
}));
export const FLIPPERS = [
  { x: -2.12, y: 2.35, side: 1, length: 1.7 },
  { x: 2.12, y: 2.35, side: -1, length: 1.7 },
  { x: 3.85, y: 11.65, side: -1, length: 1.05 },
];
export const SLINGS = [-1, 1].map((s) => [
  [s * 3.4, 6.5],
  [s * 3.25, 4.1],
  [s * 2.25, 3.6],
]);
export const WALLS = [
  [-4.65, 2.8, -4.65, 17.2],
  [-4.65, 17.2, -4, 18.9],
  [-4, 18.9, 3.8, 19.35],
  [3.8, 19.35, 4.55, 19.1],
  [4.55, 19.1, 5.1, 18.7],
  [5.1, 18.7, 5.5, 18.05],
  [5.5, 18.05, 5.5, 0.6],
  [4.6, 0.6, 4.6, 17.3],
  [-4.65, 2.8, -3.75, 1.3],
  [-3.75, 1.3, -1.18, 0.1],
  [4.6, 3, 3.7, 1.3],
  [3.7, 1.3, 1.18, 0.1],
  [-3.83, 3.6, -1.75, 2.55],
  [3.83, 3.6, 1.75, 2.55],
  [-3.83, 3.6, -3.95, 6.2],
  [3.83, 3.6, 3.95, 6.2],
  [-1.35, 13.5, -1.35, 16.6],
  [-1.35, 16.6, 0, 17.3],
  [0, 17.3, 1.35, 16.6],
  [1.35, 16.6, 1.35, 13.5],
  [-1.35, 13.5, -0.55, 13.1],
  [0.55, 13.1, 1.35, 13.5],
];
export const SCOOPS = [
  { kind: "castle", x: 0, y: 13.15, r: 0.47, depth: 0.85 },
  { kind: "lock", x: 3.05, y: 15.1, r: 0.44, depth: 1.9 },
  { kind: "swirl", x: 1.55, y: 9.1, r: 0.39, depth: 0.85 },
];
export const vec = (x, y, h = 0) => new THREE.Vector3(x, h, -y);
export function floorGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-5.125, -0.85);
  shape.lineTo(5.825, -0.85);
  shape.lineTo(5.825, 19.85);
  shape.lineTo(-5.125, 19.85);
  shape.closePath();
  for (const s of SCOOPS) {
    const hole = new THREE.Path();
    hole.absarc(s.x, s.y, s.r, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const drain = new THREE.Path();
  drain.moveTo(-0.7, -0.5);
  drain.lineTo(-0.7, 0.65);
  drain.lineTo(0.7, 0.65);
  drain.lineTo(0.7, -0.5);
  drain.closePath();
  shape.holes.push(drain);
  const g = new THREE.ShapeGeometry(shape, 40);
  g.rotateX(-Math.PI / 2);
  const uv = g.getAttribute("uv"),
    p = g.getAttribute("position");
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, (p.getX(i) + 5.125) / 10.95, (-p.getZ(i) + 0.85) / 20.7);
  return g;
}
export function flipperGeometry(f) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 0.2, Math.PI / 2, Math.PI * 1.5, false);
  shape.lineTo(f.length, -0.14);
  shape.absarc(f.length, 0, 0.14, -Math.PI / 2, Math.PI / 2, false);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.24,
    bevelEnabled: false,
    curveSegments: 12,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -0.12, 0);
  if (f.side < 0) g.scale(-1, 1, 1);
  g.computeVertexNormals();
  return g;
}
export function slingGeometry(points) {
  const shape = new THREE.Shape(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
  );
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: false,
  });
  g.rotateX(-Math.PI / 2);
  return g;
}
function strip(pointsA, pointsB) {
  const pos = [],
    idx = [];
  for (let i = 0; i < pointsA.length; i++) {
    pos.push(...pointsA[i].toArray(), ...pointsB[i].toArray());
    if (i < pointsA.length - 1) {
      const n = i * 2;
      idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export function rampDefinition(side) {
  const s = side === 0 ? -1 : 1;
  const curve = new THREE.CatmullRomCurve3([
    vec(s * 2.65, 7.1, 0),
    vec(s * 2.76, 7.8, 0.06),
    vec(s * 3.05, 9, 0.55),
    vec(s * 2.2, 11.5, 1.35),
    vec(s * 1.9, 14.2, 1.95),
    vec(s * 2.8, 17.25, 2.25),
    vec(s * 3.9, 17.3, 2.05),
    vec(s * 4.12, 14.2, 1.7),
    vec(s * 4.12, 10, 1.1),
    vec(s * 3.55, 5.6, 0.65),
  ]);
  const samples = 160,
    returnStart = 112,
    left = [],
    right = [],
    leftTop = [],
    rightTop = [],
    wireA = [],
    wireB = [],
    center = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples,
      p = curve.getPoint(t),
      tan = curve.getTangent(t),
      across = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    center.push(p);
    left.push(p.clone().addScaledVector(across, 0.37));
    right.push(p.clone().addScaledVector(across, -0.37));
    leftTop.push(left[i].clone().add(new THREE.Vector3(0, 0.4, 0)));
    rightTop.push(right[i].clone().add(new THREE.Vector3(0, 0.4, 0)));
    wireA.push(p.clone().addScaledVector(across, 0.13));
    wireB.push(p.clone().addScaledVector(across, -0.13));
  }
  const surface = strip(
    left.slice(0, returnStart + 1),
    right.slice(0, returnStart + 1),
  );
  const guards = [strip(left, leftTop), strip(rightTop, right)];
  const posts = [], braces = [];
  for (let i = 28; i < samples - 10; i += 25) {
    const mount = (Math.abs(left[i].x) < Math.abs(right[i].x) ? left[i] : right[i]).clone();
    const p = mount.clone();
    // Castle-adjacent legs sit behind its guard rail; elevated braces carry the ramp.
    if (i === 78) p.x = s * 0.7;
    posts.push(p);
    if (p.distanceTo(mount) > 0.01) braces.push([p.clone(), mount]);
  }
  // Solid lower ramp bases prevent free balls entering a narrowing underside gap.
  const skirtEnd = center.findIndex(p => p.y > 0.65);
  const ground = points => points.map(p => new THREE.Vector3(p.x, -0.02, p.z));
  const bases = [];
  for (let i = 0; i < skirtEnd; i++) {
    const top = [left[i], right[i], left[i+1], right[i+1]];
    bases.push(new ConvexGeometry([...top, ...ground(top)]));
  }
  const a = left[skirtEnd], b = right[skirtEnd];
  const nose = a.clone().add(b).multiplyScalar(0.5);
  nose.z -= 0.65;
  const cap = [a, nose, b];
  bases.push(new ConvexGeometry([...cap, ...ground(cap)]));
  return {
    curve,
    surface,
    guards,
    leftTop,
    rightTop,
    wires: [wireA.slice(returnStart - 1), wireB.slice(returnStart - 1)],
    posts,
    braces,
    bases,
    entrance: curve.getPoint(0),
    exit: curve.getPoint(1),
    crest: curve.getPoint(0.54),
    center,
  };
}
export const RAMPS = [rampDefinition(0), rampDefinition(1)];
export function geometryArrays(geometry) {
  const p = geometry.getAttribute("position");
  return {
    vertices: new Float32Array(p.array),
    indices: geometry.index
      ? new Uint32Array(geometry.index.array)
      : Uint32Array.from({ length: p.count }, (_, i) => i),
  };
}

// Closed foundation under the castle keeps balls out of its decorative mesh interior.
export function castleBaseGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0,13.8);
  for (const [x,y] of [[1.3,14],[1.3,16.5],[0,17.15],[-1.3,16.5],[-1.3,14]]) shape.lineTo(x,y);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape,{depth:0.3,bevelEnabled:false});
  geometry.rotateX(-Math.PI/2);
  return geometry;
}
