import "./showroom.css";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createDetailedHuman } from "./human/index.js";
import {
  DEFAULT_APPEARANCE,
  HAIRSTYLES,
  ANIMATIONS,
  RANGES,
  normalizeAppearance,
} from "./human/config.js";
import { SAVE_KEY, loadState } from "./state.js";
const $ = (id) => document.getElementById(id),
  APPEARANCE_KEY = "true-life-character-v2";
let appearance = normalizeAppearance(),
  human,
  renderer,
  scene,
  camera,
  controls,
  mode = "idle",
  expression = "neutral",
  rotation = false,
  anatomy = false,
  tab = "form",
  last = 0,
  elapsed = 0,
  pending = false;
try {
  const profile = JSON.parse(localStorage.getItem(APPEARANCE_KEY));
  appearance = normalizeAppearance(
    profile || loadState(localStorage)?.appearance || {},
  );
} catch {}
const tabs = {
  form: [
    ["gender", "Presentation", ["masculine", "feminine"]],
    ["height", "Height", RANGES.height],
    ["build", "Body build", ["slim", "regular", "broad"]],
    ["shoulderWidth", "Shoulder width", RANGES.shoulderWidth],
    ["waist", "Waist size", RANGES.waist],
    ["muscle", "Muscle definition", RANGES.muscle],
    ["skin", "Skin tone", "color"],
  ],
  face: [
    ["face", "Face shape", ["soft", "angular"]],
    ["jawWidth", "Jaw width", RANGES.jawWidth],
    ["noseWidth", "Nose width", RANGES.noseWidth],
    ["noseProjection", "Nose projection", RANGES.noseProjection],
    ["eyeShape", "Eye opening", RANGES.eyeShape],
  ],
  style: [
    ["hair", "Hairstyle", HAIRSTYLES],
    ["hairColor", "Hair color", "color"],
    ["facialHair", "Facial hair", ["none", "stubble", "beard", "mustache"]],
    ["outfit", "T-shirt", "color"],
    ["pantsColor", "Trousers", "color"],
    ["shoeColor", "Sneakers", "color"],
  ],
};
function message(s) {
  $("message").textContent = s;
}
function saveAppearance() {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  } catch {
    message("Storage is unavailable. Export your appearance instead.");
  }
}
function rebuild() {
  const old = human;
  human = createDetailedHuman(appearance, {
    detail: "showroom",
    mobile: matchMedia("(pointer:coarse)").matches,
  });
  scene.add(human.group);
  human.group.position.y = 0.007;
  human.setAnatomy(anatomy);
  old?.dispose();
  saveAppearance();
  pending = false;
}
function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => rebuild());
}
function fields() {
  const container = $("fields");
  container.replaceChildren();
  for (const [key, label, type] of tabs[tab]) {
    const wrapper = document.createElement("label");
    wrapper.className = "field";
    const row = document.createElement("span"),
      labelText = document.createElement("span"),
      output = document.createElement("output");
    labelText.textContent = label;
    row.append(labelText, output);
    let input;
    if (type === "color") {
      input = document.createElement("input");
      input.type = "color";
    } else if (typeof type[0] === "number") {
      input = document.createElement("input");
      input.type = "range";
      input.min = type[0];
      input.max = type[1];
      input.step = key === "height" ? 0.01 : 0.02;
      output.textContent =
        key === "height"
          ? appearance[key].toFixed(2) + " m"
          : Math.round(appearance[key] * 100) + "%";
    } else {
      input = document.createElement("select");
      for (const value of type) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value[0].toUpperCase() + value.slice(1);
        input.append(option);
      }
    }
    input.id = "studio-" + key;
    input.value = appearance[key];
    input.oninput = () => {
      appearance = normalizeAppearance({
        ...appearance,
        [key]: input.type === "range" ? Number(input.value) : input.value,
      });
      if (input.type === "range")
        output.textContent =
          key === "height"
            ? appearance[key].toFixed(2) + " m"
            : Math.round(appearance[key] * 100) + "%";
      schedule();
    };
    wrapper.append(row, input);
    container.append(wrapper);
  }
}
function view(name) {
  rotation = false;
  $("rotate").textContent = "Rotate · off";
  controls.autoRotate = false;
  const target =
    name === "face"
      ? new T.Vector3(0, (1.69 * appearance.height) / 1.8, -0.015)
      : new T.Vector3(0, (0.96 * appearance.height) / 1.8, 0);
  controls.target.copy(target);
  const poses = {
    front: [0, 1.08, -4.25],
    side: [4.25, 1.08, 0],
    back: [0, 1.08, 4.25],
    face: [0, (1.7 * appearance.height) / 1.8, -0.72],
  };
  camera.position.set(...poses[name]);
  controls.minDistance = name === "face" ? 0.28 : 0.9;
  controls.maxDistance = 6;
  controls.update();
  human.setDetail(name === "face" ? "high" : "medium");
  human.group.updateMatrixWorld(true);
  human.animate(0, 0, { mode, expression });
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("selected", b.dataset.view === name));
}
function init() {
  try {
    renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        matchMedia("(pointer:coarse)").matches ? 1.3 : 1.7,
      ),
    );
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    $("studio-canvas").append(renderer.domElement);
    scene = new T.Scene();
    scene.background = new T.Color("#e7e2d8");
    scene.fog = new T.Fog("#e7e2d8", 9, 20);
    camera = new T.PerspectiveCamera(34, 1, 0.02, 40);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.autoRotateSpeed = 0.65;
    controls.enablePan = true;
    controls.maxPolarAngle = Math.PI * 0.67;
    controls.target.set(0, 0.96, 0);
    const pmrem = new T.PMREMGenerator(renderer),
      room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.45;
    room.dispose();
    pmrem.dispose();
    scene.add(new T.HemisphereLight("#eaf1ff", "#b5a58b", 0.75));
    const key = new T.DirectionalLight("#fff4e5", 3.0);
    key.position.set(-3.5, 5, -4);
    key.castShadow = true;
    const shadowSize = matchMedia("(pointer:coarse)").matches ? 1024 : 2048;
    key.shadow.mapSize.set(shadowSize, shadowSize);
    key.target.position.set(0, 1, 0);
    scene.add(key.target);
    Object.assign(key.shadow.camera, {
      left: -1.2,
      right: 1.2,
      top: 1.4,
      bottom: -1.4,
      near: 0.1,
      far: 15,
    });
    key.shadow.normalBias = 0.0008;
    key.shadow.bias = -0.0001;
    scene.add(key);
    const fill = new T.DirectionalLight("#d6e8f4", 0.55);
    fill.position.set(3, 2, -2);
    scene.add(fill);
    const rim = new T.DirectionalLight("#fff3d7", 2.3);
    rim.position.set(1, 3, 3);
    scene.add(rim);
    const floor = new T.Mesh(
      new T.PlaneGeometry(200, 200),
      new T.MeshStandardMaterial({ color: "#d8d1c4", roughness: 0.85 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.position.y = -0.008;
    scene.add(floor);
    rebuild();
    fields();
    view("front");
    for (const button of document.querySelectorAll("[data-tab]"))
      button.onclick = () => {
        tab = button.dataset.tab;
        document
          .querySelectorAll("[data-tab]")
          .forEach((b) => b.classList.toggle("selected", b === button));
        fields();
      };
    for (const button of document.querySelectorAll("[data-view]"))
      button.onclick = () => view(button.dataset.view);
    $("rotate").onclick = () => {
      rotation = !rotation;
      controls.autoRotate = rotation;
      $("rotate").textContent = rotation ? "Rotate · on" : "Rotate · off";
    };
    for (const name of ANIMATIONS) {
      const button = document.createElement("button");
      button.textContent = name[0].toUpperCase() + name.slice(1);
      button.dataset.animation = name;
      button.classList.toggle("selected", name === mode);
      button.onclick = () => {
        mode = name;
        document
          .querySelectorAll("[data-animation]")
          .forEach((b) => b.classList.toggle("selected", b === button));
      };
      $("animations").append(button);
    }
    $("expression").onchange = () => (expression = $("expression").value);
    $("playback").oninput = () =>
      ($("playback-value").textContent = $("playback").value + "×");
    $("anatomy").onclick = () => {
      anatomy = !anatomy;
      human.setAnatomy(anatomy);
      $("anatomy").textContent = anatomy ? "Show outfit" : "Show anatomy";
    };
    $("reset").onclick = () => {
      appearance = normalizeAppearance();
      rebuild();
      fields();
      view("front");
      message("Default appearance restored.");
    };
    $("apply").onclick = () => {
      saveAppearance();
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s.version !== 1 || !s.appearance) throw Error();
          s.appearance = { ...appearance };
          localStorage.setItem(SAVE_KEY, JSON.stringify(s));
        }
        location.href = "/";
      } catch {
        message(
          "Could not update the game save. Export this appearance for a backup.",
        );
      }
    };
    $("export-config").onclick = () => {
      const url = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              { kind: "true-life-appearance", version: 2, appearance },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "true-life-appearance.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message("Appearance exported.");
    };
    $("import-config").onchange = async (e) => {
      try {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 64000)
          throw Error("Choose an appearance file smaller than 64 KB.");
        const data = JSON.parse(await file.text());
        if (data.kind !== "true-life-appearance" || !data.appearance)
          throw Error("Choose a TRUE LIFE appearance export.");
        appearance = normalizeAppearance(data.appearance);
        rebuild();
        fields();
        message("Appearance imported.");
      } catch (e) {
        message(e.message);
      }
      e.target.value = "";
    };
    function resize() {
      const b = $("studio-canvas").getBoundingClientRect();
      renderer.setSize(b.width, b.height);
      camera.aspect = b.width / b.height;
      camera.updateProjectionMatrix();
      camera.setViewOffset(
        b.width,
        b.height,
        innerWidth > 700 ? (innerWidth > 1000 ? 140 : 110) : 0,
        0,
        b.width,
        b.height,
      );
    }
    resize();
    addEventListener("resize", resize);
    $("studio-loading").hidden = true;
    requestAnimationFrame(frame);
    if (import.meta.env.DEV)
      window.__CHARACTER_STUDIO__ = {
        get human() {
          return human;
        },
        get appearance() {
          return appearance;
        },
        get renderer() {
          return renderer;
        },
        get camera() {
          return camera;
        },
        get controls() {
          return controls;
        },
        view,
        rebuild,
        get mode() {
          return mode;
        },
        setAppearance(a) {
          appearance = normalizeAppearance({ ...appearance, ...a });
          rebuild();
          fields();
        },
      };
  } catch (e) {
    console.error(e);
    $("studio-loading").hidden = true;
    $("studio-error").hidden = false;
    $("studio-error").textContent =
      "The character studio needs a WebGL 2 browser. " + e.message;
  }
}
function frame(ms) {
  const dt = Math.min(0.06, (ms - last) / 1000 || 0.016);
  last = ms;
  elapsed += dt;
  const playback = Number($("playback").value),
    pose = mode === "jump" ? { mode, air: elapsed % 2 < 0.85 } : { mode };
  human.animate(dt * playback, 0, {
    ...pose,
    expression: expression === "talk" ? "neutral" : expression,
    talk: expression === "talk" ? 1 : 0,
  });
  if (mode === "turn") human.group.rotation.y = Math.sin(elapsed * 0.7) * 0.7;
  else human.group.rotation.y = 0;
  human.group.position.y =
    0.007 +
    (mode === "jump" && elapsed % 2 < 0.85
      ? Math.sin(((elapsed % 2) / 0.85) * Math.PI) * 0.37
      : 0);
  controls.update();
  renderer.render(scene, camera);
  if (Math.round(ms / 100) % 5 === 0) {
    const m = human.metrics();
    $("metrics").textContent =
      `${Math.round(m.triangles).toLocaleString()} TRIANGLES · ${m.bones} BONES · ${m.detail.toUpperCase()} DETAIL`;
  }
  requestAnimationFrame(frame);
}
init();
