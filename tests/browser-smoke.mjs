import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: [
    "--enable-webgl",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
const errors = [];
process.on("uncaughtException", async (error) => {
 console.error(error.message, await page.evaluate(() => window.pinball?.getState()).catch(() => null));
 await browser.close(); process.exit(1);
});
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/?test=1");
await page.waitForFunction(() => window.pinball?.getRenderInfo().loaded, {
  timeout: 30000,
});
await page.screenshot({ path: "design/game-desktop.png" });
await page.getByRole("button", { name: "Let’s play" }).click();
// Regression: ball used to wedge at x=-4.343, y=14.276 beside the left bumper.
await page.evaluate(() => {
  const b = window.__pinballTest.game.balls[0];
  b.lane = false;
  b.body.setTranslation({ x: -4.3, y: 0.2, z: -14.7 }, true);
  b.body.setLinvel({ x: 0, y: 0, z: 3 }, true);
});
await page.waitForFunction(() => window.pinball.getState().balls[0]?.y < 12.5);
expect((await page.evaluate(() => window.pinball.getState())).time).toBeLessThan(8);
await page.evaluate(() => window.__pinballTest.game.start());
await page.keyboard.down("Space");
await page.waitForFunction(() => window.__pinballTest.game.charge > 0.5, {
  timeout: 30000,
});
await page.keyboard.up("Space");
await page.waitForFunction(() => window.pinball.getState().score >= 1000, {
  timeout: 30000,
});
expect(
  (await page.evaluate(() => window.pinball.getState())).balls[0].lane,
).toBe(false);
await page.keyboard.down("ArrowLeft");
await page.waitForFunction(
  () => window.__pinballTest.game.flippers[0].angle > 0.4,
  { timeout: 30000 },
);
await page.keyboard.up("ArrowLeft");
await page.screenshot({ path: "design/game-playing.png" });
await page.keyboard.press("p");
expect(await page.evaluate(() => window.pinball.getState().state)).toBe(
  "paused",
);
await expect(page.getByRole("button", { name: "Keep rolling" })).toBeVisible();
const pausedTime = await page.evaluate(() => window.pinball.getState().time);
await page.waitForTimeout(200);
expect(await page.evaluate(() => window.pinball.getState().time)).toBe(
  pausedTime,
);
await page.keyboard.press("p");
expect(await page.evaluate(() => window.pinball.getState().state)).toBe(
  "playing",
);
// Place balls above the real lock aperture; simulation must capture and eject them.
for (let i = 1; i <= 3; i++) {
 console.log("Testing physical lock", i);
  await page.evaluate(() => {
    const g = window.__pinballTest.game;
    const b = g.balls[0];
    b.lane = false;
    b.launched = true;
    b.body.setTranslation({ x: 3.05, y: 0.5, z: -15.1 }, true);
    b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  });
  await page.waitForFunction((count) => {
    const s = window.pinball.getState();
    return count < 3 ? s.lockedBalls.length === count : s.balls.length === 3;
  }, i);
}
console.log("Testing ejection");
await page.waitForFunction(() => window.pinball.getState().balls.every(b => !b.capture));
await page.evaluate(() => {
  const b = window.__pinballTest.game.balls[0];
  b.scoopCooldown = 0;
  b.body.setTranslation({ x: 0, y: 0.5, z: -13.15 }, true);
  b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
});
await page.waitForFunction(() => window.pinball.getState().score >= 130000);
// Camera controls must alter the view and reset to the player perspective.
const cameraState = () => page.evaluate(() => {
  const t = window.__pinballTest.table;
  return { position: t.camera.position.toArray(), target: t.controls.target.toArray(), zoom: t.camera.zoom };
});
await page.getByRole('button', { name: 'Reset view', exact: true }).click();
const initialCamera = await cameraState();
await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
expect(await cameraState()).not.toEqual(initialCamera);
await page.getByRole('button', { name: 'Reset view', exact: true }).click();
await page.mouse.move(750, 450);
await page.mouse.down();
await page.mouse.move(850, 490, { steps: 12 });
await page.mouse.up();
expect(await cameraState()).not.toEqual(initialCamera);
await page.getByRole('button', { name: 'Reset view', exact: true }).click();
await page.locator('#pan-camera').click();
await page.mouse.move(750, 450);
await page.mouse.down();
await page.mouse.move(800, 480, { steps: 12 });
await page.mouse.up();
expect((await cameraState()).target).not.toEqual(initialCamera.target);
await page.getByRole('button', { name: 'Reset view', exact: true }).click();
await page.evaluate(() => {
  const g = window.__pinballTest.game;
  g.saveUntil = 0;
  for (const b of [...g.balls]) g.drain(b);
  while (g.state === "playing") g.drain(g.balls[0]);
});
await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
expect(
  await page.evaluate(() => Number(localStorage.getItem("candyland-best"))),
).toBeGreaterThan(100000);
await page.getByRole("button", { name: "Play again" }).click();
expect(await page.evaluate(() => window.pinball.getState().score)).toBe(0);
await page.setViewportSize({ width: 390, height: 844 });
const touchBox = await page.locator("#left-touch").boundingBox();
await page.mouse.move(
  touchBox.x + touchBox.width / 2,
  touchBox.y + touchBox.height / 2,
);
await page.mouse.down();
expect(await page.evaluate(() => window.__pinballTest.game.inputs.left)).toBe(
  true,
);
await page.mouse.up();
expect(await page.evaluate(() => window.__pinballTest.game.inputs.left)).toBe(
  false,
);
await page.screenshot({ path: "design/game-mobile.png" });
expect(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
).toBe(false);
console.log(
  "Render:",
  await page.evaluate(() => window.pinball.getRenderInfo()),
);
console.log(
  "PASS: launch, flippers, pause/resume, physical lock capture/ejection, multiball, jackpot, zoom/rotate/pan/reset, game over, high score, restart, touch, mobile overflow.",
);
console.log("Browser errors:", errors);
await browser.close();
if (errors.length) process.exit(1);
