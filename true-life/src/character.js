import * as T from "three";
import {
  V,
  mat,
  ellipsoid,
  beam,
  rings,
  proceduralTexture,
  batchLocalMeshes,
} from "./geometry.js";
export function createCharacter(appearance = {}) {
  const a = {
    gender: "masculine",
    skin: "#b67c57",
    hair: "short",
    build: "regular",
    outfit: "#536f64",
    face: "soft",
    ...appearance,
  };
  const group = new T.Group();
  const skin = mat(a.skin, { roughness: 0.72 }),
    shirt = mat(a.outfit, { map: proceduralTexture("fabric", "#d5d5c8") }),
    denim = mat("#283b4d", { roughness: 0.94 }),
    hair = mat("#211d18"),
    shoe = mat("#d5d0be"),
    dark = mat("#211e1b"),
    white = mat("#eee6d9");
  const bones = [],
    joints = {};
  function bone(name, parent, x, y, z) {
    const b = new T.Bone();
    b.name = name;
    b.position.set(x, y, z);
    (parent || group).add(b);
    bones.push(b);
    joints[name] = b;
    return b;
  }
  const hip = bone("hips", null, 0, 0.96, 0),
    spine = bone("spine", hip, 0, 0.18, 0),
    chest = bone("chest", spine, 0, 0.22, 0),
    neck = bone("neck", chest, 0, 0.15, 0),
    head = bone("head", neck, 0, 0.12, 0);
  for (const side of [-1, 1]) {
    const s = side < 0 ? "left" : "right";
    const arm = bone(s + "Arm", chest, side * 0.225, 0, 0),
      forearm = bone(s + "Elbow", arm, 0, -0.28, 0),
      wrist = bone(s + "Wrist", forearm, 0, -0.255, 0);
    const leg = bone(s + "Leg", hip, side * 0.1, -0.035, 0),
      knee = bone(s + "Knee", leg, 0, -0.43, 0),
      ankle = bone(s + "Ankle", knee, 0, -0.42, 0);
    bone(s + "Toe", ankle, 0, -0.035, -0.11);
    wrist.userData.side = side;
  }
  group.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(bones);
  function flesh(rows, m, weightFn, n = 16) {
    const geo = rings(rows, n),
      si = [],
      sw = [];
    for (let r = 0; r < rows.length; r++) {
      const weights = weightFn(r, rows[r][0]);
      for (let i = 0; i <= n; i++) {
        si.push(weights[0], weights[1] ?? weights[0], 0, 0);
        sw.push(weights[2] ?? 1, 1 - (weights[2] ?? 1), 0, 0);
      }
    }
    geo.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
    geo.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    const mesh = new T.SkinnedMesh(geo, m);
    mesh.castShadow = true;
    group.add(mesh);
    mesh.bind(skeleton);
    return mesh;
  }
  const bi = (name) => bones.indexOf(joints[name]);
  flesh(
    [
      [0.94, 0.155, 0.1],
      [1.01, 0.146, 0.094],
      [1.07, 0.125, 0.075],
      [1.19, 0.152, 0.087],
      [1.31, 0.19, 0.105],
      [1.39, 0.218, 0.098],
      [1.43, 0.17, 0.08],
      [1.47, 0.06, 0.05],
    ],
    shirt,
    (i, y) =>
      y < 1.08
        ? [bi("hips")]
        : y < 1.28
          ? [bi("spine"), bi("chest"), 0.65]
          : [bi("chest")],
    24,
  );
  flesh(
    [
      [0.88, 0.135, 0.087],
      [0.94, 0.147, 0.093],
      [0.99, 0.139, 0.087],
    ],
    denim,
    () => [bi("hips")],
    20,
  );
  for (const side of [-1, 1]) {
    const s = side < 0 ? "left" : "right",
      x = side * 0.1;
    flesh(
      [
        [0.065, 0.046, 0.057, x],
        [0.18, 0.05, 0.059, x],
        [0.34, 0.065, 0.069, x],
        [0.49, 0.061, 0.069, x],
        [0.58, 0.073, 0.076, x],
        [0.77, 0.085, 0.087, x],
        [0.93, 0.088, 0.09, x],
      ],
      denim,
      (i, y) =>
        y < 0.43
          ? [bi(s + "Knee")]
          : y < 0.6
            ? [bi(s + "Knee"), bi(s + "Leg"), 0.5]
            : [bi(s + "Leg")],
      16,
    );
    ellipsoid(joints[s + "Arm"], 0, -0.035, 0, 0.076, 0.07, 0.068, shirt, 14);
    const ax = side * 0.225;
    flesh(
      [
        [0.8, 0.035, 0.032, ax],
        [0.91, 0.046, 0.039, ax],
        [1.04, 0.049, 0.046, ax],
        [1.1, 0.047, 0.047, ax],
        [1.19, 0.057, 0.052, ax],
        [1.33, 0.067, 0.06, ax],
        [1.39, 0.04, 0.042, ax],
      ],
      skin,
      (i, y) =>
        y < 1.06
          ? [bi(s + "Elbow")]
          : y < 1.15
            ? [bi(s + "Elbow"), bi(s + "Arm"), 0.45]
            : [bi(s + "Arm")],
      14,
    );
    flesh(
      [
        [1.21, 0.063, 0.061, ax],
        [1.34, 0.075, 0.068, ax],
        [1.4, 0.052, 0.054, ax],
      ],
      shirt,
      () => [bi(s + "Arm")],
      14,
    );
    const wrist = joints[s + "Wrist"];
    ellipsoid(wrist, 0, -0.055, -0.005, 0.039, 0.064, 0.022, skin);
    for (let f = 0; f < 4; f++) {
      const xx = (f - 1.5) * 0.015;
      beam(
        wrist,
        V(xx, -0.08, -0.005),
        V(xx, -0.135 + Math.abs(f - 1.5) * 0.012, -0.014),
        0.008,
        skin,
        6,
      );
    }
    beam(
      wrist,
      V(-side * 0.027, -0.025, -0.004),
      V(-side * 0.054, -0.072, -0.017),
      0.011,
      skin,
    );
    ellipsoid(
      joints[s + "Ankle"],
      0,
      -0.01,
      -0.065,
      0.056,
      0.055,
      0.128,
      shoe,
      14,
    );
    ellipsoid(
      joints[s + "Ankle"],
      0,
      -0.047,
      -0.065,
      0.06,
      0.014,
      0.132,
      dark,
      12,
    );
  }
  ellipsoid(neck, 0, 0, 0, 0.053, 0.084, 0.049, skin);
  const angular = a.face === "angular";
  ellipsoid(head, 0, 0.022, 0, angular ? 0.092 : 0.098, 0.129, 0.095, skin, 24);
  ellipsoid(head, 0, -0.045, -0.028, 0.073, 0.064, 0.077, skin, 16);
  // All facial features are original geometry, oriented toward local -Z.
  for (const side of [-1, 1]) {
    ellipsoid(head, side * 0.036, 0.039, -0.081, 0.024, 0.012, 0.012, white);
    ellipsoid(head, side * 0.036, 0.039, -0.092, 0.009, 0.009, 0.004, dark);
    ellipsoid(head, side * 0.037, 0.058, -0.082, 0.027, 0.005, 0.012, hair);
    ellipsoid(head, side * 0.095, 0.012, 0.002, 0.017, 0.031, 0.018, skin);
  }
  ellipsoid(head, 0, 0.018, -0.094, 0.015, 0.033, 0.022, skin);
  ellipsoid(head, 0, -0.038, -0.09, 0.031, 0.005, 0.008, mat("#74463b"));
  ellipsoid(head, 0, -0.069, -0.064, 0.043, 0.019, 0.023, skin);
  if (a.hair !== "none") {
    ellipsoid(
      head,
      0,
      0.095,
      0.011,
      0.101,
      a.hair === "buzz" ? 0.045 : 0.07,
      0.098,
      hair,
      18,
    );
    if (a.hair === "short")
      for (let i = 0; i < 24; i++) {
        const u = i * 2.39996,
          r = 0.078 * Math.sqrt(i / 24);
        ellipsoid(
          head,
          Math.cos(u) * r,
          0.123 + 0.03 * (1 - r / 0.08),
          Math.sin(u) * r,
          0.021,
          0.023,
          0.021,
          hair,
          8,
        );
      }
    if (a.hair === "long") {
      ellipsoid(head, 0, 0.005, 0.065, 0.105, 0.14, 0.054, hair, 16);
      for (const s of [-1, 1])
        ellipsoid(head, s * 0.087, -0.018, 0.027, 0.028, 0.12, 0.065, hair, 12);
    }
  }
  for (const joint of bones) batchLocalMeshes(joint);
  const width = a.build === "broad" ? 1.22 : a.build === "slim" ? 0.86 : 1;
  group.scale.set(width, a.gender === "feminine" ? 0.96 : 1, 1);
  let phase = 0,
    blend = 0;
  const baseHip = 0.96;
  function animate(
    dt,
    speed = 0,
    { run = false, crouch = false, air = false, sit = false, enter = 0 } = {},
  ) {
    phase += dt * (run ? 11 : 7.8) * Math.min(1.3, speed / 1.6);
    blend = T.MathUtils.damp(blend, Math.min(1, speed / 1.5), 10, dt);
    const stride = run ? 0.8 : 0.47,
      wave = Math.sin(phase);
    hip.position.y =
      baseHip +
      (sit ? -0.43 : crouch ? -0.25 : Math.cos(phase * 2) * 0.018 * blend);
    spine.rotation.x = sit ? 0.03 : crouch ? 0.35 : run ? 0.13 : 0.01;
    chest.rotation.y = wave * 0.05 * blend;
    head.rotation.y = -wave * 0.025 * blend;
    for (const side of [-1, 1]) {
      const s = side < 0 ? "left" : "right",
        w = wave * side;
      const leg = joints[s + "Leg"],
        knee = joints[s + "Knee"],
        arm = joints[s + "Arm"];
      leg.rotation.x = sit
        ? -1.35
        : air
          ? -0.3
          : stride * w * blend - (crouch ? 0.5 : 0);
      knee.rotation.x = sit
        ? 1.4
        : air
          ? 0.65
          : Math.max(0, -w) * 0.8 * blend + (crouch ? 0.8 : 0);
      arm.rotation.x = sit ? -0.65 : -stride * w * blend;
      arm.rotation.z = side * (0.065 + enter * 0.65);
      joints[s + "Elbow"].rotation.x = run
        ? -0.65
        : -0.12 - Math.max(0, w) * 0.25 * blend;
      joints[s + "Ankle"].rotation.x = -Math.max(0, w) * 0.12 * blend;
    }
  }
  return {
    group,
    skeleton,
    joints,
    animate,
    dispose() {
      const materials = new Set();
      group.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          materials.add(o.material);
        }
      });
      for (const material of materials) {
        material.map?.dispose();
        material.dispose();
      }
      skeleton.dispose();
    },
  };
}
