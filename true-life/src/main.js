import "./style.css";
import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createWorld, PLACES } from "./world.js";
import { createCharacter } from "./character.js";
import { createVehicle } from "./vehicle.js";
import { createInput } from "./input.js";
import { V } from "./geometry.js";
import {
  SAVE_KEY,
  freshState,
  loadState,
  validateSave,
  transact,
  money,
  advanceTime,
  tickNeeds,
  clamp,
  circleBlocked,
  moveWithCollision,
  stepVehicle,
} from "./state.js";
const $ = (id) => document.getElementById(id);
const groundHeight = (x, z) =>
  state?.interior
    ? 0
    : (Math.abs(x) >= 7 && Math.abs(x) <= 11) ||
        (Math.abs(z) >= 7 && Math.abs(z) <= 11)
      ? 0.13
      : 0.025;
let state,
  world,
  renderer,
  scene,
  camera,
  player,
  car,
  input,
  started = false,
  paused = true,
  driving = false,
  sitting = false,
  mode = "welcome",
  jumpVelocity = 0,
  playerSpeed = 0,
  lightsOn = false,
  signal = false,
  openHood = false,
  openTrunk = false,
  doorTimer = 0,
  saveTimer = 0,
  uiTimer = 0,
  toastTimer = 0,
  lastCollision = -10,
  lastStep = 0,
  entryFrom = null,
  entryProgress = 0,
  waypoint = PLACES[0],
  context = null,
  audio = null,
  soundEnabled = false,
  elapsed = 0;
let loaded = false;
try {
  state = loadState(localStorage) || freshState();
  loaded = !!loadState(localStorage);
} catch {
  state = freshState();
}
const coarse = matchMedia("(pointer:coarse)").matches;
if (!loaded && coarse) state.settings.quality = "low";
function notify(text) {
  $("toast").textContent = text;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 4300);
}
function save() {
  if (!started) return;
  state.car.x = car.group.position.x;
  state.car.z = car.group.position.z;
  state.car.yaw = car.group.rotation.y;
  state.position = {
    x: player.group.position.x,
    y: 0,
    z: player.group.position.z,
  };
  state.yaw = input.yaw;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    $("save-label").textContent = "LOCAL SAVE · SAVED JUST NOW";
    return true;
  } catch {
    $("save-label").textContent = "SAVE UNAVAILABLE · EXPORT FROM PAUSE";
    return false;
  }
}
function beep(freq = 220, duration = 0.07, volume = 0.025, type = "sine") {
  if (!soundEnabled) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audio.currentTime);
    g.gain.setValueAtTime(volume, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + duration);
  } catch {
    soundEnabled = false;
  }
}
function disposeCharacter(c) {
  c.group.removeFromParent();
  c.dispose();
}
function rebuildPlayer() {
  const p =
      player?.group.position.clone() ||
      V(state.position.x, 0, state.position.z),
    yaw = player?.group.rotation.y || 0;
  if (player) disposeCharacter(player);
  player = createCharacter(state.appearance);
  player.group.position.copy(p);
  player.group.rotation.y = yaw;
  scene.add(player.group);
}
function setMode(next) {
  mode = next;
  paused = next !== "play";
  $("modal-layer").hidden = !paused;
  for (const [id, value] of [
    ["welcome", "welcome"],
    ["pause-sheet", "pause"],
    ["map-sheet", "map"],
  ])
    $(id).hidden = next !== value;
  input?.clear();
  if (paused && started) save();
}
function pause() {
  if (!started) return;
  setMode(paused ? "play" : "pause");
}
function visit(id) {
  if (!state.visited.includes(id)) {
    state.visited.push(id);
    notify(
      id === "home"
        ? "Your apartment, your fresh start. Rest up and make it yours."
        : `Discovered ${PLACES.find((p) => p.id === id)?.name || id}.`,
    );
  }
  save();
}
function switchInterior(id) {
  if (driving) return;
  sitting = false;
  state.returnPoint = {
    x: player.group.position.x,
    z: player.group.position.z,
  };
  state.interior = id;
  car.group.visible = false;
  world.enter(id);
  player.group.position.set(0, 0, 4);
  input.yaw = 0;
  input.pitch = 0.15;
  camera.position.set(0, 2.6, 6);
  visit(id);
}
function exitInterior() {
  const loc = PLACES.find((p) => p.id === state.interior);
  const p = state.returnPoint || { x: loc.x, z: loc.z + 1.5 };
  world.exit();
  state.interior = null;
  car.group.visible = true;
  player.group.position.set(p.x, 0, p.z + 1.5);
  input.yaw = Math.PI;
  input.pitch = 0.2;
  camera.position.copy(player.group.position).add(V(0, 3, -5));
  save();
}
function toggleCar() {
  if (driving) {
    if (Math.abs(state.car.speed || 0) > 1.3) {
      notify("Stop the car before getting out.");
      return;
    }
    let exit = null;
    for (const side of [-1, 1]) {
      const p = V(side * 1.8, 0, 0)
        .applyAxisAngle(V(0, 1, 0), state.car.yaw)
        .add(car.group.position);
      if (
        !circleBlocked(p.x, p.z, 0.35, world.outsideBoxes) &&
        !world.traffic.some(
          (t) =>
            Math.hypot(t.group.position.x - p.x, t.group.position.z - p.z) <
            1.4,
        )
      ) {
        exit = p;
        break;
      }
    }
    if (!exit) {
      notify("The door is blocked. Move the car to an open space.");
      return;
    }
    driving = false;
    player.group.position.copy(exit);
    player.group.visible = true;
    state.car.speed = 0;
    input.yaw = state.car.yaw;
    doorTimer = 1.3;
    state.completed.includes("drive") || state.completed.push("drive");
    save();
  } else {
    entryFrom = player.group.position.clone();
    entryProgress = 0;
    driving = true;
    sitting = false;
    player.group.visible = true;
    doorTimer = 1.2;
    input.yaw = state.car.yaw;
    input.pitch = 0.18;
    notify(
      "WASD to drive · E to exit when stopped. Mobile: arrows and pedals.",
    );
  }
  document.body.classList.toggle("driving", driving);
  $("walk-controls").hidden = driving;
  $("drive-controls").hidden = !driving;
  $("speedometer").hidden = !driving;
}
function charge(cost, action, message) {
  if (!transact(state, cost, action)) {
    notify(`You need ${money(cost)}. Try a café shift to earn money.`);
    return false;
  }
  notify(message);
  save();
  return true;
}
function act(id) {
  if (id === "exit") {
    exitInterior();
    return;
  }
  if (id === "sleep") {
    advanceTime(state, 480);
    state.energy = 100;
    state.hunger = clamp(state.hunger - 18, 0, 100);
    state.health = clamp(state.health + 12, 0, 100);
    state.completed.includes("sleep") || state.completed.push("sleep");
    notify("Eight hours of sleep. A fresh start.");
    save();
  }
  if (id === "sit") {
    sitting = !sitting;
    if (sitting) {
      player.group.position.set(-4, 0, 1);
      player.group.rotation.y = Math.PI;
      notify("Taking a moment. Move to stand up.");
    }
  }
  if (id === "rent") {
    if (state.day < state.rentDue) {
      notify(
        `Your first week is covered. Next rent: day ${state.rentDue}, $120.`,
      );
      return;
    }
    charge(
      120,
      () => {
        state.rentDue = state.day + 7;
        state.rentPaid = true;
      },
      "Rent paid. Seven more days at Magnolia Apartments.",
    );
  }
  if (id === "meal" || id === "food")
    charge(
      id === "food" ? 8 : 6,
      () => {
        state.hunger = clamp(state.hunger + 45, 0, 100);
        state.health = clamp(state.health + 3, 0, 100);
      },
      "A good meal. Hunger restored.",
    );
  if (id === "work") {
    if (!state.job.employed) {
      state.job.employed = true;
      state.job.stage = 1;
      notify(
        "You’re hired! Collect the order at the right end of the counter.",
      );
    } else if (state.job.stage === 0) {
      state.job.stage = 1;
      notify(
        "Shift started. Collect an order, serve a table, then return the dishes.",
      );
    } else
      notify(
        "Finish your current task: " +
          ["", "collect the order", "serve the table", "return the dishes"][
            state.job.stage
          ],
      );
    save();
  }
  if (id === "pickup") {
    if (state.job.stage === 1) {
      state.job.stage = 2;
      notify("Order collected. Walk to the table on your right.");
      beep(540);
    } else notify("Ask Maya at the center counter to start a shift.");
    save();
  }
  if (id === "deliver") {
    if (state.job.stage === 2) {
      state.job.stage = 3;
      notify("Order served. Return dishes at the left end of the counter.");
      beep(650);
    } else notify("Collect an order before serving this table.");
    save();
  }
  if (id === "wash") {
    if (state.job.stage === 3) {
      state.cash += 30;
      state.job.stage = 0;
      state.job.shifts++;
      state.energy = clamp(state.energy - 4, 0, 100);
      advanceTime(state, 30);
      notify("Shift complete. You earned $30. Talk to Maya for another shift.");
      beep(760, 0.15);
      save();
    } else
      notify("Complete an order and table service before returning dishes.");
  }
  if (id === "deposit") {
    charge(
      50,
      () => (state.bank += 50),
      `Deposited $50. Bank balance: ${money(state.bank + 50)}.`,
    );
  }
  if (id === "withdraw") {
    if (state.bank < 50) {
      notify("Your bank balance is below $50.");
      return;
    }
    state.bank -= 50;
    state.cash += 50;
    notify(`Withdrew $50. Bank balance: ${money(state.bank)}.`);
    save();
  }
  if (id === "clothes" || id === "clothes2") {
    const outfit = id === "clothes" ? "#663e41" : "#b6a18b";
    if (state.inventory.includes(outfit)) {
      state.appearance.outfit = outfit;
      rebuildPlayer();
      notify("Changed into your owned outfit.");
      save();
    } else
      charge(
        35,
        () => {
          state.inventory.push(outfit);
          state.appearance.outfit = outfit;
          rebuildPlayer();
        },
        "Outfit purchased and equipped.",
      );
  }
  if (id === "fuel")
    charge(20, () => (state.car.fuel = 100), "Tank filled. Your car is ready.");
  if (id === "repair")
    charge(
      60,
      () => (state.car.condition = 100),
      "Car repaired. Condition restored.",
    );
  if (id === "buycar") {
    if (state.inventory.includes("sage-sedan")) {
      notify("You already own the sage sedan. It is parked outside.");
      return;
    }
    charge(
      1200,
      () => {
        state.inventory.push("sage-sedan");
        car.group.traverse((o) => {
          if (o.isMesh && o.material.metalness === 0.58)
            o.material.color.set("#899a82");
        });
        state.car.paint = "#899a82";
      },
      "Sage sedan purchased. Your drivable car has been exchanged outside.",
    );
  }
}
function findContext() {
  if (driving)
    return {
      type: "car",
      label: "Exit vehicle",
      description: "Stop safely before getting out.",
    };
  const pos = player.group.position;
  if (state.interior) {
    let best = null,
      dist = 2.15;
    for (const o of world.interiorObjects) {
      const d = Math.hypot(pos.x - o.x, pos.z - o.z);
      if (d < dist) {
        best = {
          type: "object",
          id: o.id,
          label: o.label,
          description: PLACES.find((p) => p.id === state.interior)?.name,
        };
        dist = d;
      }
    }
    return best;
  }
  const carDist = pos.distanceTo(car.group.position);
  if (carDist < 3.1) {
    const local = pos
      .clone()
      .sub(car.group.position)
      .applyAxisAngle(V(0, 1, 0), -state.car.yaw);
    if (local.z < -1.65 && Math.abs(local.x) < 1.2)
      return {
        type: "hood",
        label: openHood ? "Close hood" : "Open hood",
        description: "Engine compartment",
      };
    if (local.z > 1.8 && Math.abs(local.x) < 1.2)
      return {
        type: "trunk",
        label: openTrunk ? "Close trunk" : "Open trunk",
        description: "Rear storage",
      };
    return {
      type: "car",
      label: "Enter your car",
      description: "1980s burgundy sedan · yours",
    };
  }
  for (const p of PLACES)
    if (Math.hypot(pos.x - p.x, pos.z - p.z) < 2.8)
      return {
        type: "door",
        id: p.id,
        label: "Enter " + p.name,
        description: p.type,
      };
  for (const n of world.npcs)
    if (n.group.visible && n.group.position.distanceTo(pos) < 2)
      return {
        type: "npc",
        id: n.name,
        label: "Talk to " + n.name,
        description: state.friends[n.name]
          ? "A familiar face"
          : "Meet your neighbors",
      };
  return null;
}
function interact() {
  if (paused || !started) return;
  const c = findContext();
  if (!c) return;
  if (c.type === "car") toggleCar();
  else if (c.type === "door") switchInterior(c.id);
  else if (c.type === "object") act(c.id);
  else if (c.type === "hood") openHood = !openHood;
  else if (c.type === "trunk") openTrunk = !openTrunk;
  else if (c.type === "npc") {
    const value = state.friends[c.id] || { score: 0, lastDay: 0 };
    const first = !value.score;
    if (value.lastDay !== state.day) {
      value.score++;
      value.lastDay = state.day;
    }
    state.friends[c.id] = value;
    notify(
      first
        ? `${c.id}: “Welcome to Eastbrook! Maya’s hiring at Juniper Café.”`
        : `${c.id}: “Good to see you again, ${state.name.split(" ")[0]}. How’s your day?”`,
    );
    save();
  }
}
function objective() {
  if (state.interior === "cafe" && state.job.stage)
    return {
      title: [
        "",
        "Take the first order",
        "A little table service",
        "Finish your shift",
      ][state.job.stage],
      text: [
        "",
        "Collect the tray at the right end of the counter.",
        "Walk to the table on the right and serve the order.",
        "Return dishes at the left end of the counter.",
      ][state.job.stage],
      place: PLACES[1],
    };
  if (!state.visited.includes("home"))
    return {
      title: "A place to call home",
      text: "Your first week is covered. Visit Magnolia Apartments.",
      place: PLACES[0],
    };
  if (!state.job.shifts)
    return {
      title: "Earn your first paycheck",
      text: "Visit Juniper Café. Talk to Maya and work a shift.",
      place: PLACES[1],
    };
  if (!state.completed.includes("drive"))
    return {
      title: "The road is yours",
      text: "Your burgundy sedan is parked on Magnolia Street. Take a drive.",
      place: { id: "car", name: "Your car", x: state.car.x, z: state.car.z },
    };
  return {
    title: "Make Eastbrook your own",
    text: `Day ${state.day} · ${state.job.shifts} café shifts · ${Object.keys(state.friends).length} neighbors met. Next rent: day ${state.rentDue}.`,
    place: PLACES[2],
  };
}
function drawMap() {
  const c = $("minimap"),
    ctx = c.getContext("2d"),
    w = c.width,
    h = c.height,
    scale = 1.3,
    cx = w / 2,
    cy = h / 2;
  ctx.fillStyle = "#a8ad8a";
  ctx.fillRect(0, 0, w, h);
  const p = driving ? car.group.position : player.group.position;
  function point(x, z) {
    return [cx + (x - p.x) * scale, cy + (z - p.z) * scale];
  }
  ctx.lineCap = "square";
  ctx.lineWidth = 14 * scale;
  ctx.strokeStyle = "#d9d7bb";
  for (const [a, b] of [
    [
      [0, -120],
      [0, 120],
    ],
    [
      [-120, 0],
      [120, 0],
    ],
    [
      [-90, -76],
      [90, -76],
    ],
    [
      [-90, 76],
      [90, 76],
    ],
    [
      [-76, -90],
      [-76, 90],
    ],
    [
      [76, -90],
      [76, 90],
    ],
  ]) {
    ctx.beginPath();
    ctx.moveTo(...point(...a));
    ctx.lineTo(...point(...b));
    ctx.stroke();
  }
  ctx.fillStyle = "#7d8d75";
  for (const pl of PLACES) {
    const [x, y] = point(pl.x, pl.z - 8);
    ctx.fillRect(x - 10, y - 9, 20, 18);
  }
  for (const pl of PLACES) {
    const [x, y] = point(pl.x, pl.z);
    ctx.fillStyle = pl.color;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (waypoint && !state.interior) {
    const [x, y] = point(waypoint.x, waypoint.z);
    ctx.strokeStyle = "#a77732";
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#efc97b";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 7);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-(driving ? state.car.yaw : input.yaw));
  ctx.fillStyle = "#263d33";
  ctx.strokeStyle = "#f4edc7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#314b3d";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("N", w - 18, 19);
}
function updateUI() {
  const mins = Math.floor(state.minutes);
  $("cash").textContent = money(state.cash);
  $("clock").textContent =
    `DAY ${state.day}  ${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  $("weather-label").textContent =
    state.minutes > 1140 || state.minutes < 360 ? "Clear night" : "Clear skies";
  for (const id of ["hunger", "energy", "health"]) $(id).value = state[id];
  const obj = objective();
  $("objective-title").textContent = obj.title;
  $("objective-text").textContent = obj.text;
  $("location").textContent = state.interior
    ? PLACES.find((p) => p.id === state.interior).name.toUpperCase()
    : "EASTBROOK";
  context = findContext();
  $("interact").hidden = !context;
  $("interact-label").textContent = context?.label || "";
  $("context-text").textContent = context?.description || "";
  if (driving) {
    $("speed").textContent = Math.round(Math.abs(state.car.speed || 0) * 2.237);
    $("car-info").textContent =
      `Fuel ${Math.ceil(state.car.fuel)}% · Condition ${Math.ceil(state.car.condition)}%`;
  }
  $("waypoint").hidden = !waypoint || !!state.interior;
  if (waypoint && !state.interior) {
    const p = driving ? car.group.position : player.group.position;
    const distance = Math.hypot(waypoint.x - p.x, waypoint.z - p.z);
    $("waypoint").textContent =
      `◇ ${waypoint.name} · ${Math.round(distance)} m`;
    if (distance < 3) waypoint = null;
  }
  drawMap();
}
function setupUI() {
  const fields = ["gender", "skin", "hair", "build", "outfit", "face"];
  $("player-name").value = state.name;
  for (const f of fields) $(f).value = state.appearance[f];
  $("start").innerHTML = loaded
    ? "Continue your story <span>→</span>"
    : "Begin your story <span>→</span>";
  for (const f of fields)
    $(f).onchange = () => {
      state.appearance[f] = $(f).value;
      rebuildPlayer();
    };
  $("character-form").onsubmit = (e) => {
    e.preventDefault();
    const name = $("player-name").value.trim();
    if (!name) return;
    state.name = name;
    if (!state.inventory.includes(state.appearance.outfit))
      state.inventory.push(state.appearance.outfit);
    started = true;
    $("hud").hidden = false;
    setMode("play");
    cameraUpdate(1);
    save();
    notify(
      loaded
        ? "Welcome back to Eastbrook."
        : "Welcome to Eastbrook. Drag to look around; WASD or the walking joystick to move.",
    );
  };
  $("pause").onclick = pause;
  $("resume").onclick = () => setMode("play");
  $("interact").onclick = interact;
  $("save").onclick = () => {
    if (save()) notify("Your story is saved on this device.");
  };
  $("appearance").onclick = () => {
    if (driving) {
      notify("Step out of your car to change appearance.");
      return;
    }
    for (const option of $("outfit").options)
      option.disabled =
        option.value !== state.appearance.outfit &&
        !state.inventory.includes(option.value);
    setMode("welcome");
    $("start").innerHTML = "Return to your story <span>→</span>";
  };
  $("quality").value = state.settings.quality;
  $("quality").onchange = () => {
    state.settings.quality = $("quality").value;
    applyQuality();
    save();
  };
  soundEnabled = state.settings.sound;
  $("sound").textContent = soundEnabled ? "Sound on" : "Sound off";
  $("sound").onclick = () => {
    soundEnabled = !soundEnabled;
    state.settings.sound = soundEnabled;
    $("sound").textContent = soundEnabled ? "Sound on" : "Sound off";
    beep(440);
    save();
  };
  $("export").onclick = () => {
    save();
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    a.href = url;
    a.download = "true-life-save.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("import").onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 100000) throw Error("Save file is too large.");
      const incoming = validateSave(JSON.parse(await file.text()));
      localStorage.setItem(SAVE_KEY, JSON.stringify(incoming));
      location.reload();
    } catch (err) {
      notify(err.message);
    }
    e.target.value = "";
  };
  const map = () => {
    if (!started) return;
    setMode(mode === "map" ? "play" : "map");
  };
  $("map-button").onclick = map;
  $("destinations").onclick = map;
  $("close-map").onclick = () => setMode("play");
  $("navigate").onclick = () => {
    waypoint = objective().place;
    notify("Destination marked on your minimap.");
  };
  $("destination-list").replaceChildren(
    ...PLACES.map((p) => {
      const b = document.createElement("button"),
        label = document.createElement("span"),
        small = document.createElement("small");
      label.textContent = p.name;
      small.textContent = "Navigate ↗";
      b.append(label, small);
      b.onclick = () => {
        waypoint = p;
        setMode("play");
        notify(p.name + " marked on your map.");
      };
      return b;
    }),
  );
  $("lights").onclick = () => {
    lightsOn = !lightsOn;
  };
  $("horn").onclick = () => beep(180, 0.35, 0.08, "sawtooth");
  $("indicator").onclick = () => (signal = !signal);
  window.addEventListener("pagehide", save);
  window.addEventListener("resize", resize);
}
function applyQuality() {
  const q = state.settings.quality;
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, q === "high" ? 2 : q === "low" ? 1 : 1.5),
  );
  renderer.shadowMap.enabled = q !== "low";
  sun.castShadow = q !== "low";
  sun.shadow.mapSize.set(
    q === "high" ? 2048 : 1024,
    q === "high" ? 2048 : 1024,
  );
  if (sun.shadow.map) {
    sun.shadow.map.dispose();
    sun.shadow.map = null;
  }
  resize();
}
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
let sun,
  hemi,
  sky,
  lastFrame = 0,
  fpsSeconds = 0,
  fpsFrames = 0,
  autoLow = false;
const cameraTarget = V(),
  desired = V(),
  ray = new T.Raycaster();
function cameraUpdate(dt) {
  const focus = driving ? car.group.position : player.group.position;
  cameraTarget.copy(focus).add(V(0, driving ? 1.25 : 1.27, 0));
  const distance = driving ? 7.5 : 4.2,
    pitch = input.pitch + 0.18;
  desired
    .set(
      Math.sin(input.yaw) * Math.cos(pitch) * distance,
      Math.sin(pitch) * distance,
      Math.cos(input.yaw) * Math.cos(pitch) * distance,
    )
    .add(cameraTarget);
  if (state.interior) {
    desired.x = clamp(desired.x, -7.7, 7.7);
    desired.z = clamp(desired.z, -5.7, 5.7);
    desired.y = Math.min(desired.y, 3.04);
  } else {
    const dir = desired.clone().sub(cameraTarget),
      max = dir.length();
    ray.set(cameraTarget, dir.normalize());
    ray.far = max;
    const hits = ray.intersectObjects(world.outside.children, true);
    const hit = hits.find((h) => h.distance > 0.35);
    if (hit)
      desired
        .copy(cameraTarget)
        .addScaledVector(dir, Math.max(0.8, hit.distance - 0.2));
  }
  camera.position.lerp(desired, 1 - Math.exp(-dt * 6));
  camera.position.y = Math.max(camera.position.y, 0.35);
  camera.lookAt(cameraTarget);
}
function update(dt) {
  elapsed += dt;
  if (!paused && started) {
    tickNeeds(state, dt, input.sprint);
    const move = input.movement();
    if (driving) {
      const control = input.vehicle(),
        result = stepVehicle(state.car, control, dt, world.outsideBoxes);
      car.group.position.set(state.car.x, 0, state.car.z);
      car.group.rotation.y = state.car.yaw;
      const seat = V(-0.4, 0.09, 0.22)
        .applyAxisAngle(V(0, 1, 0), state.car.yaw)
        .add(car.group.position);
      entryProgress = Math.min(1, entryProgress + dt * 1.8);
      const eased = entryProgress * entryProgress * (3 - 2 * entryProgress);
      player.group.position.copy(entryFrom || seat).lerp(seat, eased);
      player.group.rotation.y = state.car.yaw;
      player.animate(dt, 0, { sit: true, enter: Math.min(1, doorTimer) });
      if (result.crashed && elapsed - lastCollision > 1.5) {
        lastCollision = elapsed;
        notify("Collision. Your car needs a little care.");
        beep(90, 0.13);
      }
      if (!input.keys.has("alt"))
        input.yaw = T.MathUtils.damp(input.yaw, state.car.yaw, 1.3, dt);
      if (
        state.car.fuel === 0 &&
        Math.abs(state.car.speed) < 0.5 &&
        elapsed - lastCollision > 10
      ) {
        lastCollision = elapsed;
        notify("Out of fuel. Visit Magnolia Motors to refuel.");
      }
    } else {
      if (sitting && move.length > 0.1) {
        sitting = false;
        player.group.position.z = 2.2;
      }
      const speed = sitting
        ? 0
        : input.crouch
          ? 1.1
          : input.sprint && state.energy > 5
            ? 4.8
            : 2.35;
      const desiredSpeed = speed * move.length;
      playerSpeed = T.MathUtils.damp(playerSpeed, desiredSpeed, 12, dt);
      const direction = V(move.x, 0, move.z).applyAxisAngle(
        V(0, 1, 0),
        input.yaw,
      );
      if (direction.length() > 0.01) {
        direction.normalize();
        const targetYaw = Math.atan2(-direction.x, -direction.z);
        player.group.rotation.y +=
          Math.atan2(
            Math.sin(targetYaw - player.group.rotation.y),
            Math.cos(targetYaw - player.group.rotation.y),
          ) * Math.min(1, dt * 12);
      }
      const boxes = state.interior ? world.insideBoxes : world.outsideBoxes;
      const moved = moveWithCollision(
        player.group.position,
        direction.x * playerSpeed * dt,
        direction.z * playerSpeed * dt,
        0.31,
        boxes,
        state.interior ? 7.7 : 108,
      );
      if (state.interior)
        player.group.position.z = clamp(player.group.position.z, -5.6, 5.6);
      if (!state.interior) {
        const cp = car.group.position,
          local = player.group.position
            .clone()
            .sub(cp)
            .applyAxisAngle(V(0, 1, 0), -state.car.yaw);
        if (Math.abs(local.x) < 1.24 && Math.abs(local.z) < 2.6) {
          if (1.24 - Math.abs(local.x) < 2.6 - Math.abs(local.z))
            local.x = (local.x < 0 ? -1 : 1) * 1.25;
          else local.z = (local.z < 0 ? -1 : 1) * 2.61;
          local.applyAxisAngle(V(0, 1, 0), state.car.yaw).add(cp);
          player.group.position.x = local.x;
          player.group.position.z = local.z;
        }
        for (const t of world.traffic) {
          if (
            t.group.position.distanceTo(player.group.position) < 1.3 &&
            elapsed - lastCollision > 3
          ) {
            lastCollision = elapsed;
            state.health = clamp(state.health - 5, 10, 100);
            player.group.position.x = t.group.position.x < 0 ? -8.8 : 8.8;
            notify("Watch the traffic. Use the crosswalks.");
          }
        }
      }
      const ground = groundHeight(
        player.group.position.x,
        player.group.position.z,
      );
      if (input.jump && player.group.position.y <= ground + 0.01 && !sitting)
        jumpVelocity = 4;
      input.jump = false;
      jumpVelocity -= dt * 10.8;
      player.group.position.y = Math.max(
        ground,
        player.group.position.y + jumpVelocity * dt,
      );
      if (player.group.position.y <= ground) jumpVelocity = 0;
      player.animate(dt, moved / dt, {
        run: input.sprint,
        crouch: input.crouch,
        air: player.group.position.y > ground + 0.05,
        sit: sitting,
      });
      if (sitting) {
        state.energy = clamp(state.energy + dt * 0.08, 0, 100);
      }
      if (
        moved > 0.001 &&
        elapsed - lastStep > (input.sprint ? 0.3 : 0.48) &&
        player.group.position.y <= ground + 0.01
      ) {
        lastStep = elapsed;
        beep(105, 0.035, 0.008, "triangle");
      }
    }
    doorTimer = Math.max(0, doorTimer - dt);
    saveTimer += dt;
    if (saveTimer > 12) {
      saveTimer = 0;
      save();
    }
    world.update(dt, state.minutes, player.group.position);
  }
  car.animate(dt, {
    speed: driving ? state.car.speed : 0,
    steer: state.car.steer || 0,
    braking: driving && input.vehicle().brake,
    lights: lightsOn,
    signal,
    door: doorTimer > 0 ? 1 : 0,
    hood: openHood ? 1 : 0,
    trunk: openTrunk ? 1 : 0,
  });
  if (!paused) cameraUpdate(dt);
  else if (!started) {
    const p = player.group.position;
    camera.position.set(p.x + 4.8, 2.9, p.z - 5.7);
    camera.lookAt(p.x - 0.6, 1.1, p.z - 0.1);
  }
  const hour = state.minutes / 60,
    day = clamp(Math.sin(((hour - 6) / 12) * Math.PI), 0, 1);
  hemi.intensity = 0.65 + day * 1.35;
  sun.intensity = 0.15 + day * 2.3;
  sun.position.set(Math.cos((hour / 24) * Math.PI * 2) * 45, 15 + day * 55, 30);
  const shadowFocus = driving ? car.group.position : player.group.position;
  sun.position.add(V(shadowFocus.x, 0, shadowFocus.z));
  sun.target.position.set(shadowFocus.x, 0, shadowFocus.z);
  sun.target.updateMatrixWorld();
  sun.color.set(day > 0.25 ? "#ffe1ac" : "#b1c5d8");
  scene.fog.color.set(day > 0.2 ? "#c1cbbb" : "#3b505a");
  scene.background.set(day > 0.2 ? "#bacfce" : "#283c51");
  uiTimer += dt;
  if (uiTimer > 0.12) {
    uiTimer = 0;
    updateUI();
  }
  fpsSeconds += dt;
  fpsFrames++;
  if (fpsSeconds > 6 && started && !paused) {
    if (
      fpsFrames / fpsSeconds < 25 &&
      state.settings.quality !== "low" &&
      !autoLow
    ) {
      state.settings.quality = "low";
      $("quality").value = "low";
      applyQuality();
      autoLow = true;
      notify(
        "Graphics adjusted for smoother play. You can change this in Pause.",
      );
    }
    fpsSeconds = 0;
    fpsFrames = 0;
  }
}
function frame(ms) {
  const dt = Math.min(0.05, (ms - lastFrame) / 1000 || 0.016);
  lastFrame = ms;
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
async function boot() {
  try {
    renderer = new T.WebGLRenderer({
      antialias: !coarse,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    $("game").append(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "Drag to rotate the camera");
    scene = new T.Scene();
    scene.background = new T.Color("#bacfce");
    scene.fog = new T.Fog("#c1cbbb", 65, 210);
    camera = new T.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 450);
    hemi = new T.HemisphereLight("#d7e5ed", "#7b7956", 2);
    scene.add(hemi);
    sun = new T.DirectionalLight("#ffe4b6", 2.5);
    sun.position.set(-35, 55, 25);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.0003;
    scene.add(sun, sun.target);
    const pmrem = new T.PMREMGenerator(renderer),
      room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    world = createWorld(scene);
    car = createVehicle({ color: state.car.paint || "#672e36" });
    car.group.position.set(state.car.x, 0, state.car.z);
    car.group.rotation.y = state.car.yaw;
    scene.add(car.group);
    rebuildPlayer();
    input = createInput(renderer.domElement, {
      interact,
      pause,
      map: () => {
        if (started) setMode(mode === "map" ? "play" : "map");
      },
      lights: () => {
        if (driving) lightsOn = !lightsOn;
      },
      horn: () => {
        if (driving) beep(180, 0.35, 0.08, "sawtooth");
      },
      signal: () => {
        if (driving) signal = !signal;
      },
      blur: () => {
        if (started && !paused) setMode("pause");
      },
    });
    input.yaw = state.yaw || 0;
    if (state.interior) {
      world.enter(state.interior);
      car.group.visible = false;
    }
    setupUI();
    applyQuality();
    cameraUpdate(1);
    updateUI();
    $("loading").hidden = true;
    requestAnimationFrame(frame);
    if (import.meta.env.DEV)
      window.__TRUE_LIFE__ = {
        get state() {
          return state;
        },
        get player() {
          return player;
        },
        get car() {
          return car;
        },
        get driving() {
          return driving;
        },
        get world() {
          return world;
        },
        get renderer() {
          return renderer;
        },
        get camera() {
          return camera;
        },
        get input() {
          return input;
        },
        save,
        interact,
        act,
        switchInterior,
        exitInterior,
        toggleCar,
        setMode,
        teleport(x, z) {
          player.group.position.set(x, 0, z);
          input.clear();
        },
      };
  } catch (err) {
    console.error(err);
    $("loading").hidden = true;
    $("fatal").hidden = false;
    $("fatal-message").textContent =
      "This game needs WebGL 2. Try an updated browser with graphics acceleration enabled. " +
      err.message;
  }
}
boot();
