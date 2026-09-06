import "./style.css";
import { Pinball } from "./physics.js";
import { Table } from "./table.js";
import { AudioEngine } from "./audio.js";
const $ = (id) => document.getElementById(id),
  format = (n) =>
    Math.floor(n)
      .toString()
      .padStart(6, "0")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const audio = new AudioEngine();
let best = 0;
try {
  best = Number(localStorage.getItem("candyland-best") || 0);
} catch {}
$("best").textContent = format(best);
let toastTimer;
function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 1900);
}
let table;
const game = new Pinball((e) => {
  audio.play(e.type);
  if (e.type === "score") {
    if (e.value >= 1000) table?.burst(e.x, e.y, 0xffd49a, 8);
  }
  if (e.type === "bumper") {
    table.bumpers[e.index].flash = 1;
    table.burst(
      table.bumpers[e.index].g.position.x,
      -table.bumpers[e.index].g.position.z,
      0xa9ffdf,
      7,
    );
  }
  const messages = {
    start: "LET THE GOOD TIMES ROLL",
    ramp: "SWEET SHOT! +5,000",
    combo: `RAMP COMBO · ${game.multiplier}×`,
    rush: "SUGAR RUSH · DOUBLE POINTS",
    lock: `BALL LOCKED · ${game.locks} / 3`,
    multiball: "MULTIBALL!",
    jackpot: "CASTLE JACKPOT!",
    castle: "CASTLE BONUS",
    swirl: "CHOCOLATE SWIRL",
    save: "BALL SAVED · SHOOT AGAIN",
    newball: `BALL ${game.ballNumber} · MAKE IT SWEET`,
    tilt: "TILT · HANDS OFF",
    nudge: e.danger ? "DANGER · EASY ON THE SUGAR" : "NUDGE",
  };
  if (messages[e.type]) toast(messages[e.type]);
  if (e.type === "nudge" || e.type === "tilt") table.shake = 1;
  if (e.type === "gameover") {
    if (game.score > best) {
      best = game.score;
      try {
        localStorage.setItem("candyland-best", String(best));
      } catch {}
      $("best").textContent = format(best);
    }
    $("overlay-kicker").textContent = "THAT WAS SWEET";
    $("overlay-title").innerHTML = "Nice<br><em>rolling.</em>";
    $("overlay-copy").textContent =
      `Final score ${format(game.score)} · Best ${format(best)}`;
    $("start").innerHTML = "Play again <span>↗</span>";
    $("overlay-hint").textContent = "PRESS ENTER FOR ANOTHER ROUND";
    $("overlay").hidden = false;
  }
});
let loaded = false;
$("game").addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  releaseAll();
  $("loading").style.display = "grid";
  $("loading").textContent = "Graphics paused. Refresh to restore the table.";
});
try {
  table = new Table($("game"));
  Promise.all([table.assetReady, game.ready])
    .then(() => {
      game.installCastleMeshes(table.castleCollision);
      loaded = true;
      $("loading").hidden = true;
      $("loading").style.display = "none";
    })
    .catch(() => {
      $("loading").textContent =
        "The table could not load. Please refresh to try again.";
    });
} catch (e) {
  console.error(e);
  $("loading").textContent =
    "This game needs WebGL. Please try a browser with hardware acceleration enabled.";
}
function start() {
  if (!loaded) return;
  audio.unlock();
  if (game.state === "paused") {
    game.pause();
  } else game.start();
  $("overlay").hidden = true;
  $("pause").textContent = "Ⅱ";
  $("pause").setAttribute("aria-label", "Pause game");
  $("start").blur();
}
function pause() {
  if (!["playing", "paused"].includes(game.state)) return;
  game.pause();
  const paused = game.state === "paused";
  $("overlay").hidden = !paused;
  $("pause").textContent = paused ? "▶" : "Ⅱ";
  $("pause").setAttribute("aria-label", paused ? "Resume game" : "Pause game");
  if (paused) {
    $("overlay-kicker").textContent = "TAKE YOUR TIME";
    $("overlay-title").innerHTML = "Sweet<br><em>pause.</em>";
    $("overlay-copy").textContent = "Your next great shot can wait.";
    $("start").innerHTML = "Keep rolling <span>↗</span>";
    $("overlay-hint").textContent = "PRESS P TO RESUME";
  }
}
$("start").onclick = start;
$("pause").onclick = pause;
$("sound").onclick = () => {
  audio.unlock();
  audio.enabled = !audio.enabled;
  $("sound").textContent = audio.enabled ? "Sound on" : "Sound off";
  $("sound").setAttribute("aria-pressed", String(!audio.enabled));
};
$("view").onclick = () => {
  table.view = (table.view + 1) % 3;
  table.resize();
  $("view").innerHTML =
    ["Camera: classic", "Camera: player view", "Camera: overhead"][table.view] +
    " <span>↗</span>";
};
$("zoom-in").onclick = () => table?.zoomBy(0.85);
$("zoom-out").onclick = () => table?.zoomBy(1.18);
$("pan-camera").onclick = () => {
  table.setPanMode(!table.panMode);
  $("pan-camera").setAttribute("aria-pressed", String(table.panMode));
};
$("reset-camera").onclick = () => {
  table.view = 1;
  table.setPanMode(false);
  table.resize();
  $("pan-camera").setAttribute("aria-pressed", "false");
  $("view").innerHTML = "Player view <span>↗</span>";
};
$("help").onclick = () => {
  if (game.state === "playing") pause();
  $("help-dialog").showModal();
};
$("close-help").onclick = () => $("help-dialog").close();
const keys = new Set();
addEventListener("keydown", (e) => {
  if ($("help-dialog").open) return;
  if (
    (e.code === "Enter" || e.code === "Space") &&
    e.target instanceof HTMLButtonElement
  )
    return;
  if (
    [
      "Space",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "KeyA",
      "KeyD",
      "KeyN",
      "KeyP",
      "Enter",
    ].includes(e.code)
  )
    e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  audio.unlock();
  if (e.code === "Enter" && game.state !== "playing") start();
  if (e.code === "KeyP") pause();
  if (e.code === "KeyN") game.nudge();
  if (e.code === "ArrowLeft" || e.code === "KeyA") game.inputs.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") game.inputs.right = true;
  if (e.code === "Space") game.beginCharge();
});
addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "ArrowLeft" || e.code === "KeyA")
    game.inputs.left = keys.has("ArrowLeft") || keys.has("KeyA");
  if (e.code === "ArrowRight" || e.code === "KeyD")
    game.inputs.right = keys.has("ArrowRight") || keys.has("KeyD");
  if (e.code === "Space") game.launch();
});
function releaseAll() {
  keys.clear();
  game.inputs.left = game.inputs.right = false;
  game.charging = false;
  game.charge = 0;
  if (game.state === "playing") pause();
}
addEventListener("blur", releaseAll);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseAll();
});
function hold(id, down, up) {
  const el = $(id);
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    audio.unlock();
    el.setPointerCapture(e.pointerId);
    down();
  });
  el.addEventListener("pointerup", (e) => {
    e.preventDefault();
    up();
  });
  el.addEventListener("pointercancel", up);
  el.addEventListener("lostpointercapture", () => {
    if (id !== "launch") up();
  });
}
hold(
  "launch",
  () => game.beginCharge(),
  () => {
    if (game.charging) game.launch();
  },
);
hold(
  "left-touch",
  () => (game.inputs.left = true),
  () => (game.inputs.left = false),
);
hold(
  "right-touch",
  () => (game.inputs.right = true),
  () => (game.inputs.right = false),
);
$("nudge-touch").onclick = () => game.nudge();
let previous = performance.now(),
  accumulator = 0,
  uiClock = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  accumulator += dt;
  while (accumulator >= 1 / 240) {
    game.step(1 / 240);
    accumulator -= 1 / 240;
  }
  if (table) table.update(game, dt);
  uiClock += dt;
  if (uiClock > 0.06) {
    uiClock = 0;
    $("score").textContent = format(game.score);
    $("ball").innerHTML =
      `${String(game.ballNumber).padStart(2, "0")} <small>/ 03</small>`;
    $("mult").textContent = game.multiplier + "×";
    $("charge").style.width = game.charge * 100 + "%";
    $("target-progress").textContent = game.targets
      .map((v) => (v ? "●" : "○"))
      .join(" ");
    $("lock-progress").textContent = [0, 1, 2]
      .map((i) => (i < game.locks ? "◆" : "◇"))
      .join(" ");
    $("ramps-progress").textContent =
      `${game.rampCombos} RAMP COMBO${game.rampCombos === 1 ? "" : "S"}`;
    $("jackpot").textContent = format(game.jackpot);
    $("save").textContent =
      game.state === "playing" && game.time < game.saveUntil
        ? `BALL SAVE ${Math.ceil(game.saveUntil - game.time)}s`
        : "";
    $("status").textContent = game.tilted
      ? "TILT · FLIPPERS DISABLED"
      : game.state === "paused"
        ? "PAUSED"
        : game.rushUntil > game.time
          ? `SUGAR RUSH · ${Math.ceil(game.rushUntil - game.time)}s`
          : game.balls.length > 1
            ? "MULTIBALL · CASTLE JACKPOT IS LIT"
            : game.state === "playing"
              ? "MAKE SOMETHING SWEET HAPPEN"
              : "THE SWEET SPOT IS WAITING";
    $("launch-label").textContent = game.balls.some(
      (b) => b.lane && !b.launched,
    )
      ? "HOLD SPACE TO CHARGE · RELEASE TO LAUNCH"
      : "AIM FOR THE LIT RAMPS · KEEP IT ROLLING";
  }
}
requestAnimationFrame(frame);
// Read-only diagnostics; no cheats or state mutation in production.
window.pinball = {
  getState: () => game.snapshot(),
  getRenderInfo: () => ({
    calls: table?.renderer.info.render.calls,
    triangles: table?.renderer.info.render.triangles,
    loaded,
  }),
};
if (import.meta.env.DEV && new URLSearchParams(location.search).has("test"))
  window.__pinballTest = { game, table };
