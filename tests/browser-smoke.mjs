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
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/?test=1");
await page.waitForFunction(() => window.pinball?.getRenderInfo().loaded, {
  timeout: 30000,
});
await page.screenshot({ path: "design/game-desktop.png" });
await page.getByRole("button", { name: "Let’s play" }).click();
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
// Integrate rules, UI, persisted high score, and restart through the dev-only test seam.
await page.evaluate(() => {
  const g = window.__pinballTest.game;
  const b = g.balls[0];
  g.scoop(b, "lock");
  g.scoop(b, "lock");
  g.scoop(b, "lock");
  g.scoop(b, "castle");
});
expect(
  (await page.evaluate(() => window.pinball.getState())).balls.length,
).toBe(3);
await page.waitForFunction(
  () => document.getElementById("score").textContent !== "001,000",
);
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
  "PASS: launch, flippers, pause/resume, multiball, jackpot, game over, high score, restart, touch, mobile overflow.",
);
console.log("Browser errors:", errors);
await browser.close();
if (errors.length) process.exit(1);
