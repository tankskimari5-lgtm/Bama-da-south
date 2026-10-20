import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAppearance } from "../src/human/config.js";
import {
  createHumanHead,
  createTorsoGeometry,
  createArmGeometry,
  createLegGeometry,
  createHandGeometry,
  createFootGeometry,
} from "../src/human/anatomy.js";
const a = normalizeAppearance();
const valid = (g) => {
  assert.ok(g.getAttribute("position").count > 100);
  assert.ok(g.index.count > 100);
  for (const n of g.getAttribute("position").array)
    assert.ok(Number.isFinite(n));
  g.computeBoundingBox();
  assert.ok(g.boundingBox.max.y > g.boundingBox.min.y);
};
test("anatomical surfaces are finite with valid custom geometry", () => {
  for (const fn of [
    () => createHumanHead(a),
    () => createTorsoGeometry(a),
    () => createArmGeometry(a, -1),
    () => createLegGeometry(a, 1),
    () => createFootGeometry(a, 1),
  ]) {
    const g = fn();
    valid(g);
    g.dispose();
  }
  const hand = createHandGeometry(a, 1);
  valid(hand.palm);
  assert.equal(hand.fingers.length, 5);
  for (const f of hand.fingers) {
    valid(f.g);
    assert.ok(f.length > 0.04);
  }
});
test("customization changes actual head and body geometry", () => {
  const narrow = createHumanHead({ ...a, jawWidth: 0.8 }),
    wide = createHumanHead({ ...a, jawWidth: 1.22 });
  assert.notDeepEqual(
    narrow.attributes.position.array,
    wide.attributes.position.array,
  );
  const slim = createTorsoGeometry({ ...a, build: "slim" }),
    broad = createTorsoGeometry({ ...a, build: "broad" });
  slim.computeBoundingBox();
  broad.computeBoundingBox();
  assert.ok(broad.boundingBox.max.x > slim.boundingBox.max.x);
  assert.equal(createHumanHead(a).morphAttributes.position.length, 3);
});
test("appearance schema clamps extreme dimensions and rejects invalid colors", () => {
  const p = normalizeAppearance({
    height: 10,
    shoulderWidth: -3,
    skin: "bad",
    hair: "downloaded",
    noseWidth: NaN,
  });
  assert.equal(p.height, 2.05);
  assert.equal(p.shoulderWidth, 0.84);
  assert.equal(p.skin, a.skin);
  assert.equal(p.hair, "short");
  assert.equal(p.noseWidth, 1);
});
import { createDetailedHuman } from "../src/human/index.js";
import { solveLegIK } from "../src/human/animation.js";
import { HAIRSTYLES } from "../src/human/config.js";
import { createHairGeometry } from "../src/human/hair.js";
test("rig has 52 named bones, normalized skin weights, and articulated fingers", () => {
  const human = createDetailedHuman(a, { detail: "npc" });
  assert.equal(human.skeleton.bones.length, 52);
  for (const name of ["jaw", "leftShoulder", "rightFinger4Tip", "leftToe"])
    assert.ok(human.joints[name]);
  human.group.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const w = o.geometry.attributes.skinWeight,
      indices = o.geometry.attributes.skinIndex;
    for (let i = 0; i < w.count; i++) {
      assert.ok(
        Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) < 1e-5,
      );
      for (let k = 0; k < 4; k++) assert.ok(indices.array[i * 4 + k] < 52);
    }
  });
  human.animate(0.05, 2, { run: true });
  assert.ok(human.joints.leftKnee.rotation.x <= 0);
  assert.ok(human.joints.leftFinger0Mid.rotation.x > 0);
  human.dispose();
});
test("leg IK places stance foot at its target with knees flexing anatomically", () => {
  for (const [y, z] of [
    [-0.79, 0.2],
    [-0.65, -0.2],
    [-0.72, 0.1],
  ]) {
    const r = solveLegIK(y, z);
    assert.ok(r.knee < 0);
    assert.ok(
      Math.abs(-0.42 * Math.cos(r.hip) - 0.405 * Math.cos(r.hip + r.knee) - y) <
        0.0001,
    );
    assert.ok(
      Math.abs(-0.42 * Math.sin(r.hip) - 0.405 * Math.sin(r.hip + r.knee) - z) <
        0.0001,
    );
  }
});
test("every hairstyle is generated locally as valid geometry", () => {
  for (const hair of HAIRSTYLES) {
    const g = createHairGeometry({ ...a, hair }, "low");
    if (hair === "none") assert.equal(g, null);
    else {
      valid(g);
      g.dispose();
    }
  }
});

test("legacy character saves keep their money and receive valid new dimensions", async () => {
  const { freshState, validateSave } = await import("../src/state.js");
  const s = freshState();
  s.cash = 734;
  s.appearance = {
    gender: "masculine",
    skin: "#b67c57",
    hair: "short",
    build: "regular",
    outfit: "#536f64",
    face: "soft",
  };
  const restored = validateSave(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.cash, 734);
  assert.equal(restored.appearance.height, 1.8);
  assert.equal(restored.appearance.noseWidth, 1);
});

test("closed head UV seam has matching smooth normals", () => {
  const g = createHumanHead(a, "high"),
    n = g.attributes.normal;
  for (let row = 1; row < 108; row++) {
    const first = row * 97,
      last = first + 96;
    assert.ok(Math.abs(n.getX(first) - n.getX(last)) < 1e-6);
    assert.ok(Math.abs(n.getY(first) - n.getY(last)) < 1e-6);
    assert.ok(Math.abs(n.getZ(first) - n.getZ(last)) < 1e-6);
  }
  g.dispose();
});
