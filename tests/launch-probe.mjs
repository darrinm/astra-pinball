import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:5173/?test=1');
  await page.waitForFunction(() => window.pinball?.getRenderInfo().loaded);
  const results = await page.evaluate(() => {
    const g = window.__pinballTest.game;
    const results = [];
    for (const delay of [0, 0.25, 0.5, 1, 2]) {
      g.start();
      for (let i = 0; i < delay * 240; i++) g.step(1 / 240);
      g.beginCharge();
      for (let i = 0; i < 360; i++) g.step(1 / 240);
      g.launch();
      const b = g.balls[0];
      let entered = false, escaped = false;
      for (let i = 0; i < 2400; i++) {
        g.step(1 / 240);
        entered ||= !b.lane;
        escaped ||= Math.abs(b.x) > 5.65 || b.y > 19.65 || (b.lane && b.y < 0.6);
        if (!g.balls.includes(b)) break;
      }
      results.push({ delay, entered, escaped });
    }
    for (const x of [-4.1, -4, -3.9]) {
      g.start();
      const b = g.balls[0];
      b.lane = false;
      b.body.setTranslation({ x, y: 0.2, z: -18.04 }, true);
      b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      let cleared = false;
      for (let i = 0; i < 720; i++) {
        g.step(1 / 240);
        if (b.y < 16) { cleared = true; break; }
      }
      results.push({ x, cleared });
    }
    g.pause();
    return results;
  });
  for (const result of results) {
    if ('delay' in result) {
      expect(result.entered, JSON.stringify(result)).toBe(true);
      expect(result.escaped, JSON.stringify(result)).toBe(false);
    } else expect(result.cleared, JSON.stringify(result)).toBe(true);
  }
  expect(errors).toEqual([]);
  console.log('PASS: five full-charge launch timings and three upper-support approaches in Chrome; no browser errors.');
} finally { await browser.close(); }
