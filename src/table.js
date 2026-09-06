import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  BUMPERS,
  TARGETS,
  WALLS,
  RADIUS,
  FLIPPERS,
  SLINGS,
  SCOOPS,
  RAMPS,
  floorGeometry,
  castleBaseGeometry,
  flipperGeometry,
  slingGeometry,
  geometryArrays,
} from "./layout.js";
const V = (x, y, h = 0) => new THREE.Vector3(x, h, -y);
export class Table {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#261c2a");
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = 0.5;
    room.dispose();
    pmrem.dispose();
    this.camera = new THREE.OrthographicCamera(-6.2, 6.2, 11, -11, 0.1, 100);
    this.view = 1;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.balls = new Map();
    this.ballShadows = new Map();
    this.particles = [];
    this.lamps = [];
    this.bumpers = [];
    this.targets = [];
    this.targetLabels = [];
    this.flippers = [];
    this.clock = 0;
    this.shake = 0;
    this.materials = {
      pink: this.mat("#d94f82", 0.28),
      cream: this.mat("#fff0cc", 0.22),
      red: this.mat("#c72b55", 0.24),
      gold: this.mat("#c8934b", 0.28, 0.75),
      chrome: this.mat("#b3c2c6", 0.17, 0.95),
      dark: this.mat("#3a1526", 0.32),
      mint: this.mat("#66d8c5", 0.24),
      chocolate: this.mat("#542a21", 0.23),
    };
    this.build();
    this.assetReady = Promise.all([this.assetReady, this.artReady]);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
  }
  mat(color, roughness = 0.3, metalness = 0.12, extra = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      ...extra,
    });
  }
  mesh(geo, mat, x, y, h = 0, parent = this.root) {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(V(x, y, h));
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  box(w, d, h, x, y, z, mat, r = 0.08, parent) {
    return this.mesh(
      new RoundedBoxGeometry(w, h, d, 2, r),
      mat,
      x,
      y,
      z,
      parent,
    );
  }
  cyl(r, h, x, y, z, mat, rt = r, parent) {
    return this.mesh(
      new THREE.CylinderGeometry(rt, r, h, 32),
      mat,
      x,
      y,
      z,
      parent,
    );
  }
  sphere(r, x, y, z, mat, parent) {
    return this.mesh(new THREE.SphereGeometry(r, 20, 12), mat, x, y, z, parent);
  }
  line(points, mat, r = 0.045, parent = this.root) {
    const curve = new THREE.CatmullRomCurve3(points);
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        Math.max(20, points.length * 8),
        r,
        8,
        false,
      ),
      mat,
    );
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  label(
    text,
    x,
    y,
    w = 2,
    h = 0.45,
    color = "#ffe9b5",
    bg = "#401b2c",
    height = 0.025,
  ) {
    const c = document.createElement("canvas");
    c.width = Math.round((128 * w) / h);
    c.height = 128;
    const ctx = c.getContext("2d");
    if (bg) {
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(0, 0, c.width, 128, 24);
      ctx.fill();
      ctx.strokeStyle = "#c89962";
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.font = "bold 66px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, c.width / 2, 68, c.width - 24);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = this.mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: t,
        transparent: true,
        depthWrite: false,
      }),
      x,
      y,
      height,
    );
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  peppermint() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const a = c.getContext("2d");
    a.fillStyle = "#fff1d5";
    a.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 10; j++) {
      a.fillStyle = j % 2 ? "#ffb2be" : "#e73258";
      a.beginPath();
      a.moveTo(128, 128);
      for (let k = 0; k <= 35; k++) {
        let r = (k / 35) * 184,
          ang = (j * Math.PI) / 5 + (0.6 * k) / 35;
        a.lineTo(128 + Math.cos(ang) * r, 128 + Math.sin(ang) * r);
      }
      for (let k = 35; k >= 0; k--) {
        let r = (k / 35) * 184,
          ang = (j * Math.PI) / 5 + 0.27 + (0.6 * k) / 35;
        a.lineTo(128 + Math.cos(ang) * r, 128 + Math.sin(ang) * r);
      }
      a.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  fieldTexture() {
    let loaded, failed;
    this.artReady = new Promise((resolve, reject) => {
      loaded = resolve;
      failed = reject;
    });
    const texture = new THREE.TextureLoader().load(
      "/assets/playfield-art.png",
      loaded,
      undefined,
      failed,
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    return texture;
  }
  lamp(x, y, color = 0x87efce, r = 0.13) {
    const mat = this.mat(color, 0.22, 0.1, {
      emissive: color,
      emissiveIntensity: 0.4,
    });
    this.cyl(r + 0.065, 0.035, x, y, 0.025, this.materials.gold);
    const m = this.cyl(r, 0.04, x, y, 0.055, mat);
    m.userData = { base: 0.4 };
    this.lamps.push(m);
    return m;
  }
  build() {
    const m = this.materials;
    this.scene.add(new THREE.HemisphereLight("#ffe9e2", "#4f3a69", 1.1));
    const key = new THREE.DirectionalLight("#ffe4bd", 2.1);
    key.position.set(-6, 15, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, {
      left: -9,
      right: 9,
      top: 15,
      bottom: -15,
      near: 0.1,
      far: 50,
    });
    key.target.position.set(0, 0, -10);
    key.shadow.bias = -0.0007;
    key.shadow.normalBias = 0.03;
    this.scene.add(key, key.target);
    const fill = new THREE.DirectionalLight("#90dfef", 1.1);
    fill.position.set(7, 8, -17);
    this.scene.add(fill);
    this.box(11.65, 21.4, 0.25, 0.35, 9.5, -2.1, m.dark, 0.1);
    this.mesh(
      floorGeometry(),
      this.mat("#ffffff", 0.55, 0, {
        map: this.fieldTexture(),
        side: THREE.DoubleSide,
      }),
      0,
      0,
      0,
    );
    // cabinet edge, inset chrome rails, and striped candy trim
    const outline = [
      [-5.05, -0.65],
      [-5.35, 0.1],
      [-5.35, 18.8],
      [-4.8, 19.8],
      [4.9, 19.8],
      [5.9, 18.8],
      [5.9, -0.1],
      [5.3, -0.7],
      [-5.05, -0.65],
    ].map(([x, y]) => V(x, y, 0.23));
    this.line(outline, m.pink, 0.22);
    this.line(
      outline.map((p) => p.clone().add(new THREE.Vector3(0, 0.16, 0))),
      m.gold,
      0.035,
    );
    for (const side of [-1, 1]) {
      const x = side < 0 ? -5.28 : 5.83;
      for (let i = 0; i < 33; i++) {
        const o = this.box(
          0.34,
          0.27,
          0.1,
          x,
          0.05 + i * 0.59,
          0.44,
          i % 2 ? m.cream : m.red,
          0.035,
        );
        o.rotation.y = 0.5;
      }
    }
    WALLS.forEach((w, i) => {
      this.line(
        [V(w[0], w[1], 0.24), V(w[2], w[3], 0.24)],
        i < 8 ? m.cream : m.chrome,
        i < 8 ? 0.12 : 0.065,
      );
      if (i < 8)
        this.line([V(w[0], w[1], 0.34), V(w[2], w[3], 0.34)], m.red, 0.036);
    });
    // Rails supported by metal posts.
    for (const side of [-1, 1])
      for (let y = 3; y < 19; y += 2.4) {
        this.cyl(0.085, 0.45, side * 4.62, y, 0.22, m.gold);
        this.sphere(0.105, side * 4.62, y, 0.46, m.cream);
      }
    const mintMap = this.peppermint();
    const candy = this.mat("#ffffff", 0.2, 0.12, { map: mintMap });
    this.mesh(castleBaseGeometry(), m.cream, 0, 0, 0);
    BUMPERS.forEach((p) => {
      const g = new THREE.Group();
      g.position.copy(V(p.x, p.y));
      this.root.add(g);
      this.cyl(0.65, 0.16, 0, 0, 0.1, m.gold, undefined, g);
      this.cyl(0.63, 0.35, 0, 0, 0.32, m.red, undefined, g);
      this.cyl(0.65, 0.09, 0, 0, 0.36, m.cream, undefined, g);
      const top = this.cyl(0.65, 0.2, 0, 0, 0.62, candy, 0.54, g);
      this.sphere(0.13, 0, 0, 0.78, m.cream, g);
      this.bumpers.push({ g, top, flash: 0 });
      for (let i = 0; i < 3; i++)
        this.lamp(
          p.x + Math.cos(i * 2.094) * 0.87,
          p.y + Math.sin(i * 2.094) * 0.87,
          0x8fefb5,
          0.085,
        );
    });
    const colors = ["#79d19e", "#ae76cd", "#f486ae", "#eda33c", "#62c6df"];
    TARGETS.forEach((p, i) => {
      this.box(0.45, 0.46, 0.12, p.x, p.y, 0.06, m.gold);
      const target = this.box(
        0.34,
        0.18,
        0.65,
        p.x,
        p.y,
        0.39,
        this.mat(colors[i], 0.22),
        0.08,
      );
      this.targets.push(target);
      this.targetLabels.push(
        this.label(
          ["S", "U", "G", "A", "R"][i],
          p.x,
          p.y - 0.04,
          0.23,
          0.28,
          "#fff5d6",
          null,
          0.73,
        ),
      );
    });
    this.label("SUGAR RUSH", -2.8, 8.85, 2.55, 0.46);
    SLINGS.forEach((pts, side) => {
      this.mesh(slingGeometry(pts), m.pink, 0, 0, 0);
      this.line(
        [...pts, pts[0]].map(([x, y]) => V(x, y, 0.39)),
        m.cream,
        0.06,
      );
      for (const [x, y] of pts) {
        this.cyl(0.15, 0.48, x, y, 0.24, m.gold);
        this.sphere(0.16, x, y, 0.5, m.cream);
      }
      this.cyl(0.32, 0.035, side === 0 ? -3 : 3, 4.8, 0.36, candy);
    });
    for (const f of FLIPPERS) {
      const g = new THREE.Group();
      g.position.copy(V(f.x, f.y, 0.25));
      this.root.add(g);
      this.mesh(flipperGeometry(f), m.pink, 0, 0, 0, g);
      const top = flipperGeometry(f);
      top.scale(0.94, 0.08, 0.67);
      this.mesh(top, m.cream, 0, 0, 0.125, g);
      this.cyl(0.2, 0.3, 0, 0, 0, m.gold, undefined, g);
      this.cyl(0.17, 0.04, 0, 0, 0.18, candy, undefined, g);
      this.flippers.push(g);
    }
    this.rampCurves = RAMPS.map((r) => r.curve);
    RAMPS.forEach((r, side) => {
      const material = new THREE.MeshPhysicalMaterial({
        color: side === 0 ? "#76e7d4" : "#ef679f",
        metalness: 0.2,
        roughness: 0.18,
        transparent: true,
        opacity: 0.64,
        side: THREE.DoubleSide,
        clearcoat: 1,
      });
      this.mesh(r.surface.clone(), material, 0, 0, 0);
      for (const guard of r.guards) this.mesh(guard.clone(), material, 0, 0, 0);
      this.line(r.leftTop, m.gold, 0.04);
      this.line(r.rightTop, m.gold, 0.04);
      for (const wire of r.wires) this.line(wire, m.chrome, 0.045);
      for (const g of r.bases) this.root.add(new THREE.Mesh(g.clone(), m.gold));
      for (const [a,b] of r.braces) this.line([a,b], m.gold, 0.045);
      for (const p of r.posts) this.cyl(0.045, p.y, p.x, -p.z, p.y / 2, m.gold);
      const x = side === 0 ? -2.65 : 2.65;
      this.label(
        side === 0 ? "MINT LOOP" : "BERRY LOOP",
        x,
        6.6,
        1.5,
        0.32,
        side === 0 ? "#92ffdc" : "#ffb7d2",
      );
      this.lamp(x, 6.08, side === 0 ? 0x75ffd6 : 0xff77ad, 0.18);
    });
    // Castle is a purpose-built Blender model, not a flat illustration.
    this.assetReady = new GLTFLoader()
      .loadAsync("/assets/candy-castle.glb")
      .then((gltf) => {
        const castle = gltf.scene;
        castle.position.copy(V(0, 15, 0.02));
        castle.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        this.root.add(castle);
        this.castle = castle;
        this.root.updateMatrixWorld(true);
        this.castleCollision = [];
        castle.traverse((o) => {
          if (o.isMesh) {
            const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
            this.castleCollision.push(geometryArrays(geometry));
            geometry.dispose();
          }
        });
        this.optimizeStatic();
      })
      .catch((e) => {
        console.error("Castle asset failed", e);
        throw e;
      });

    this.label("JACKPOT", 0, 12.52, 1.6, 0.38);
    this.jackpotLamp = this.lamp(0, 11.95, 0xffb663, 0.19);

    this.label("LOCK", 3.1, 14.35, 1.05, 0.34);
    this.lockLamps = [0, 1, 2].map((i) =>
      this.lamp(2.55 + i * 0.43, 16, 0xff96bd, 0.12),
    );
    this.label("MULTIBALL", 3.1, 16.5, 1.7, 0.34);
    for (const scoop of SCOOPS) {
      const cup = new THREE.CylinderGeometry(
        scoop.r,
        scoop.r,
        scoop.depth,
        32,
        1,
        true,
      );
      this.mesh(
        cup,
        this.mat("#160b10", 0.6, 0, { side: THREE.DoubleSide }),
        scoop.x,
        scoop.y,
        -scoop.depth / 2,
      );
      this.cyl(scoop.r, 0.06, scoop.x, scoop.y, -scoop.depth, m.dark);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(scoop.r, 0.035, 8, 48),
        m.gold,
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(V(scoop.x, scoop.y, 0.02));
      this.root.add(ring);
    }
    const swirl = SCOOPS.find(s => s.kind === "swirl");
    this.label("CHOCO SWIRL", swirl.x, swirl.y - 0.7, 1.6, 0.3);
    this.multLamps = [1, 2, 3].map((n, i) => {
      this.label(
        ["2×", "3×", "5×"][i],
        0,
        9.6 - i * 0.8,
        0.65,
        0.52,
        "#ffeeae",
        "#3c4339",
      );
      return this.lamp(0.55, 9.6 - i * 0.8, 0x93edc7, 0.1);
    });
    this.label("CANDYLAND", 0, 4.9, 3.0, 0.63, "#ffe5c7", null);
    this.label("P I N B A L L", 0, 4.3, 2.1, 0.28, "#e49bb1", null);

    this.line(
      [
        V(-0.7, 0.2, 0.1),
        V(-0.66, 0.55, 0.1),
        V(0, 0.68, 0.1),
        V(0.66, 0.55, 0.1),
        V(0.7, 0.2, 0.1),
      ],
      m.gold,
      0.05,
    );
    this.label("SHOOT AGAIN", 0, 1.1, 1.6, 0.25, "#ffc9af", null);
    this.saveLamp = this.lamp(0, 1.65, 0x8dffd4, 0.11);
    // Mechanical plunger, spring, and polished launch lane.
    this.box(0.55, 17, 0.045, 5.05, 9.6, 0.025, m.dark);
    this.line([V(5.05, 0.15, 0.25), V(5.05, 2.2, 0.25)], m.chrome, 0.08);
    const spring = [];
    for (let i = 0; i < 240; i++) {
      const t = i / 239;
      spring.push(
        V(
          5.05 + Math.cos(t * Math.PI * 32) * 0.19,
          0.4 + t * 1.5,
          0.25 + Math.sin(t * Math.PI * 32) * 0.19,
        ),
      );
    }
    this.line(spring, m.chrome, 0.025);
    this.plunger = this.cyl(0.25, 0.2, 5.05, 1.05, 0.23, m.pink);
    this.plunger.rotation.x = Math.PI / 2;
    // Lollipop trees and jewel-like gumdrops beyond the active lanes.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = side * 4.92,
          y = 7.5 + i * 2;
        this.cyl(0.045, 0.65, x, y, 0.32, m.cream);
        const pop = this.sphere(0.24, x, y, 0.77, i % 2 ? m.pink : m.mint);
        pop.scale.y = 0.65;
      }
      for (let i = 0; i < 5; i++) {
        const x = side * (1.8 + i * 0.57),
          y = 0.25 + Math.sin(i) * 0.18;
        this.cyl(0.22, 0.34, x, y, 0.18, this.mat(colors[i], 0.32), 0.12);
      }
    }
    for (let i = 0; i < 46; i++) {
      const x = (i % 2 ? -1 : 1) * 4.88,
        y = 0.5 + Math.floor(i / 2) * 0.83;
      this.lamp(x, y, i % 3 === 0 ? 0xffabc4 : 0xf6cf89, 0.04);
    }
    this.label(
      "C A N D Y L A N D",
      0.1,
      18.85,
      4.8,
      0.55,
      "#ffd7cb",
      "#52182e",
      0.36,
    );
  }
  optimizeStatic() {
    this.root.updateMatrixWorld(true);
    const dynamic = new Set([
      ...this.flippers,
      ...this.targets,
      ...this.targetLabels,
      ...this.lockLamps,
      ...this.multLamps,
      this.saveLamp,
      this.jackpotLamp,
      this.plunger,
      ...this.bumpers.map((b) => b.g),
    ]);
    const isDynamic = (o) => {
      for (let p = o; p && p !== this.root; p = p.parent)
        if (dynamic.has(p)) return true;
      return false;
    };
    const batches = new Map(),
      removed = [];
    this.root.traverse((o) => {
      if (!o.isMesh || isDynamic(o) || Array.isArray(o.material)) return;
      const m = o.material;
      const key = [
        m.type,
        m.color?.getHex(),
        m.emissive?.getHex(),
        m.emissiveIntensity,
        m.roughness,
        m.metalness,
        m.map?.uuid,
        m.transparent,
        m.opacity,
        m.side,
        m.depthWrite,
      ].join("|");
      if (!batches.has(key)) batches.set(key, { material: m, geos: [] });
      let g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      for (const name of Object.keys(g.attributes))
        if (!["position", "normal", "uv"].includes(name))
          g.deleteAttribute(name);
      if (!g.attributes.uv)
        g.setAttribute(
          "uv",
          new THREE.BufferAttribute(
            new Float32Array(g.attributes.position.count * 2),
            2,
          ),
        );
      batches.get(key).geos.push(g);
      removed.push(o);
    });
    for (const o of removed) o.removeFromParent();
    for (const batch of batches.values()) {
      const geo = mergeGeometries(batch.geos);
      if (geo) {
        const mesh = new THREE.Mesh(geo, batch.material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.root.add(mesh);
      }
      batch.geos.forEach((g) => g.dispose());
    }
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
  }
  resize() {
    const w = this.canvas.parentElement.clientWidth;
    const h = this.canvas.parentElement.clientHeight;
    if (w < 1 || h < 1) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    if (this.view === 1) {
      // Fit the complete cabinet in camera space, including raised mechanisms.
      this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 150);
      const target = new THREE.Vector3(0.3, 0.65, -9.5);
      const direction = new THREE.Vector3(0, 24, 26).normalize();
      this.camera.position.copy(target).add(direction);
      this.camera.lookAt(target);
      this.camera.updateMatrixWorld(true);
      const right = new THREE.Vector3().setFromMatrixColumn(
        this.camera.matrixWorld,
        0,
      );
      const up = new THREE.Vector3().setFromMatrixColumn(
        this.camera.matrixWorld,
        1,
      );
      const tanV = Math.tan(THREE.MathUtils.degToRad(20));
      const tanH = tanV * aspect;
      let distance = 0;
      for (const x of [-5.65, 6.15]) {
        for (const y of [-1, 0.7]) {
          for (const z of [-20.2, 1]) {
            const delta = new THREE.Vector3(x, y, z).sub(target);
            const depth = delta.dot(direction);
            distance = Math.max(
              distance,
              Math.abs(delta.dot(right)) / tanH + depth,
              Math.abs(delta.dot(up)) / tanV + depth,
            );
          }
        }
      }
      this.camera.position
        .copy(target)
        .addScaledVector(direction, distance * 1.025);
      this.camera.lookAt(target);
    } else {
      const halfW = Math.max(6.05, 10.3 * aspect);
      this.camera = new THREE.OrthographicCamera(
        -halfW,
        halfW,
        halfW / aspect,
        -halfW / aspect,
        0.1,
        100,
      );
      this.camera.position.set(
        0,
        this.view === 2 ? 35 : 32,
        this.view === 2 ? -9.5 : 0,
      );
      this.camera.lookAt(0.3, 0, -9.5);
    }
    this.camera.updateProjectionMatrix();
    if (this.view === 1) {
      this.camera.updateMatrixWorld(true);
      const projected = [];
      // Use the cabinet and castle bounds separately, avoiding empty volume above the table.
      for (const [xs, ys, zs] of [
        [
          [-5.65, 6.15],
          [-1, 0.7],
          [-20.2, 1],
        ],
        [
          [-1.5, 1.5],
          [0, 3.5],
          [-17, -13],
        ],
      ]) {
        for (const x of xs)
          for (const y of ys)
            for (const z of zs)
              projected.push(new THREE.Vector3(x, y, z).project(this.camera));
      }
      const minX = Math.min(...projected.map((p) => p.x));
      const maxX = Math.max(...projected.map((p) => p.x));
      const minY = Math.min(...projected.map((p) => p.y));
      const maxY = Math.max(...projected.map((p) => p.y));
      this.camera.zoom = Math.min(1.94 / (maxX - minX), 1.94 / (maxY - minY));
      this.camera.updateProjectionMatrix();
      this.camera.setViewOffset(
        w,
        h,
        ((minX + maxX) / 4) * this.camera.zoom * w,
        (-(minY + maxY) / 4) * this.camera.zoom * h,
        w,
        h,
      );
    }
    this.controls?.dispose();
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0.3, this.view === 1 ? 0.65 : 0, -9.5);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 85;
    this.controls.minZoom = 0.45;
    this.controls.maxZoom = 4;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.08;
    this.controls.rotateSpeed = 0.65;
    this.controls.update();
    this.setPanMode(this.panMode || false);
  }
  setPanMode(enabled) {
    this.panMode = enabled;
    this.controls.mouseButtons.LEFT = enabled
      ? THREE.MOUSE.PAN
      : THREE.MOUSE.ROTATE;
    this.controls.touches.ONE = enabled ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    this.canvas.style.cursor = enabled ? "move" : "grab";
  }
  zoomBy(factor) {
    if (this.camera.isPerspectiveCamera) {
      const offset = this.camera.position.clone().sub(this.controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, 8, 85));
      this.camera.position.copy(this.controls.target).add(offset);
    } else {
      this.camera.zoom = THREE.MathUtils.clamp(
        this.camera.zoom / factor,
        0.45,
        4,
      );
      this.camera.updateProjectionMatrix();
    }
    this.controls.update();
  }
  burst(x, y, color = 0xffc0d7, count = 12) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 5, 4),
        new THREE.MeshBasicMaterial({ color, transparent: true }),
      );
      mesh.position.copy(V(x, y, 0.35));
      this.root.add(mesh);
      this.particles.push({
        mesh,
        life: 0.65,
        v: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3,
          (Math.random() - 0.5) * 4,
        ),
      });
    }
  }
  update(game, dt) {
    this.clock += dt;
    this.flippers.forEach((g, i) => {
      const f = game.flippers[i];
      g.rotation.y = f.side * f.angle;
    });
    this.targets.forEach((m, i) => {
      m.position.y = game.targets[i] ? -0.3 : 0.39;
      this.targetLabels[i].visible = !game.targets[i];
    });
    this.lockLamps.forEach(
      (m, i) => (m.material.emissiveIntensity = i < game.locks ? 3 : 0.1),
    );
    this.multLamps.forEach(
      (m, i) =>
        (m.material.emissiveIntensity =
          game.multiplier >= [2, 3, 5][i] ? 2.5 : 0.1),
    );
    this.saveLamp.material.emissiveIntensity =
      game.time < game.saveUntil ? 1.5 + Math.sin(this.clock * 10) : 0.1;
    this.jackpotLamp.material.emissiveIntensity =
      game.balls.length > 1 ? 2 + Math.sin(this.clock * 8) : 0.35;
    this.plunger.position.z = game.plunger?.translation().z ?? -1.2;
    for (const [id, m] of this.balls)
      if (!game.balls.some((b) => b.id === id)) {
        this.root.remove(m);
        m.geometry.dispose();
        m.material.dispose();
        this.balls.delete(id);
        const shadow = this.ballShadows.get(id);
        if (shadow) {
          shadow.removeFromParent();
          shadow.geometry.dispose();
          shadow.material.dispose();
          this.ballShadows.delete(id);
        }
      }
    for (const b of game.balls) {
      let m = this.balls.get(b.id);
      if (!m) {
        m = this.sphere(
          RADIUS,
          b.x,
          b.y,
          RADIUS,
          this.mat("#eff6ff", 0.12, 0.98),
        );
        this.balls.set(b.id, m);
        const shadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.25, 20),
          new THREE.MeshBasicMaterial({
            color: 0x150b1c,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
          }),
        );
        shadow.rotation.x = -Math.PI / 2;
        this.root.add(shadow);
        this.ballShadows.set(b.id, shadow);
      }
      m.position.copy(V(b.x, b.y, b.h));
      if (b.rotation) m.quaternion.copy(b.rotation);
      const shadow = this.ballShadows.get(b.id);
      shadow.position.set(m.position.x, 0.017, m.position.z);
      shadow.visible = m.position.y >= 0;
    }
    this.bumpers.forEach((b) => {
      b.flash = Math.max(0, b.flash - dt * 4);
      b.top.position.y = 0.62 + b.flash * 0.16;
    });
    for (const p of this.particles) {
      p.life -= dt;
      p.v.y -= dt * 5;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.material.opacity = Math.max(0, p.life / 0.65);
    }
    this.particles = this.particles.filter((p) => {
      if (p.life <= 0) {
        this.root.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        return false;
      }
      return true;
    });
    this.shake = Math.max(0, this.shake - dt * 2);
    this.root.position.x = Math.sin(this.clock * 65) * this.shake * 0.09;
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  }
}
