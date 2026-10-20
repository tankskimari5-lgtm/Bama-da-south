import { normalizeAppearance } from "./human/config.js";
export const SAVE_KEY = "true-life-open-world-v1";
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
export function freshState() {
  return {
    version: 1,
    name: "Alex Morgan",
    cash: 480,
    bank: 120,
    day: 1,
    minutes: 8 * 60,
    hunger: 80,
    energy: 85,
    health: 100,
    position: { x: 8, y: 0, z: 32 },
    yaw: 0,
    interior: null,
    returnPoint: null,
    appearance: normalizeAppearance(),
    car: { x: 5, z: 26, yaw: 0, fuel: 100, condition: 100, owned: true },
    visited: [],
    completed: [],
    job: { employed: false, stage: 0, shifts: 0 },
    friends: {},
    inventory: [],
    rentDue: 8,
    rentPaid: false,
    settings: { quality: "medium", sound: false },
  };
}
const finite = (v, a, b) =>
  typeof v === "number" && Number.isFinite(v) && v >= a && v <= b;
export function validateSave(s) {
  if (!s || s.version !== 1 || typeof s.name !== "string" || s.name.length > 24)
    throw Error("This is not a TRUE LIFE open-world save.");
  for (const k of ["cash", "bank"])
    if (!finite(s[k], 0, 1e10)) throw Error("Invalid balance.");
  for (const k of ["hunger", "energy", "health"])
    if (!finite(s[k], 0, 100)) throw Error("Invalid needs.");
  if (
    !s.position ||
    !["x", "z"].every((k) => finite(s.position[k], -110, 110)) ||
    !finite(s.position.y, 0, 5)
  )
    throw Error("Invalid player position.");
  if (
    !finite(s.yaw, -1e6, 1e6) ||
    !finite(s.minutes, 0, 1440) ||
    !Number.isInteger(s.day) ||
    s.day < 1
  )
    throw Error("Invalid world state.");
  if (
    !s.car ||
    !["x", "z"].every((k) => finite(s.car[k], -110, 110)) ||
    !finite(s.car.yaw, -1e6, 1e6) ||
    !finite(s.car.fuel, 0, 100) ||
    !finite(s.car.condition, 0, 100)
  )
    throw Error("Invalid vehicle.");
  if (
    !s.appearance ||
    !/^#[a-fA-F0-9]{6}$/.test(s.appearance.skin) ||
    !/^#[a-fA-F0-9]{6}$/.test(s.appearance.outfit)
  )
    throw Error("Invalid appearance.");
  for (const k of ["visited", "completed", "inventory"])
    if (
      !Array.isArray(s[k]) ||
      s[k].length > 100 ||
      !s[k].every((v) => typeof v === "string" && v.length < 80)
    )
      throw Error("Invalid progress.");
  if (
    !s.job ||
    !Number.isInteger(s.job.stage) ||
    s.job.stage < 0 ||
    s.job.stage > 3 ||
    !Number.isInteger(s.job.shifts) ||
    s.job.shifts < 0
  )
    throw Error("Invalid job.");
  if (!s.friends || typeof s.friends !== "object" || Array.isArray(s.friends))
    throw Error("Invalid relationships.");
  if (!finite(s.rentDue, 1, 1e6)) throw Error("Invalid rent.");
  if (![null, "home", "cafe", "bank", "dealer", "shop"].includes(s.interior))
    throw Error("Unknown interior.");
  const safe = structuredClone(s);
  safe.position.y = 0;
  safe.appearance = normalizeAppearance(safe.appearance);
  safe.settings = {
    quality: ["low", "medium", "high"].includes(s.settings?.quality)
      ? s.settings.quality
      : "medium",
    sound: !!s.settings?.sound,
  };
  return safe;
}
export function loadState(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return raw ? validateSave(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export function transact(state, cost, apply) {
  if (!Number.isFinite(cost) || cost < 0 || state.cash < cost) return false;
  state.cash -= cost;
  apply?.();
  return true;
}
export function advanceTime(s, minutes) {
  s.minutes += minutes;
  while (s.minutes >= 1440) {
    s.minutes -= 1440;
    s.day++;
    if (s.day >= s.rentDue) s.rentPaid = false;
  }
}
export function tickNeeds(s, dt, running = false) {
  advanceTime(s, dt * 2);
  s.hunger = clamp(s.hunger - dt * 0.045, 0, 100);
  s.energy = clamp(s.energy - dt * (running ? 0.07 : 0.018), 0, 100);
  if (s.hunger < 5) s.health = clamp(s.health - dt * 0.03, 10, 100);
}
export function circleBlocked(x, z, r, boxes) {
  return boxes.some((b) => {
    const cx = clamp(x, b.minX, b.maxX),
      cz = clamp(z, b.minZ, b.maxZ);
    return (x - cx) ** 2 + (z - cz) ** 2 < r * r;
  });
}
export function moveWithCollision(p, dx, dz, r, boxes, limit = 108) {
  const ox = p.x,
    oz = p.z;
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(dx, dz) / Math.max(0.1, r * 0.5)),
  );
  for (let i = 0; i < steps; i++) {
    const x = clamp(p.x + dx / steps, -limit + r, limit - r);
    if (!circleBlocked(x, p.z, r, boxes)) p.x = x;
    const z = clamp(p.z + dz / steps, -limit + r, limit - r);
    if (!circleBlocked(p.x, z, r, boxes)) p.z = z;
  }
  return Math.hypot(p.x - ox, p.z - oz);
}
export function stepVehicle(car, input, dt, boxes) {
  let speed = car.speed || 0;
  const power = car.fuel > 0 && car.condition > 0 ? 1 : 0;
  if (input.gas) speed += 5.6 * power * dt;
  if (input.brake) speed -= dt * (speed > 0 ? 12 : 3 * power);
  if (!input.gas && !input.brake) speed *= Math.exp(-0.35 * dt);
  if (input.handbrake) speed *= Math.exp(-5 * dt);
  speed = clamp(speed, -4, 23);
  if (Math.abs(speed) < 0.025) speed = 0;
  const steering = Number(!!input.left) - Number(!!input.right);
  car.steer =
    (car.steer || 0) +
    (steering * 0.46 - (car.steer || 0)) * Math.min(1, dt * 7);
  car.yaw +=
    ((speed / 2.65) * Math.tan(car.steer) * dt) / (1 + Math.abs(speed) * 0.065);
  const before = { x: car.x, z: car.z };
  moveVehicle(
    car,
    -Math.sin(car.yaw) * speed * dt,
    -Math.cos(car.yaw) * speed * dt,
    boxes,
  );
  const wanted = Math.abs(speed) * dt,
    moved = Math.hypot(car.x - before.x, car.z - before.z);
  const crashed = wanted > 0.035 && moved < wanted * 0.55;
  if (crashed) {
    car.condition = clamp(car.condition - Math.abs(speed) * 0.5, 0, 100);
    speed *= -0.12;
  }
  car.fuel = clamp(car.fuel - Math.abs(speed) * dt * 0.0035, 0, 100);
  car.speed = speed;
  return { crashed, moved };
}

function moveVehicle(car, dx, dz, boxes) {
  const blocked = (x, z) =>
    [-1.3, 0, 1.3].some((offset) =>
      circleBlocked(
        x - Math.sin(car.yaw) * offset,
        z - Math.cos(car.yaw) * offset,
        0.91,
        boxes,
      ),
    );
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
  for (let i = 0; i < steps; i++) {
    const x = clamp(car.x + dx / steps, -104, 104);
    if (!blocked(x, car.z)) car.x = x;
    const z = clamp(car.z + dz / steps, -104, 104);
    if (!blocked(car.x, z)) car.z = z;
  }
}
