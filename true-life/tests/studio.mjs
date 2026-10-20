import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { freshState } from "../src/state.js";
const out = process.env.CHARACTER_SCREENSHOTS || "/tmp/true-life-character";
await mkdir(out, { recursive: true });
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
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    }),
    errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 800));
  });
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://localhost:5173") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  await page.goto("http://localhost:5173/character.html", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForFunction(() => !!window.__CHARACTER_STUDIO__, null, {
    timeout: 60000,
  });
  const frames = async () => {
    const f = await page.evaluate(
      () => __CHARACTER_STUDIO__.renderer.info.render.frame,
    );
    await page.waitForFunction(
      (f) => __CHARACTER_STUDIO__.renderer.info.render.frame > f + 2,
      f,
      { timeout: 60000 },
    );
  };
  await page.evaluate(() => {
    document.getElementById("playback").value = "0";
    for (const l of __CHARACTER_STUDIO__.human.levels) {
      l.animator.reset();
      for (let i = 0; i < 21; i++) l.animator.animate(0.06, 0);
    }
  });
  for (const view of ["front", "side", "back", "face"]) {
    await page.locator(`[data-view=${view}]`).click();
    await frames();
    await page.screenshot({
      path: out + "/" + view + ".jpg",
      type: "jpeg",
      quality: 88,
    });
  }
  assert.equal(
    await page.evaluate(() => __CHARACTER_STUDIO__.human.metrics().detail),
    "high",
  );
  console.log("VIEWS front / side / back / high-detail face rendered.");
  await page.locator("[data-tab=face]").click();
  const jaw = async (value) => {
    await page.locator("#studio-jawWidth").evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    await page.waitForFunction(
      (value) => __CHARACTER_STUDIO__.human.appearance.jawWidth === value,
      value,
    );
    return page.evaluate(() => {
      const h = __CHARACTER_STUDIO__.human.levels[0].weighted.find(
        (o) => o.name === "sculpted head",
      ).geometry.attributes.position;
      let width = 0;
      for (let i = 0; i < h.count; i++)
        if (h.getY(i) < 1.61) width = Math.max(width, Math.abs(h.getX(i)));
      return width;
    });
  };
  const narrow = await jaw(0.8),
    wide = await jaw(1.22);
  assert.ok(wide > narrow);
  console.log("CUSTOMIZATION jaw slider changes actual head vertices.");
  await page.locator("[data-tab=style]").click();
  for (const hair of [
    "buzz",
    "waves",
    "afro",
    "braids",
    "twists",
    "locs",
    "long",
    "short",
    "none",
  ]) {
    await page.selectOption("#studio-hair", hair);
    await page.waitForFunction(
      (h) => __CHARACTER_STUDIO__.human.appearance.hair === h,
      hair,
    );
    await frames();
  }
  console.log("HAIR nine options render without asset requests.");
  await page.selectOption("#studio-hair", "short");
  await page.selectOption("#studio-facialHair", "beard");
  await frames();
  await page.screenshot({ path: out + "/beard.png" });
  await page.selectOption("#studio-facialHair", "none");
  await page.locator("[data-view=front]").click();
  for (const mode of [
    "idle",
    "walk",
    "run",
    "sprint",
    "turn",
    "jump",
    "crouch",
    "sit",
    "enter",
    "exit",
    "look",
    "talk",
  ]) {
    await page.locator(`[data-animation=${mode}]`).click();
    await page.evaluate((mode) => {
      const s = __CHARACTER_STUDIO__;
      for (let i = 0; i < 25; i++) s.human.animate(0.06, 0, { mode });
    }, mode);
    assert.equal(
      await page.locator(`[data-animation=${mode}]`).getAttribute("class"),
      "selected",
    );
    if (["walk", "sit", "talk"].includes(mode)) {
      await frames();
      await page.screenshot({ path: out + "/" + mode + ".png" });
    }
  }
  console.log("ANIMATIONS all 12 original pose previews execute.");
  await page.selectOption("#expression", "smile");
  await page.evaluate(() => {
    for (let i = 0; i < 30; i++)
      __CHARACTER_STUDIO__.human.animate(0.06, 0, { expression: "smile" });
  });
  assert.ok(
    await page.evaluate(
      () =>
        __CHARACTER_STUDIO__.human.levels[1].weighted.find(
          (m) => m.name === "sculpted head",
        ).morphTargetInfluences[0] > 0.5,
    ),
  );
  await page.locator("#anatomy").click();
  assert.equal(
    await page.evaluate(() =>
      __CHARACTER_STUDIO__.human.levels[0].clothing.every((m) => !m.visible),
    ),
    true,
  );
  await page.locator("#anatomy").click();
  await page.locator("[data-tab=form]").click();
  await page.locator("#studio-height").evaluate((el) => {
    el.value = "1.93";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(
    () => __CHARACTER_STUDIO__.human.appearance.height === 1.93,
  );
  const s = freshState();
  s.cash = 789;
  await page.evaluate(
    (s) => localStorage.setItem("true-life-open-world-v1", JSON.stringify(s)),
    s,
  );
  await page.locator("#apply").click();
  await page.waitForFunction(() => !!window.__TRUE_LIFE__, null, {
    timeout: 60000,
  });
  assert.equal(await page.evaluate(() => __TRUE_LIFE__.state.cash), 789);
  assert.equal(
    await page.evaluate(() => __TRUE_LIFE__.state.appearance.height),
    1.93,
  );
  assert.equal(
    await page.evaluate(() => __TRUE_LIFE__.player.skeleton.bones.length),
    52,
  );
  await page.click("#start");
  const z = await page.evaluate(() => __TRUE_LIFE__.player.group.position.z);
  await page.keyboard.down("w");
  await page.waitForFunction(
    (z) => __TRUE_LIFE__.player.group.position.z < z - 0.6,
    z,
    { timeout: 60000 },
  );
  await page.keyboard.up("w");
  assert.equal(
    await page.evaluate(() =>
      __TRUE_LIFE__.world.npcs.every(
        (n) => n.levels.length === 1 && n.levels[0].detail === "low",
      ),
    ),
    true,
  );
  console.log(
    "GAME appearance transfer preserves money; detailed rig walks; NPCs use low LOD.",
  );
  await page.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const mp = await mobile.newPage();
  mp.on("pageerror", (e) => errors.push(e.message));
  mp.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 800));
  });
  await mp.goto("http://localhost:5173/character.html", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await mp.waitForFunction(() => !!window.__CHARACTER_STUDIO__, null, {
    timeout: 60000,
  });
  await mp.locator("[data-view=face]").tap();
  await mp.locator("[data-tab=style]").tap();
  await mp.selectOption("#studio-hair", "braids");
  await mp.waitForFunction(
    () => __CHARACTER_STUDIO__.human.appearance.hair === "braids",
  );
  const cameraBefore = await mp.evaluate(
      () => __CHARACTER_STUDIO__.camera.position.x,
    ),
    client = await mobile.newCDPSession(mp);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x: 160, y: 190 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ id: 1, x: 230, y: 200 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.notEqual(
    await mp.evaluate(() => __CHARACTER_STUDIO__.camera.position.x),
    cameraBefore,
  );
  await mp.screenshot({ path: out + "/mobile.png" });
  assert.equal(
    await mp.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "MOBILE touch orbit and hairstyle changes work; viewport fits. ERRORS [] EXTERNAL ASSET REQUESTS []",
  );
} finally {
  await browser.close();
}
