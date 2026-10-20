import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://localhost:5173");
await page.waitForFunction(() => !!window.__TRUE_LIFE__);
await page.selectOption("#skin", "#69432e");
await page.selectOption("#hair", "long");
await page.click("#start");
console.log(
  "BOOT",
  await page.evaluate(() => ({
    draws: __TRUE_LIFE__.renderer.info.render.calls,
    triangles: __TRUE_LIFE__.renderer.info.render.triangles,
  })),
);
await page.evaluate(() => {
  __TRUE_LIFE__.state.settings.quality = "low";
  document.getElementById("quality").value = "low";
  document.getElementById("quality").dispatchEvent(new Event("change"));
});
const before = await page.evaluate(() => __TRUE_LIFE__.player.group.position.z);
await page.keyboard.down("w");
await page.waitForFunction(
  (z) => __TRUE_LIFE__.player.group.position.z < z - 0.8,
  before,
  { timeout: 30000 },
);
await page.keyboard.up("w");
console.log("WALK moves toward camera forward");
await page.keyboard.press(" ");
await page.waitForFunction(() => __TRUE_LIFE__.player.group.position.y > 0.2, {
  timeout: 10000,
});
console.log("JUMP visible");
await page.evaluate(() => {
  __TRUE_LIFE__.teleport(-30, 38);
});
await page.keyboard.press("e");
await page.waitForFunction(() => __TRUE_LIFE__.state.interior === "home");
assert.equal(
  await page.evaluate(() => __TRUE_LIFE__.world.inside.visible),
  true,
);
await page.evaluate(() => __TRUE_LIFE__.teleport(-5, -1));
await page.keyboard.press("e");
assert.equal(await page.evaluate(() => __TRUE_LIFE__.state.energy), 100);
console.log("HOME entered and sleep restores energy");
await page.evaluate(() => __TRUE_LIFE__.teleport(0, 5));
await page.keyboard.press("e");
await page.waitForFunction(() => __TRUE_LIFE__.state.interior === null);
await page.evaluate(() => __TRUE_LIFE__.teleport(30, 36));
await page.keyboard.press("e");
await page.waitForFunction(() => __TRUE_LIFE__.state.interior === "cafe");
const cash = await page.evaluate(() => __TRUE_LIFE__.state.cash);
for (const [x, z] of [
  [1, -1.5],
  [3, -1.5],
  [4.5, 1.3],
  [-3, -1.5],
]) {
  await page.evaluate(([x, z]) => __TRUE_LIFE__.teleport(x, z), [x, z]);
  await page.keyboard.press("e");
}
assert.equal(await page.evaluate(() => __TRUE_LIFE__.state.cash), cash + 30);
assert.equal(await page.evaluate(() => __TRUE_LIFE__.state.job.shifts), 1);
console.log("JOB complete physical café sequence earns $30");
await page.evaluate(() => {
  __TRUE_LIFE__.teleport(-2, -1.5);
  __TRUE_LIFE__.state.cash = 0;
});
await page.keyboard.press("e");
assert.equal(await page.evaluate(() => __TRUE_LIFE__.state.cash), 0);
console.log("PURCHASE blocks insufficient funds");
await page.evaluate((cash) => {
  __TRUE_LIFE__.state.cash = cash + 30;
  __TRUE_LIFE__.teleport(0, 5);
}, cash);
await page.keyboard.press("e");
await page.evaluate(() => __TRUE_LIFE__.teleport(6.8, 26));
await page.keyboard.press("e");
await page.waitForFunction(() => __TRUE_LIFE__.driving);
const carBefore = await page.evaluate(() => __TRUE_LIFE__.car.group.position.z);
await page.keyboard.down("w");
await page.waitForFunction(
  (z) => __TRUE_LIFE__.car.group.position.z < z - 3,
  carBefore,
  { timeout: 30000 },
);
await page.keyboard.up("w");
await page.keyboard.press("e");
assert.equal(await page.evaluate(() => __TRUE_LIFE__.driving), true);
console.log("DRIVE moves car and prevents exit while moving");
await page.evaluate(() => {
  __TRUE_LIFE__.state.car.speed = 0;
});
await page.keyboard.press("e");
await page.waitForFunction(() => !__TRUE_LIFE__.driving);
await page.evaluate(() => __TRUE_LIFE__.save());
const saved = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("true-life-open-world-v1")),
);
await page.reload();
await page.waitForFunction(() => !!window.__TRUE_LIFE__);
assert.equal(await page.evaluate(() => __TRUE_LIFE__.state.cash), saved.cash);
assert.equal(await page.evaluate(() => __TRUE_LIFE__.state.job.shifts), 1);
console.log("SAVE survives reload with money, job, appearance, location");
await page.click("#start");
await page.screenshot({ path: "/tmp/true-life-test-desktop.png" });
console.log("DESKTOP_ERRORS", JSON.stringify(errors));
await page.close();
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});
const mp = await mobile.newPage();
const mobileErrors = [];
mp.on("pageerror", (e) => mobileErrors.push(e.message));
mp.on("console", (m) => {
  if (m.type() === "error") mobileErrors.push(m.text());
});
await mp.goto("http://localhost:5173", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await mp.waitForFunction(() => !!window.__TRUE_LIFE__);
await mp.click("#start");
await mp.waitForTimeout(400);
assert.equal(await mp.locator("#joystick").isVisible(), true);
// Use real CDP touch input so pointer capture, touch camera and controls follow browser behavior.
const client = await mobile.newCDPSession(mp);
const jb = await mp.locator("#joystick").boundingBox();
const mBefore = await mp.evaluate(() => __TRUE_LIFE__.player.group.position.z);
await client.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: jb.x + jb.width / 2, y: jb.y + jb.height / 2, id: 1 }],
});
await client.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [{ x: jb.x + jb.width / 2, y: jb.y + 8, id: 1 }],
});
await mp.waitForFunction(
  (z) => __TRUE_LIFE__.player.group.position.z < z - 0.5,
  mBefore,
  { timeout: 30000 },
);
await client.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
assert.equal(await mp.evaluate(() => __TRUE_LIFE__.input.stick.y), 0);
console.log("MOBILE joystick moves player and releases cleanly");
await mp.evaluate(() => __TRUE_LIFE__.teleport(6.8, 26));
await mp.locator("#interact").tap();
await mp.waitForFunction(() => __TRUE_LIFE__.driving);
assert.equal(await mp.locator("#joystick").isVisible(), false);
assert.equal(await mp.locator("[data-drive=left]").isVisible(), true);
assert.equal(await mp.locator("[data-drive=gas]").isVisible(), true);
const gas = await mp.locator("[data-drive=gas]").boundingBox();
const cb = await mp.evaluate(() => __TRUE_LIFE__.car.group.position.z);
await client.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: gas.x + gas.width / 2, y: gas.y + gas.height / 2, id: 2 }],
});
await mp.waitForFunction(
  (z) => __TRUE_LIFE__.car.group.position.z < z - 1,
  cb,
  { timeout: 30000 },
);
await client.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
assert.equal(await mp.evaluate(() => __TRUE_LIFE__.input.drive.gas), false);
console.log(
  "MOBILE gas pedal drives; steering arrows shown; walking joystick hidden",
);
assert.equal(
  await mp.evaluate(() => document.documentElement.scrollHeight <= innerHeight),
  true,
);
await mp.screenshot({ path: "/tmp/true-life-test-mobile.png" });
console.log("MOBILE_ERRORS", JSON.stringify(mobileErrors));
assert.deepEqual(errors, []);
assert.deepEqual(mobileErrors, []);
await browser.close();
