import { test } from "node:test";
import assert from "node:assert/strict";
import {
  freshState,
  validateSave,
  transact,
  advanceTime,
  moveWithCollision,
  stepVehicle,
  loadState,
  SAVE_KEY,
} from "../src/state.js";
test("round-trip saves preserve earned progress and reject malformed imports", () => {
  const s = freshState();
  s.cash = 510;
  s.job = { employed: true, stage: 2, shifts: 1 };
  s.friends.Maya = { score: 2, lastDay: 1 };
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(s))), s);
  assert.throws(() => validateSave({ ...s, cash: -1 }));
  assert.throws(() =>
    validateSave({ ...s, position: { x: Infinity, y: 0, z: 0 } }),
  );
  assert.throws(() =>
    validateSave({ ...s, car: { ...s.car, condition: NaN } }),
  );
  assert.equal(loadState({ getItem: () => "{broken" }), null);
  assert.equal(
    loadState({
      getItem: (key) => (key === SAVE_KEY ? JSON.stringify(s) : null),
    }).job.stage,
    2,
  );
});
test("purchases cannot create money or spend more than the player has", () => {
  const s = freshState();
  let calls = 0;
  assert.equal(
    transact(s, 600, () => calls++),
    false,
  );
  assert.equal(calls, 0);
  assert.equal(s.cash, 480);
  assert.equal(transact(s, -30), false);
  assert.equal(
    transact(s, 35, () => calls++),
    true,
  );
  assert.equal(s.cash, 445);
  assert.equal(calls, 1);
});
test("time crosses multiple midnights and retains the rent due date", () => {
  const s = freshState();
  s.minutes = 1438;
  advanceTime(s, 2884);
  assert.equal(s.minutes, 2);
  assert.equal(s.day, 4);
  assert.equal(s.rentDue, 8);
});
test("walking slides along buildings and cannot tunnel through thin walls", () => {
  const boxes = [{ minX: 1, maxX: 2, minZ: -2, maxZ: 2 }];
  const p = { x: 0, z: 0 };
  moveWithCollision(p, 10, 0, 0.3, boxes);
  assert.ok(p.x < 0.72);
  moveWithCollision(p, 1, 4, 0.3, boxes);
  assert.ok(p.z > 3);
  assert.ok(p.x < 2.1);
});
test("vehicle accelerates forward, brakes, steers, uses fuel, and stops against buildings", () => {
  const c = { x: 0, z: 10, yaw: 0, fuel: 100, condition: 100 };
  for (let i = 0; i < 120; i++) stepVehicle(c, { gas: true }, 1 / 60, []);
  assert.ok(c.z < 1);
  assert.ok(c.speed > 8);
  assert.ok(c.fuel < 100);
  const initialYaw = c.yaw;
  for (let i = 0; i < 30; i++)
    stepVehicle(c, { gas: true, left: true }, 1 / 60, []);
  assert.ok(c.yaw > initialYaw);
  for (let i = 0; i < 90; i++) stepVehicle(c, { brake: true }, 1 / 60, []);
  assert.ok(c.speed < 2);
  const wall = [{ minX: -20, maxX: 20, minZ: -2, maxZ: -1.9 }],
    v = { x: 0, z: 2, yaw: 0, fuel: 100, condition: 100 };
  for (let i = 0; i < 200; i++) stepVehicle(v, { gas: true }, 1 / 60, wall);
  assert.ok(v.z > -0.9);
  assert.ok(v.condition < 100);
});
