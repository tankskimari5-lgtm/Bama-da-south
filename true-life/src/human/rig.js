import * as T from "three";
import { V, smooth, skinGeometry } from "./mesh.js";
import { proportions } from "./config.js";
export function createHumanRig(a, root) {
  const p = proportions(a),
    bones = [],
    joints = {},
    index = {},
    rest = {};
  function joint(name, parent, x, y, z) {
    const b = new T.Bone();
    b.name = name;
    b.position.set(x, y, z);
    (parent || root).add(b);
    index[name] = bones.length;
    bones.push(b);
    joints[name] = b;
    rest[name] = {
      position: b.position.clone(),
      quaternion: b.quaternion.clone(),
    };
    return b;
  }
  const hip = joint("hips", null, 0, 0.97, 0.01),
    spine = joint("spine", hip, 0, 0.17, 0),
    chest = joint("chest", spine, 0, 0.23, 0.003),
    neck = joint("neck", chest, 0, 0.135, 0.007),
    head = joint("head", neck, 0, 0.145, -0.008);
  joint("jaw", head, 0, -0.044, -0.035);
  for (const side of [-1, 1]) {
    const s = side < 0 ? "left" : "right";
    const shoulder = joint(s + "Shoulder", chest, side * 0.105, 0.024, 0),
      arm = joint(s + "Arm", shoulder, side * (p.shoulder - 0.105), -0.004, 0),
      elbow = joint(s + "Elbow", arm, 0, -0.282, -0.003),
      hand = joint(s + "Wrist", elbow, 0, -0.3, -0.005);
    for (let f = 0; f < 5; f++) {
      const thumb = f === 4,
        x = thumb ? side * 0.031 : (f - 1.5) * 0.017,
        y = thumb ? -0.025 : -0.074;
      const b = joint(s + "Finger" + f, hand, x, y, 0);
      const length = thumb ? 0.052 : [0.061, 0.073, 0.069, 0.054][f];
      const mid = joint(
        s + "Finger" + f + "Mid",
        b,
        thumb ? side * 0.017 : 0,
        -length * 0.45,
        -0.002,
      );
      joint(
        s + "Finger" + f + "Tip",
        mid,
        thumb ? side * 0.013 : 0,
        -length * 0.32,
        -0.002,
      );
    }
    const leg = joint(s + "Leg", hip, side * 0.091, -0.04, 0.005),
      knee = joint(s + "Knee", leg, 0, -0.42, -0.015),
      ankle = joint(s + "Ankle", knee, 0, -0.405, 0.014);
    joint(s + "Toe", ankle, 0, -0.057, -0.112);
  }
  root.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(bones);
  skeleton.calculateInverses();
  const rig = { bones, joints, index, rest, skeleton };
  return rig;
}
export function torsoWeights(p) {
  const chest = smooth(1.15, 1.37, p.y),
    neck = smooth(1.45, 1.53, p.y),
    head = smooth(1.55, 1.6, p.y),
    spine = smooth(1.0, 1.16, p.y);
  if (head > 0)
    return [
      ["neck", 1 - head],
      ["head", head],
    ];
  if (neck > 0)
    return [
      ["chest", 1 - neck],
      ["neck", neck],
    ];
  if (chest > 0)
    return [
      ["spine", 1 - chest],
      ["chest", chest],
    ];
  return [
    ["hips", 1 - spine],
    ["spine", spine],
  ];
}
export function armWeights(side, p) {
  const s = side < 0 ? "left" : "right",
    elbow = smooth(1.035, 1.16, p.y),
    wrist = smooth(0.796, 0.856, p.y);
  if (wrist < 1)
    return [
      [s + "Wrist", 1 - wrist],
      [s + "Elbow", wrist],
    ];
  return [
    [s + "Elbow", 1 - elbow],
    [s + "Arm", elbow],
  ];
}
export function legWeights(side, p) {
  const s = side < 0 ? "left" : "right",
    leg = smooth(0.46, 0.57, p.y),
    ankle = smooth(0.1, 0.18, p.y),
    hip = smooth(0.88, 0.98, p.y);
  if (hip > 0)
    return [
      [s + "Leg", 1 - hip],
      ["hips", hip],
    ];
  if (ankle < 1)
    return [
      [s + "Ankle", 1 - ankle],
      [s + "Knee", ankle],
    ];
  return [
    [s + "Knee", 1 - leg],
    [s + "Leg", leg],
  ];
}
export function attachSkinned(root, g, material, rig, weights, name) {
  skinGeometry(g, rig, weights);
  const o = new T.SkinnedMesh(g, material);
  o.name = name;
  o.castShadow = true;
  o.receiveShadow = true;
  o.frustumCulled = false;
  root.add(o);
  o.bind(rig.skeleton);
  return o;
}
export function fingerWeights(side, f, start, end, p) {
  const s = side < 0 ? "left" : "right",
    t = Math.max(0, Math.min(1, (start.y - p.y) / (start.y - end.y))),
    mid = smooth(0.26, 0.55, t),
    tip = smooth(0.65, 0.88, t);
  if (tip > 0)
    return [
      [s + "Finger" + f + "Mid", 1 - tip],
      [s + "Finger" + f + "Tip", tip],
    ];
  return [
    [s + "Finger" + f, 1 - mid],
    [s + "Finger" + f + "Mid", mid],
  ];
}
export function footWeights(side, p) {
  const s = side < 0 ? "left" : "right",
    toe = smooth(0.11, 0.17, -p.z);
  return [
    [s + "Ankle", 1 - toe],
    [s + "Toe", toe],
  ];
}
export function shirtWeights(a, p) {
  const shoulder = proportions(a).shoulder,
    blend =
      smooth(shoulder * 0.7, shoulder * 1.12, Math.abs(p.x)) *
      (1 - smooth(1.38, 1.46, p.y));
  const weights = new Map();
  for (const [name, w] of torsoWeights(p))
    weights.set(name, (weights.get(name) || 0) + w * (1 - blend));
  for (const [name, w] of armWeights(p.x < 0 ? -1 : 1, p))
    weights.set(name, (weights.get(name) || 0) + w * blend);
  return [...weights].sort((a, b) => b[1] - a[1]).slice(0, 4);
}
