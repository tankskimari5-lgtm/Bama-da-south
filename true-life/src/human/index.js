import * as T from "three";
import { normalizeAppearance, proportions } from "./config.js";
import { V, merge, ovoid, morph, partitionGeometry } from "./mesh.js";
import {
  createHumanHead,
  createTorsoGeometry,
  createArmGeometry,
  createLegGeometry,
  createHandGeometry,
  createFootGeometry,
} from "./anatomy.js";
import { createHumanMaterials } from "./materials.js";
import { createFacialFeatures } from "./face.js";
import { createHairGeometry } from "./hair.js";
import { createClothingGeometry } from "./clothing.js";
import {
  createHumanRig,
  attachSkinned,
  torsoWeights,
  armWeights,
  legWeights,
  fingerWeights,
  footWeights,
  shirtWeights,
} from "./rig.js";
import { createAnimator } from "./animation.js";
function makeLevel(a, detail, options = {}) {
  const root = new T.Group(),
    rig = createHumanRig(a, root),
    materials = createHumanMaterials(
      a,
      detail === "high" && options.mobile ? "medium" : detail,
    ),
    weighted = [];
  const add = (g, m, weights, name) => {
    const mesh = attachSkinned(root, g, m, rig, weights, name);
    weighted.push(mesh);
    return mesh;
  };
  const skinParts = [];
  skinParts.push({
    g: createTorsoGeometry(a, detail),
    w: torsoWeights,
    covered: (p) => p.y < 1.475,
  });
  for (const side of [-1, 1]) {
    const s = side < 0 ? "left" : "right";
    skinParts.push(
      {
        g: createArmGeometry(a, side, detail),
        w: (p) => armWeights(side, p),
        covered: (p) => p.y > 1.215,
      },
      {
        g: createLegGeometry(a, side, detail),
        w: (p) => legWeights(side, p),
        covered: () => true,
      },
      {
        g: createFootGeometry(a, side, detail),
        w: (p) => footWeights(side, p),
        covered: () => true,
      },
    );
    const hand = createHandGeometry(a, side, detail);
    skinParts.push({ g: hand.palm, w: () => [[s + "Wrist", 1]] });
    for (const { g, finger, start, end } of hand.fingers) {
      skinParts.push({
        g,
        w: (p) => fingerWeights(side, finger, start, end, p),
      });
      const nail = ovoid(
        [end.x, end.y + 0.009, end.z + 0.006],
        [0.0048, 0.007, 0.0015],
        12,
        8,
      );
      add(
        nail,
        materials.nail,
        () => [[s + "Finger" + finger + "Tip", 1]],
        s + " nail " + finger,
      );
    }
  }
  // All body sections share one material and draw; smooth weights bridge the anatomical joints.
  for (const part of skinParts) {
    const [exposed, covered] = part.covered
      ? partitionGeometry(part.g, part.covered)
      : [part.g, null];
    if (exposed) add(exposed, materials.skin, part.w, "body surface");
    if (covered) add(covered, materials.skin, part.w, "covered anatomy");
  }
  const head = add(
    createHumanHead(a, detail),
    materials.skin,
    (p) => {
      const jaw = (1 - Math.max(0, Math.min(1, (p.y - 1.575) / 0.045))) * 0.55;
      return [
        ["head", 1 - jaw],
        ["jaw", jaw],
      ];
    },
    "sculpted head",
  );
  head.userData.anatomy = true;
  const features = createFacialFeatures(a, detail),
    facial = [];
  const faceAdd = (g, m, name) => {
    const o = add(g, m, () => [["head", 1]], name);
    facial.push(o);
    return o;
  };
  faceAdd(features.skin, materials.skin, "ear folds and philtrum");
  const crease = faceAdd(
    features.crease,
    materials.crease,
    "nostrils and ear concha",
  );
  morph(features.brows, ["smile", "frown"], (p, name) => {
    const inner = Math.max(0, 1 - Math.abs(p.x) / 0.06);
    p.y += (name === "frown" ? -0.004 : 0.0015) * inner;
    return p;
  });
  const brows = faceAdd(features.brows, materials.hair, "strand eyebrows");
  const mouth = faceAdd(
    features.mouthInterior,
    materials.crease,
    "mouth cavity",
  );
  const lips = features.lips.map((g) =>
    faceAdd(g, materials.lips, "lip vermilion"),
  );
  const lids = [],
    irises = [];
  for (const eye of features.eyes) {
    faceAdd(eye.eyeball, materials.sclera, "eyeball");
    for (const key of ["iris", "pupil"]) {
      morph(eye[key], ["gazeX", "gazeY"], (p, n) => {
        if (n === "gazeX") p.x += 0.002;
        else p.y += 0.0015;
        return p;
      });
      irises.push(faceAdd(eye[key], materials[key], key));
    }
    for (const g of eye.lids) lids.push(faceAdd(g, materials.skin, "eyelid"));
  }
  faceAdd(features.cornea, materials.cornea, "corneal film");
  const hair = createHairGeometry(a, detail);
  if (hair) faceAdd(hair, materials.hair, "procedural hair strands");
  const clothes = createClothingGeometry(a, detail),
    clothing = [];
  const garment = (g, m, resolver, name) => {
    const mesh = add(g, m, resolver, name);
    clothing.push(mesh);
    return mesh;
  };
  garment(
    clothes.shirt,
    materials.shirt,
    (p) => shirtWeights(a, p),
    "fitted T-shirt",
  );
  garment(
    clothes.pants,
    materials.pants,
    (p) => (p.y > 0.91 ? [["hips", 1]] : legWeights(p.x < 0 ? -1 : 1, p)),
    "denim trousers",
  );
  garment(
    clothes.seams,
    materials.stitch,
    (p) =>
      p.y > 1.0
        ? torsoWeights(p)
        : p.y > 0.92
          ? [["hips", 1]]
          : legWeights(p.x < 0 ? -1 : 1, p),
    "collar and sewn seams",
  );
  for (const key of ["shoe", "soles", "laces"])
    garment(
      clothes[key],
      materials[key === "soles" ? "sole" : key],
      (p) => footWeights(p.x < 0 ? -1 : 1, p),
      key,
    );
  function combine(list, name) {
    if (list.length < 2) return list[0];
    const geometry = merge(list.map((m) => m.geometry));
    const mesh = new T.SkinnedMesh(geometry, list[0].material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    mesh.bind(rig.skeleton);
    for (const old of list) {
      old.removeFromParent();
      weighted.splice(weighted.indexOf(old), 1);
    }
    weighted.push(mesh);
    return mesh;
  }
  combine(
    weighted.filter((m) => m.name === "body surface"),
    "anatomical body",
  );
  const coveredSkin = combine(
    weighted.filter((m) => m.name === "covered anatomy"),
    "covered anatomy",
  );
  if (coveredSkin) coveredSkin.visible = false;
  combine(
    weighted.filter((m) => m.material === materials.nail),
    "fingernails",
  );
  combine(
    weighted.filter((m) => m.name === "eyeball"),
    "eyeballs",
  );
  for (const name of ["iris", "pupil"]) {
    const meshes = irises.filter((m) => m.name === name);
    const merged = combine(meshes, name);
    meshes.forEach((o) => irises.splice(irises.indexOf(o), 1));
    irises.push(merged);
  }
  const lidMesh = combine(lids, "eyelids");
  lids.splice(0, lids.length, lidMesh);
  const lipMesh = combine(lips, "lips");
  lips.splice(0, lips.length, lipMesh);
  const face = {
    update({ blink, expression, gazeX, gazeY }) {
      for (const o of [head, ...lips, mouth, brows])
        for (const [name, value] of Object.entries(expression))
          if (o.morphTargetDictionary?.[name] !== undefined)
            o.morphTargetInfluences[o.morphTargetDictionary[name]] = value;
      for (const o of lids) o.morphTargetInfluences[0] = blink;
      for (const o of irises) {
        o.morphTargetInfluences[0] = gazeX;
        o.morphTargetInfluences[1] = gazeY;
      }
    },
  };
  const animator = createAnimator(rig, face, proportions(a).scale);
  return {
    root,
    rig,
    materials,
    clothing,
    coveredSkin,
    animator,
    weighted,
    detail,
    dispose() {
      root.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
      rig.skeleton.dispose();
      materials.dispose();
    },
  };
}
export function createDetailedHuman(input = {}, options = {}) {
  const a = normalizeAppearance(input),
    group = new T.Group(),
    levels = [],
    detail = options.detail || "game";
  group.name = "TRUE LIFE original human";
  const scale = proportions(a).scale;
  group.scale.setScalar(scale);
  const choices =
    detail === "showroom"
      ? ["high", "medium"]
      : detail === "npc"
        ? ["low"]
        : ["medium", "low"];
  const lod = new T.LOD();
  group.add(lod);
  choices.forEach((quality, i) => {
    const level = makeLevel(a, quality, options);
    levels.push(level);
    lod.addLevel(level.root, i === 0 ? 0 : detail === "showroom" ? 3.8 : 11);
  });
  let active = levels[0];
  function animate(dt, speed = 0, opts = {}) {
    for (const level of levels) {
      const visible = level.root.visible;
      if (visible) {
        level.animator.animate(dt, speed / scale, opts);
        active = level;
      }
    }
  }
  function setDetail(name) {
    for (const { root, detail } of levels) root.visible = detail === name;
    lod.autoUpdate = false;
    active = levels.find((l) => l.detail === name) || levels[0];
  }
  return {
    group,
    appearance: a,
    lod,
    levels,
    get skeleton() {
      return active.rig.skeleton;
    },
    get joints() {
      return active.rig.joints;
    },
    animate,
    setDetail,
    setAnatomy(show) {
      for (const l of levels) {
        l.clothing.forEach((m) => (m.visible = !show));
        if (l.coveredSkin) l.coveredSkin.visible = show;
      }
    },
    metrics() {
      let triangles = 0,
        vertices = 0,
        draws = 0;
      active.root.traverse((o) => {
        if (o.isMesh && o.visible) {
          draws++;
          vertices += o.geometry.attributes.position.count;
          triangles +=
            (o.geometry.index?.count || o.geometry.attributes.position.count) /
            3;
        }
      });
      return {
        detail: active.detail,
        triangles,
        vertices,
        bones: active.rig.bones.length,
        draws,
      };
    },
    dispose() {
      for (const level of levels) level.dispose();
      group.removeFromParent();
    },
  };
}
