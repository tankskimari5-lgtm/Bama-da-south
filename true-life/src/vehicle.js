import * as T from "three";
import { V, mat, box, ellipsoid, beam, batchLocalMeshes } from "./geometry.js";
function panel(parent, points, m) {
  const g = new T.BufferGeometry(),
    v = [];
  for (let i = 1; i < points.length - 1; i++)
    v.push(...points[0], ...points[i], ...points[i + 1]);
  g.setAttribute("position", new T.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  const mesh = new T.Mesh(g, m);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function loft(parent, sections, m) {
  const vertices = [],
    indices = [];
  for (const [z, w, b, t] of sections)
    vertices.push(
      -w * 0.86,
      b,
      z,
      -w,
      b + 0.08,
      z,
      -w,
      t - 0.06,
      z,
      -w * 0.88,
      t,
      z,
      w * 0.88,
      t,
      z,
      w,
      t - 0.06,
      z,
      w,
      b + 0.08,
      z,
      w * 0.86,
      b,
      z,
    );
  for (let j = 0; j < sections.length - 1; j++)
    for (let i = 0; i < 8; i++) {
      const a = j * 8 + i,
        b = j * 8 + ((i + 1) % 8),
        c = a + 8,
        d = b + 8;
      indices.push(a, c, b, b, c, d);
    }
  indices.push(0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 7);
  let l = (sections.length - 1) * 8;
  for (let i = 1; i < 7; i++) indices.push(l, l + i + 1, l + i);
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new T.Mesh(geo, m);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
export function createVehicle({
  color = "#672e36",
  detailed = true,
  kind = "sedan",
} = {}) {
  const group = new T.Group(),
    body = new T.Group();
  group.add(body);
  const paint = mat(color, { metalness: 0.58, roughness: 0.24 }),
    chrome = mat("#c4c9c2", { metalness: 0.88, roughness: 0.2 }),
    rubber = mat("#191d1c", { roughness: 0.95 }),
    glass = mat("#789391", {
      metalness: 0.3,
      roughness: 0.15,
      transparent: true,
      opacity: 0.38,
      side: T.DoubleSide,
      depthWrite: false,
    }),
    trim = mat("#232b29"),
    interior = mat("#655247"),
    lamp = mat("#f1e2b3", { emissive: "#ffe9b0", emissiveIntensity: 0.1 }),
    red = mat("#902d27", { emissive: "#d92c15", emissiveIntensity: 0.1 }),
    amber = mat("#dd9c35", { emissive: "#ffaa11", emissiveIntensity: 0 });
  const cabinHeight = kind === "suv" ? 1.93 : 1.5;
  const dynamic = new T.Group();
  body.add(dynamic);
  // A continuous sculpted body, narrowed at each bumper, with independent panels.
  loft(
    body,
    [
      [-2.31, 0.73, 0.43, 0.68],
      [-2.18, 0.87, 0.39, 0.79],
      [-1.75, 0.9, 0.41, 0.91],
      [-0.8, 0.91, 0.42, 0.92],
      [1.15, 0.91, 0.42, 0.94],
      [1.95, 0.87, 0.42, 0.85],
      [2.27, 0.76, 0.45, 0.73],
    ],
    paint,
  );
  // True curved wheel openings on the outer quarter panels.
  for (const side of [-1, 1]) {
    const shape = new T.Shape();
    shape.moveTo(-2.22, 0.49);
    for (const z of [-1.42, 1.39]) {
      shape.lineTo(z - 0.4, 0.49);
      shape.absarc(z, 0.37, 0.42, Math.PI - 0.29, 0.29, true);
    }
    shape.lineTo(2.22, 0.49);
    shape.lineTo(2.22, 0.81);
    shape.lineTo(1.9, 0.89);
    shape.lineTo(-1.8, 0.91);
    shape.lineTo(-2.22, 0.77);
    shape.closePath();
    const mesh = new T.Mesh(
      new T.ExtrudeGeometry(shape, {
        depth: 0.035,
        bevelEnabled: false,
        curveSegments: 12,
      }),
      paint,
    );
    mesh.rotation.y = Math.PI / 2;
    mesh.position.x = side * 0.91;
    body.add(mesh);
  }
  box(body, 1.67, 0.105, 0.12, 0, 0.51, -2.29, chrome);
  box(body, 1.67, 0.105, 0.13, 0, 0.52, 2.28, chrome);
  box(body, 0.73, 0.17, 0.025, 0, 0.7, -2.335, trim);
  for (let i = -4; i <= 4; i++)
    box(body, 0.015, 0.14, 0.028, i * 0.075, 0.7, -2.352, chrome);
  for (const side of [-1, 1]) {
    box(body, 0.43, 0.17, 0.04, side * 0.61, 0.72, -2.3, lamp);
    box(body, 0.32, 0.125, 0.035, side * 0.62, 0.69, 2.3, red);
    box(body, 0.1, 0.08, 0.04, side * 0.83, 0.62, -2.28, amber);
    box(body, 0.1, 0.08, 0.04, side * 0.83, 0.63, 2.28, amber);
    box(body, 0.018, 0.035, 4.12, side * 0.925, 0.62, 0, chrome);
    box(body, 0.025, 0.025, 2.12, side * 0.91, 0.94, 0.23, chrome);
    box(body, 0.12, 0.07, 0.18, side * 1.01, 1.06, -0.72, paint);
    beam(
      body,
      V(side * 0.85, 1.02, -0.7),
      V(side * 1.01, 1.04, -0.7),
      0.025,
      chrome,
    );
  }
  const hoodPivot = new T.Group();
  hoodPivot.position.set(0, 0.89, -0.75);
  body.add(hoodPivot);
  loft(
    hoodPivot,
    [
      [-1.42, 0.83, -0.065, -0.035],
      [-1.3, 0.85, -0.02, 0.015],
      [0, 0.86, 0, 0.035],
    ],
    paint,
  );
  const trunkPivot = new T.Group();
  trunkPivot.position.set(0, 0.91, 1.1);
  body.add(trunkPivot);
  loft(
    trunkPivot,
    [
      [0, 0.85, 0, 0.035],
      [0.88, 0.81, -0.04, -0.02],
      [1.12, 0.73, -0.1, -0.07],
    ],
    paint,
  );
  // Roof, pillars and separate glass planes rather than an opaque cabin block.
  loft(
    body,
    [
      [-0.38, 0.67, cabinHeight - 0.055, cabinHeight],
      [-0.22, 0.7, cabinHeight - 0.04, cabinHeight + 0.01],
      [0.72, 0.7, cabinHeight - 0.04, cabinHeight + 0.01],
      [0.94, 0.64, cabinHeight - 0.065, cabinHeight - 0.03],
    ],
    paint,
  );
  panel(
    body,
    [
      [-0.82, 0.97, -0.86],
      [0.82, 0.97, -0.86],
      [0.65, cabinHeight - 0.045, -0.37],
      [-0.65, cabinHeight - 0.045, -0.37],
    ],
    glass,
  );
  panel(
    body,
    [
      [-0.8, 0.96, 1.29],
      [-0.64, cabinHeight - 0.05, 0.94],
      [0.64, cabinHeight - 0.05, 0.94],
      [0.8, 0.96, 1.29],
    ],
    glass,
  );
  for (const side of [-1, 1]) {
    for (const [z1, z2] of [
      [-0.86, -0.37],
      [1.29, 0.94],
    ])
      beam(
        body,
        V(side * 0.84, 0.96, z1),
        V(side * 0.67, cabinHeight - 0.03, z2),
        0.035,
        chrome,
      );
    beam(
      body,
      V(side * 0.71, 0.98, 0.3),
      V(side * 0.7, cabinHeight, 0.3),
      0.034,
      paint,
    );
    panel(
      body,
      [
        [side * 0.84, 0.98, 0.37],
        [side * 0.8, 0.98, 1.22],
        [side * 0.65, cabinHeight - 0.07, 0.9],
        [side * 0.69, cabinHeight - 0.07, 0.37],
      ],
      glass,
    );
  }
  const doors = [];
  for (const side of [-1, 1]) {
    const pivot = new T.Group();
    pivot.position.set(side * 0.89, 0.93, -0.79);
    body.add(pivot);
    const d = new T.Group();
    pivot.add(d);
    loft(
      d,
      [
        [0, 0.018, -0.4, 0],
        [1.04, 0.018, -0.4, 0],
      ],
      paint,
    );
    d.position.x = 0;
    d.position.z = 0.52;
    panel(
      pivot,
      [
        [0, 0.035, 0],
        [0, 0.035, 1.07],
        [-side * 0.2, cabinHeight - 0.99, 1.07],
        [-side * 0.2, cabinHeight - 0.99, 0.42],
      ],
      glass,
    );
    beam(
      pivot,
      V(0, 0.03, 0),
      V(-side * 0.2, cabinHeight - 0.96, 0.42),
      0.025,
      chrome,
    );
    beam(
      pivot,
      V(-side * 0.2, cabinHeight - 0.96, 0.42),
      V(-side * 0.2, cabinHeight - 0.96, 1.07),
      0.022,
      chrome,
    );
    box(pivot, 0.025, 0.035, 0.16, side * 0.035, -0.08, 0.85, chrome);
    doors.push(pivot);
  }
  const wheels = [];
  for (const side of [-1, 1])
    for (const z of [-1.42, 1.39]) {
      const steer = new T.Group();
      steer.position.set(side * 0.91, 0.365, z);
      body.add(steer);
      const spin = new T.Group();
      steer.add(spin);
      const tire = new T.Mesh(
        new T.TorusGeometry(0.265, 0.095, 10, detailed ? 28 : 16),
        rubber,
      );
      tire.rotation.y = Math.PI / 2;
      spin.add(tire);
      const rim = new T.Mesh(
        new T.CylinderGeometry(0.203, 0.203, 0.19, detailed ? 20 : 12),
        chrome,
      );
      rim.rotation.z = Math.PI / 2;
      spin.add(rim);
      const disc = new T.Mesh(
        new T.CylinderGeometry(0.16, 0.16, 0.2, 16),
        trim,
      );
      disc.rotation.z = Math.PI / 2;
      spin.add(disc);
      if (detailed) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          beam(
            spin,
            V(side * 0.108, Math.cos(a) * 0.04, Math.sin(a) * 0.04),
            V(side * 0.108, Math.cos(a) * 0.18, Math.sin(a) * 0.18),
            0.024,
            chrome,
            6,
          );
        }
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const tread = box(
            spin,
            0.16,
            0.012,
            0.027,
            0,
            Math.cos(a) * 0.354,
            Math.sin(a) * 0.354,
            trim,
          );
          tread.rotation.x = a;
        }
        beam(
          body,
          V(side * 0.55, 0.32, z),
          V(side * 0.91, 0.365, z),
          0.035,
          trim,
        );
      }
      batchLocalMeshes(spin);
      wheels.push({ steer, spin, front: z < 0 });
    }
  // Interior remains visible through glass and the opening doors.
  for (const x of [-0.42, 0.42]) {
    ellipsoid(body, x, 0.68, 0.25, 0.27, 0.1, 0.31, interior);
    const seat = ellipsoid(body, x, 0.97, 0.51, 0.26, 0.37, 0.1, interior);
    seat.rotation.x = -0.12;
    ellipsoid(body, x, 1.22, 0.54, 0.15, 0.13, 0.09, interior);
  }
  ellipsoid(body, 0, 0.72, 1.02, 0.71, 0.12, 0.24, interior);
  box(body, 1.43, 0.17, 0.26, 0, 0.99, -0.65, trim);
  const steering = new T.Mesh(new T.TorusGeometry(0.15, 0.019, 7, 20), rubber);
  steering.rotation.x = -0.45;
  steering.position.set(-0.41, 1.04, -0.4);
  body.add(steering);
  box(body, 0.25, 0.08, 0.02, -0.41, 1.04, -0.49, trim);
  box(body, 0.12, 0.08, 0.1, 0, 0.73, -0.1, chrome);
  if (detailed) {
    box(body, 0.74, 0.12, 0.62, 0, 0.71, -1.3, trim);
    for (let i = 0; i < 6; i++)
      box(body, 0.08, 0.12, 0.35, -0.25 + i * 0.1, 0.82, -1.3, chrome);
    for (const side of [-1, 1])
      beam(
        body,
        V(side * 0.27, 0.77, -1.1),
        V(side * 0.45, 0.67, -1.55),
        0.045,
        chrome,
      );
    box(body, 0.35, 0.02, 0.17, 0, 0.56, 1.8, trim);
  }
  const headlights = [];
  if (detailed)
    for (const side of [-1, 1]) {
      const l = new T.SpotLight("#ffe6b2", 0, 45, 0.5, 0.65, 1.4);
      l.position.set(side * 0.62, 0.78, -2.18);
      l.target.position.set(side * 0.62, 0.1, -24);
      group.add(l, l.target);
      headlights.push(l);
    }
  for (const d of doors) {
    for (const child of d.children) if (child.isGroup) batchLocalMeshes(child);
    batchLocalMeshes(d);
  }
  batchLocalMeshes(hoodPivot);
  batchLocalMeshes(trunkPivot);
  batchLocalMeshes(body);
  let doorOpen = 0,
    hoodOpen = 0,
    trunkOpen = 0,
    roll = 0;
  return {
    group,
    body,
    doors,
    hoodPivot,
    trunkPivot,
    wheels,
    kind,
    animate(
      dt,
      {
        speed = 0,
        steer = 0,
        braking = false,
        lights = false,
        signal = false,
        door = 0,
        hood = 0,
        trunk = 0,
      } = {},
    ) {
      doorOpen = T.MathUtils.damp(doorOpen, door, 7, dt);
      hoodOpen = T.MathUtils.damp(hoodOpen, hood, 6, dt);
      trunkOpen = T.MathUtils.damp(trunkOpen, trunk, 6, dt);
      doors.forEach((d, i) => (d.rotation.y = (i ? 1 : -1) * doorOpen * 1.02));
      hoodPivot.rotation.x = -hoodOpen * 0.9;
      trunkPivot.rotation.x = trunkOpen * 0.95;
      for (const w of wheels) {
        w.spin.rotation.x -= (speed * dt) / 0.36;
        w.steer.rotation.y = w.front ? steer : 0;
        w.steer.position.y =
          0.365 +
          Math.sin(performance.now() * 0.008) *
            0.005 *
            Math.min(1, Math.abs(speed));
      }
      roll = T.MathUtils.damp(roll, -steer * speed * 0.006, 5, dt);
      body.rotation.z = roll;
      body.rotation.x = T.MathUtils.damp(
        body.rotation.x,
        braking && speed > 1 ? -0.018 : 0,
        5,
        dt,
      );
      lamp.emissiveIntensity = lights ? 2 : 0.1;
      red.emissiveIntensity = braking ? 2 : lights ? 0.55 : 0.1;
      amber.emissiveIntensity =
        signal && Math.sin(performance.now() * 0.008) > 0 ? 2 : 0;
      headlights.forEach((l) => (l.intensity = lights ? 9 : 0));
    },
  };
}
