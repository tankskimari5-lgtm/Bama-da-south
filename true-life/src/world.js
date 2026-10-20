import * as T from "three";
import {
  V,
  mat,
  box,
  ellipsoid,
  beam,
  sign,
  proceduralTexture,
  batchStatic,
  batchLocalMeshes,
  worldMapped,
} from "./geometry.js";
import { createCharacter } from "./character.js";
import { createVehicle } from "./vehicle.js";
export const PLACES = [
  {
    id: "home",
    name: "Magnolia Apartments",
    type: "Your apartment · sleep & rent",
    x: -30,
    z: 38,
    color: "#e5c48b",
  },
  {
    id: "cafe",
    name: "Juniper Café",
    type: "Food & hands-on café shifts",
    x: 30,
    z: 36,
    color: "#b8d3b0",
  },
  {
    id: "bank",
    name: "Eastbrook Credit Union",
    type: "Deposit or withdraw $50",
    x: -32,
    z: -14,
    color: "#adcbce",
  },
  {
    id: "shop",
    name: "Everyday Clothing",
    type: "New outfit · $35",
    x: 33,
    z: -17,
    color: "#c6ac92",
  },
  {
    id: "dealer",
    name: "Magnolia Motors",
    type: "Cars · repairs · fuel",
    x: 58,
    z: 36,
    color: "#d5c295",
  },
];
export function createWorld(scene) {
  const outside = new T.Group(),
    inside = new T.Group();
  scene.add(outside, inside);
  inside.visible = false;
  const outsideBoxes = [],
    insideBoxes = [],
    chunks = [],
    npcs = [],
    traffic = [];
  const asphalt = mat("#ffffff", {
      map: proceduralTexture("asphalt", "#626965"),
      roughness: 0.95,
    }),
    concrete = mat("#ffffff", {
      map: proceduralTexture("concrete", "#c5c3b0"),
    }),
    brick = mat("#ffffff", { map: proceduralTexture("brick", "#926b51") }),
    plaster = mat("#d0c5a9"),
    white = mat("#e2dfce"),
    roof = mat("#48514b"),
    grass = mat("#7b8b58"),
    leaves = mat("#446d42"),
    leavesLight = mat("#718345"),
    wood = mat("#ffffff", { map: proceduralTexture("wood", "#8e7152") }),
    metal = mat("#354b43", { metalness: 0.6, roughness: 0.4 }),
    windows = mat("#658080", { metalness: 0.35, roughness: 0.24 }),
    glow = mat("#eddcb1", { emissive: "#efc77b", emissiveIntensity: 0 }),
    roadPaint = mat("#ddd9b9");
  for (const m of [asphalt, concrete, brick, wood])
    worldMapped(m, m === brick ? 0.3 : m === wood ? 0.7 : 0.65);
  const blockers = (x, z, w, d, target = outsideBoxes) =>
    target.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
  function tree(root, x, z, size = 1) {
    beam(root, V(x, 0, z), V(x, 4 * size, z), 0.13 * size, wood);
    for (let i = 0; i < 4; i++) {
      const a = i * 2.4;
      const xx = x + Math.cos(a) * 1.1 * size,
        zz = z + Math.sin(a) * 1.1 * size;
      beam(root, V(x, 2.4 * size, z), V(xx, 4 * size, zz), 0.07 * size, wood);
      ellipsoid(
        root,
        xx,
        4.3 * size + Math.sin(i) * 0.4 * size,
        zz,
        1.7 * size,
        1.7 * size,
        1.55 * size,
        i % 2 ? leaves : leavesLight,
        10,
      );
    }
  }
  function window(root, x, y, z, w = 1.3, h = 1.6) {
    box(root, w + 0.15, h + 0.15, 0.1, x, y, z, white);
    box(root, w, h, 0.12, x, y, z + 0.03, windows);
    box(root, 0.045, h, 0.14, x, y, z + 0.08, white);
    box(root, w, 0.045, 0.14, x, y, z + 0.08, white);
    box(root, w + 0.23, 0.09, 0.23, x, y - h / 2 - 0.05, z + 0.04, white);
  }
  function door(root, x, z, w = 1.1) {
    box(root, w + 0.18, 2.38, 0.15, x, 1.19, z, white);
    box(root, w, 2.24, 0.18, x, 1.12, z + 0.03, wood);
    box(root, w * 0.63, 1.1, 0.025, x, 1.5, z + 0.13, windows);
    ellipsoid(root, x + w * 0.32, 1.05, z + 0.15, 0.035, 0.035, 0.035, metal);
    box(root, w + 1, 0.08, 1.1, x, 0.06, z + 0.5, concrete);
  }
  function roofGable(root, x, z, w, d, y) {
    const shape = new T.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(0, 2.7);
    shape.lineTo(w / 2, 0);
    shape.closePath();
    const mesh = new T.Mesh(
      new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }),
      roof,
    );
    mesh.position.set(x, y, z - d / 2);
    mesh.castShadow = true;
    root.add(mesh);
    box(root, w + 0.5, 0.15, d + 0.4, x, y, z, white);
  }
  function building(
    root,
    { x, z, w, d, h = 7, label, paint = brick, house = false },
  ) {
    box(root, w, h, d, x, h / 2, z, paint);
    blockers(x, z, w, d);
    box(root, w + 0.35, 0.22, d + 0.35, x, h + 0.1, z, white);
    box(root, w + 0.5, 0.22, 0.5, x, 0.25, z + d / 2, concrete);
    const front = z + d / 2 + 0.07;
    for (let floor = 0; floor < Math.floor(h / 3); floor++)
      for (let xx = -w / 2 + 2; xx < w / 2 - 1; xx += 2.6) {
        if (floor === 0 && Math.abs(xx) < 1.8) continue;
        window(root, x + xx, 1.8 + floor * 3, front, 1.4, 1.65);
      }
    door(root, x, front);
    if (house) roofGable(root, x, z, w + 0.8, d + 0.5, h);
    else {
      box(root, w * 0.52, 0.18, 1.8, x, 2.6, front + 0.7, roof);
      if (label) sign(root, label, x, 3.45, front + 0.18, Math.min(w - 1, 9));
    }
    box(root, 1.4, 0.06, 2.1, x, 0.07, front + 2, concrete);
    if (!house) {
      for (const xx of [-w / 2 + 0.6, w / 2 - 0.6]) {
        box(root, 1.1, 0.6, 1.1, x + xx, 0.3, front + 1.2, plaster);
        ellipsoid(root, x + xx, 0.8, front + 1.2, 0.6, 0.55, 0.6, leaves, 10);
      }
    }
  }
  const base = new T.Group();
  outside.add(base);
  box(base, 224, 0.3, 224, 0, -0.2, 0, grass);
  box(base, 224, 0.055, 14, 0, -0.01, 0, asphalt);
  box(base, 14, 0.055, 224, 0, -0.005, 0, asphalt);
  for (const z of [-76, 76]) box(base, 166, 0.055, 13, 0, 0, z, asphalt);
  for (const x of [-76, 76]) box(base, 13, 0.055, 166, x, 0.005, 0, asphalt);
  // Raised sidewalk strips, painted crosswalks, curbs and lane markings.
  for (const axis of [0, 1])
    for (const side of [-1, 1]) {
      const o = box(
        base,
        axis ? 198 : 4,
        0.17,
        axis ? 4 : 198,
        axis ? 0 : side * 9,
        0.045,
        axis ? side * 9 : 0,
        concrete,
      );
      o.receiveShadow = true;
    }
  for (let i = -102; i <= 102; i += 8) {
    if (Math.abs(i) > 11) {
      box(base, 0.12, 0.015, 3, 0, 0.04, i, roadPaint);
      box(base, 3, 0.015, 0.12, i, 0.04, 0, roadPaint);
    }
    for (const z of [-76, 76]) box(base, 3, 0.015, 0.12, i, 0.05, z, roadPaint);
  }
  for (const side of [-1, 1])
    for (let k = -5; k <= 5; k++) {
      box(base, 0.7, 0.02, 3, k * 1.1, 0.12, side * 11.5, white);
      box(base, 3, 0.02, 0.7, side * 11.5, 0.13, k * 1.1, white);
    }
  for (let z = -64; z < 74; z += 21)
    for (const x of [-9.5, 9.5]) {
      beam(base, V(x, 0.1, z), V(x, 5.3, z), 0.065, metal);
      beam(base, V(x, 5.3, z), V(x + (x < 0 ? 1 : -1), 5.3, z), 0.055, metal);
      box(base, 0.65, 0.13, 0.35, x + (x < 0 ? 1 : -1), 5.28, z, glow);
      tree(base, x < 0 ? -13 : 13, z + 5, 0.7);
    }
  // Traffic signals have corresponding red/green phases in the traffic update.
  const signalLights = [];
  for (const side of [-1, 1]) {
    beam(base, V(side * 10, 0, 10), V(side * 10, 4.8, 10), 0.09, metal);
    box(base, 0.43, 1.1, 0.36, side * 10, 4.2, 10, metal);
    for (let i = 0; i < 3; i++) {
      const m = mat(["#8b3327", "#ab8b35", "#45805b"][i], {
        emissive: ["#ff3322", "#ffbb22", "#55ee88"][i],
        emissiveIntensity: i === 2 ? 1 : 0,
      });
      ellipsoid(
        base,
        side * 10,
        4.56 - i * 0.31,
        10.2,
        0.12,
        0.12,
        0.035,
        m,
        10,
      );
      signalLights.push({ m, i });
    }
  }
  sign(base, "MAGNOLIA ST", -10.3, 3.3, 12, 3.5);
  sign(base, "EASTBROOK", 11.5, 2.3, -13, 3.5);
  // Close neighborhood chunks are batched independently and distance culled.
  const blockA = new T.Group();
  outside.add(blockA);
  building(blockA, {
    x: -30,
    z: 26,
    w: 20,
    d: 20,
    h: 9,
    label: "MAGNOLIA APARTMENTS",
  });
  building(blockA, {
    x: 30,
    z: 26,
    w: 17,
    d: 16,
    h: 4.5,
    label: "JUNIPER CAFÉ",
    paint: plaster,
  });
  building(blockA, {
    x: 58,
    z: 26,
    w: 19,
    d: 16,
    h: 4.2,
    label: "MAGNOLIA MOTORS",
    paint: mat("#a7b5a1"),
  });
  building(blockA, {
    x: -32,
    z: -26,
    w: 22,
    d: 20,
    h: 6,
    label: "EASTBROOK CREDIT UNION",
    paint: plaster,
  });
  building(blockA, {
    x: 33,
    z: -28,
    w: 20,
    d: 18,
    h: 5,
    label: "EVERYDAY",
    paint: mat("#b78969"),
  });
  for (const [x, z] of [
    [-55, 55],
    [-28, 58],
    [29, 58],
    [57, 58],
    [-57, -54],
    [-29, -55],
    [29, -56],
    [57, -54],
  ]) {
    building(blockA, {
      x,
      z,
      w: 13,
      d: 13,
      h: 3.4,
      house: true,
      paint: (x + z) % 2 ? plaster : brick,
    });
    box(blockA, 4, 0.06, 10, x + 9, 0.03, z + 8, concrete);
    box(blockA, 8, 0.08, 2, x, 0.04, z + 9, concrete);
    tree(blockA, x - 9, z + 5, 0.8);
    for (let k = -6; k < 7; k += 1.2) {
      beam(blockA, V(x + k, 0, z + 11), V(x + k, 0.9, z + 11), 0.025, white);
    }
    beam(blockA, V(x - 6, 0.65, z + 11), V(x + 6, 0.65, z + 11), 0.03, white);
  }
  // Café terrace, park, parking, power lines and small street furniture.
  for (let i = 0; i < 3; i++) {
    const x = 23 + i * 5;
    box(blockA, 1.1, 0.07, 1.1, x, 0.86, 38, wood);
    beam(blockA, V(x, 0.05, 38), V(x, 0.84, 38), 0.04, metal);
    for (const zz of [37, 39]) {
      box(blockA, 0.55, 0.05, 0.55, x, 0.47, zz, wood);
      beam(blockA, V(x, 0.05, zz), V(x, 0.47, zz), 0.035, metal);
    }
  }
  for (let i = 0; i < 5; i++) {
    box(blockA, 0.1, 0.02, 5, 50 + i * 3, 0.06, 41, white);
  }
  box(blockA, 20, 0.05, 13, 58, 0.02, 41, asphalt);
  for (const x of [-18, 18])
    for (const z of [-48, 49]) {
      box(blockA, 2, 0.12, 0.65, x, 0.54, z, wood);
      box(blockA, 2, 0.55, 0.1, x, 0.85, z + 0.3, wood);
      for (const xx of [-0.75, 0.75])
        beam(blockA, V(x + xx, 0.1, z), V(x + xx, 0.5, z), 0.04, metal);
      blockers(x, z, 2, 0.8);
    }
  for (let z = -65; z <= 65; z += 32) {
    beam(blockA, V(-15, 0, z), V(-15, 7, z), 0.09, wood);
    beam(blockA, V(-16, 6.6, z), V(-14, 6.6, z), 0.04, wood);
    if (z < 63)
      for (const x of [-15.6, -14.4]) {
        for (let k = 0; k < 8; k++)
          beam(
            blockA,
            V(x, 6.5 - Math.sin((k / 8) * Math.PI) * 0.65, z + k * 4),
            V(
              x,
              6.5 - Math.sin(((k + 1) / 8) * Math.PI) * 0.65,
              z + (k + 1) * 4,
            ),
            0.012,
            metal,
          );
      }
  }
  const skyline = new T.Group();
  outside.add(skyline);
  for (let i = 0; i < 19; i++) {
    const x = -100 + i * 11,
      z = -102 - (i % 3) * 8,
      h = 16 + ((i * 17) % 43),
      w = 7 + (i % 4);
    box(skyline, w, h, 9, x, h / 2, z, i % 2 ? plaster : mat("#879490"));
    for (let floor = 3; floor < h - 1; floor += 3)
      for (let k = -w / 2 + 1; k < w / 2; k += 2.2)
        box(skyline, 1.1, 1.5, 0.04, x + k, floor, z + 4.55, windows);
    box(skyline, w + 0.4, 0.3, 9.4, x, h, z, roof);
  }
  for (let i = 0; i < 35; i++) {
    const a = i * 2.4;
    tree(skyline, Math.sin(a) * 101, Math.cos(a) * 101, 0.8 + (i % 4) * 0.18);
  }
  for (const r of [base, blockA, skyline]) batchStatic(r);
  chunks.push({ group: skyline, x: 0, z: -100, distance: 270 });
  // Animated inhabitants with fixed sidewalk routes and individual memories.
  const npcDefs = [
    ["Maya", -10, 26, "#b88965"],
    ["Jordan", 10, -22, "#78523b"],
    ["Sam", -10, -35, "#e0b08a"],
    ["Avery", 10, 48, "#b47e55"],
    ["Riley", -45, 10, "#d9b69b"],
    ["Drew", 40, -10, "#69442e"],
  ];
  npcDefs.forEach(([name, x, z, skin], i) => {
    const ch = createCharacter(
      {
        skin,
        outfit: ["#736856", "#616f70", "#a17c54"][i % 3],
        hair: i % 3 === 0 ? "long" : "short",
      },
      { detail: "npc" },
    );
    ch.group.position.set(x, 0.12, z);
    outside.add(ch.group);
    npcs.push({
      ...ch,
      name,
      origin: V(x, 0, z),
      phase: i * 1.8,
      axis: Math.abs(x) === 10 ? "z" : "x",
      speed: 0.8 + (i % 3) * 0.15,
    });
  });
  for (let i = 0; i < 4; i++) {
    const c = createVehicle({
      detailed: false,
      color: ["#587268", "#d3ccb4", "#8e4c40", "#465568"][i],
    });
    outside.add(c.group);
    traffic.push({ ...c, progress: i * 76, speed: 5.2 + i * 0.3 });
  }
  const parked = createVehicle({ color: "#899a82", detailed: false });
  parked.group.position.set(57, 0, 42);
  parked.group.rotation.y = Math.PI / 2;
  outside.add(parked.group);
  blockers(57, 42, 4.6, 2.1);
  const wall = mat("#d7cbb4"),
    floor = mat("#ffffff", { map: proceduralTexture("wood", "#a58b66") }),
    fabric = mat("#536f60", { map: proceduralTexture("fabric", "#dad9ce") }),
    interiorLight = mat("#f2ddae", {
      emissive: "#e3bd73",
      emissiveIntensity: 0.2,
    });
  let currentInterior = null,
    interiorObjects = [];
  const interiorCache = new Map();
  function buildInterior(id) {
    inside.clear();
    insideBoxes.length = 0;
    currentInterior = id;
    if (interiorCache.has(id)) {
      const cached = interiorCache.get(id);
      inside.add(...cached.children);
      insideBoxes.push(...cached.boxes);
      interiorObjects = cached.objects;
      return interiorObjects;
    }
    interiorObjects = [];
    const b = (w, h, d, x, y, z, m = wood, solid = true) => {
      const mesh = box(inside, w, h, d, x, y, z, m);
      if (solid) blockers(x, z, w, d, insideBoxes);
      return mesh;
    };
    b(16, 0.15, 12, 0, -0.08, 0, floor, false);
    b(16, 3.2, 0.16, 0, 1.6, -6, wall);
    b(0.16, 3.2, 12, -8, 1.6, 0, wall);
    b(0.16, 3.2, 12, 8, 1.6, 0, wall);
    b(6.9, 3.2, 0.16, -4.55, 1.6, 6, wall);
    b(6.9, 3.2, 0.16, 4.55, 1.6, 6, wall);
    b(16, 0.1, 12, 0, 3.25, 0, white, false);
    window(inside, -4, 1.8, -5.85, 3, 1.9);
    window(inside, 4, 1.8, -5.85, 3, 1.9);
    sign(inside, "EXIT", 0, 2.65, 5.88, 1.2, "#fff3d4", "#285640", Math.PI);
    for (const x of [-4, 4]) {
      b(0.7, 0.06, 0.7, x, 3.15, 0, interiorLight, false);
      const l = new T.PointLight("#ffe2ac", 8, 16, 1.8);
      l.position.set(x, 2.8, 0);
      inside.add(l);
    }
    if (id === "home") {
      b(2.1, 0.48, 2.6, -5, 0.27, -3, fabric);
      b(2.15, 0.75, 0.16, -5, 0.75, -4.4, wood);
      b(1.9, 0.16, 1.85, -5, 0.58, -2.75, mat("#e5debf"), false);
      b(0.7, 0.15, 0.4, -5, 0.72, -3.8, white, false);
      b(3, 0.48, 1, -4, 0.35, 1, fabric);
      b(3, 0.65, 0.18, -4, 0.83, 1.4, fabric, false);
      b(1.7, 0.42, 0.8, -4, 0.22, 2.7, wood);
      b(0.2, 1.3, 2.1, -7.5, 0.9, 1, wood);
      b(0.05, 0.8, 1.6, -7.35, 1.13, 1, windows, false);
      b(4, 0.9, 0.8, 4, 0.45, -5, white);
      b(1, 0.1, 0.7, 3, 0.95, -5, metal, false);
      for (const x of [4.5, 5]) {
        const torus = new T.Mesh(
          new T.TorusGeometry(0.18, 0.025, 6, 12),
          metal,
        );
        torus.rotation.x = Math.PI / 2;
        torus.position.set(x, 0.94, -5);
        inside.add(torus);
      }
      b(0.9, 1.9, 0.9, 6.8, 0.95, -5, white);
      b(2, 0.08, 1.2, 4, 0.8, 0, wood);
      for (const x of [3.2, 4.8]) b(0.5, 0.5, 0.5, x, 0.25, 0.7, wood);
      b(2, 0.08, 0.75, 4, 0.85, 4.7, wood);
      sign(
        inside,
        "HOME, SWEET HOME",
        0,
        2.1,
        -5.88,
        3.5,
        "#344b3b",
        "#d7cbb4",
      );
      interiorObjects = [
        { id: "sleep", x: -5, z: -1, label: "Sleep · restore energy" },
        { id: "sit", x: -4, z: 2, label: "Sit & unwind" },
        { id: "rent", x: 4, z: 3.6, label: "Pay weekly rent · $120" },
        { id: "meal", x: 4, z: -3.7, label: "Cook a meal · $6" },
      ];
    } else if (id === "cafe") {
      b(8, 1, 0.85, 0, 0.5, -3, wood);
      b(1.3, 0.4, 0.65, -2, 1.2, -3, metal, false);
      b(0.8, 0.5, 0.55, 2, 1.2, -3, metal, false);
      for (const x of [-5, 4.5])
        for (const z of [0, 3]) {
          b(1.4, 0.08, 1.2, x, 0.82, z, wood);
          beam(inside, V(x, 0, z), V(x, 0.8, z), 0.065, metal);
          for (const xx of [-0.9, 0.9])
            b(0.5, 0.48, 0.5, x + xx, 0.24, z, fabric);
        }
      sign(inside, "JUNIPER  /  COFFEE & GOOD COMPANY", 0, 2.4, -5.86, 8);
      const clerk = createCharacter(
        {
          skin: "#69432e",
          outfit: "#b99e78",
          hair: "long",
        },
        { detail: "npc" },
      );
      clerk.group.position.set(1, 0, -4.4);
      clerk.group.rotation.y = Math.PI;
      inside.add(clerk.group);
      interiorObjects = [
        { id: "food", x: -2, z: -1.5, label: "Buy lunch · $8" },
        { id: "work", x: 1, z: -1.5, label: "Ask Maya about café work" },
        { id: "pickup", x: 3, z: -1.5, label: "Collect the order" },
        { id: "deliver", x: 4.5, z: 1.3, label: "Serve the table" },
        { id: "wash", x: -3, z: -1.5, label: "Return dishes & clock out" },
      ];
    } else if (id === "bank") {
      b(10, 1.1, 1, 0, 0.55, -2, wood);
      for (const x of [-3, 0, 3]) {
        b(0.08, 1, 0.08, x, 1.5, -2, metal, false);
        b(1, 0.65, 0.05, x, 1.7, -2, windows, false);
      }
      sign(inside, "EASTBROOK CREDIT UNION", 0, 2.5, -5.86, 7);
      interiorObjects = [
        { id: "deposit", x: -3, z: 0, label: "Deposit $50" },
        { id: "withdraw", x: 3, z: 0, label: "Withdraw $50" },
      ];
    } else if (id === "shop") {
      for (const x of [-5, 5]) {
        beam(inside, V(x - 1.1, 0, -2), V(x - 1.1, 1.8, -2), 0.035, metal);
        beam(inside, V(x + 1.1, 0, -2), V(x + 1.1, 1.8, -2), 0.035, metal);
        beam(inside, V(x - 1.1, 1.8, -2), V(x + 1.1, 1.8, -2), 0.035, metal);
        for (let k = -0.8; k <= 0.8; k += 0.4)
          b(0.22, 0.65, 0.38, x + k, 1.28, -2, fabric, false);
      }
      b(2, 1, 0.7, 0, 0.5, -4, wood);
      sign(inside, "EVERYDAY  /  MAKE IT YOURS", 0, 2.5, -5.86, 6);
      interiorObjects = [
        { id: "clothes", x: -5, z: 0, label: "Buy burgundy outfit · $35" },
        { id: "clothes2", x: 5, z: 0, label: "Buy sand outfit · $35" },
      ];
    } else if (id === "dealer") {
      b(3, 0.08, 1.2, 0, 0.85, -3, wood);
      b(0.9, 0.65, 0.08, 0, 1.2, -3, metal, false);
      for (const x of [-1, 1]) b(0.6, 0.5, 0.6, x, 0.25, -1.5, fabric);
      sign(inside, "MAGNOLIA MOTORS", 0, 2.5, -5.86, 6);
      interiorObjects = [
        { id: "fuel", x: -3, z: 0, label: "Refuel your car · $20" },
        { id: "repair", x: 0, z: -1.5, label: "Repair your car · $60" },
        { id: "buycar", x: 3, z: 0, label: "Exchange for sage sedan · $1,200" },
      ];
    }
    interiorObjects.push({
      id: "exit",
      x: 0,
      z: 5.15,
      label: "Return to Eastbrook",
    });
    // Retain a single built copy of each room; repeated visits allocate no new meshes.
    batchLocalMeshes(inside);
    interiorCache.set(id, {
      children: [...inside.children],
      boxes: [...insideBoxes],
      objects: interiorObjects,
    });
    return interiorObjects;
  }
  function update(dt, time, playerPos) {
    const night = time < 6 * 60 || time > 19 * 60;
    glow.emissiveIntensity = night ? 1.8 : 0;
    signalLights.forEach(({ m, i }) => {
      const green = time % 2 < 1.25;
      m.emissiveIntensity = i === (green ? 2 : 0) ? 1.5 : 0;
    });
    for (const n of npcs) {
      n.phase += dt * n.speed * 0.12;
      const offset = Math.sin(n.phase) * 22;
      if (n.axis === "z") n.group.position.z = n.origin.z + offset;
      else n.group.position.x = n.origin.x + offset;
      n.group.rotation.y =
        n.axis === "z"
          ? Math.cos(n.phase) > 0
            ? Math.PI
            : 0
          : Math.cos(n.phase) > 0
            ? -Math.PI / 2
            : Math.PI / 2;
      n.group.visible =
        outside.visible && n.group.position.distanceTo(playerPos) < 52;
      n.talkFor = Math.max(0, (n.talkFor || 0) - dt);
      if (n.group.visible)
        n.animate(dt, n.talkFor > 0 ? 0 : n.speed, {
          talk: n.talkFor > 0 ? 1 : 0,
        });
      n.group.position.y = 0.12;
    }
    for (const t of traffic) {
      const nearCrossing =
        Math.abs(t.group.position.z) < 16 && Math.abs(t.group.position.z) > 10;
      const stop = time % 2 > 1.25 && nearCrossing;
      if (!stop) t.progress += dt * t.speed;
      const p = t.progress % 304;
      let x, z, yaw;
      if (p < 152) {
        x = -3.6;
        z = 76 - p;
        yaw = 0;
      } else {
        x = 3.6;
        z = -76 + (p - 152);
        yaw = Math.PI;
      }
      t.group.position.set(x, 0, z);
      t.group.rotation.y = yaw;
      t.animate(dt, {
        speed: stop ? 0 : t.speed,
        lights: night,
        braking: stop,
      });
      t.group.visible =
        outside.visible && t.group.position.distanceTo(playerPos) < 90;
    }
    for (const c of chunks)
      c.group.visible = c.group.position.distanceTo(playerPos) < c.distance;
  }
  return {
    outside,
    inside,
    outsideBoxes,
    insideBoxes,
    npcs,
    traffic,
    places: PLACES,
    buildInterior,
    get interiorObjects() {
      return interiorObjects;
    },
    get currentInterior() {
      return currentInterior;
    },
    update,
    enter(id) {
      outside.visible = false;
      inside.visible = true;
      return buildInterior(id);
    },
    exit() {
      inside.visible = false;
      outside.visible = true;
      currentInterior = null;
      interiorObjects = [];
    },
  };
}
