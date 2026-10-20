export const HAIRSTYLES = [
  "short",
  "buzz",
  "waves",
  "afro",
  "braids",
  "twists",
  "locs",
  "long",
  "none",
];
export const EXPRESSIONS = ["neutral", "smile", "frown", "talk"];
export const ANIMATIONS = [
  "idle",
  "walk",
  "run",
  "sprint",
  "turn",
  "jump",
  "crouch",
  "sit",
  "enter",
  "exit",
  "look",
  "talk",
];
export const DEFAULT_APPEARANCE = {
  gender: "masculine",
  skin: "#b67c57",
  hair: "short",
  build: "regular",
  outfit: "#536f64",
  face: "soft",
  height: 1.8,
  shoulderWidth: 1,
  waist: 1,
  muscle: 0.45,
  jawWidth: 1,
  noseWidth: 1,
  noseProjection: 1,
  eyeShape: 1,
  hairColor: "#211b17",
  facialHair: "none",
  pantsColor: "#29394b",
  shoeColor: "#d6d2c7",
};
export const RANGES = {
  height: [1.55, 2.05],
  shoulderWidth: [0.84, 1.2],
  waist: [0.8, 1.25],
  muscle: [0, 1],
  jawWidth: [0.8, 1.22],
  noseWidth: [0.8, 1.25],
  noseProjection: [0.75, 1.3],
  eyeShape: [0.8, 1.2],
};
export function normalizeAppearance(input = {}) {
  const a = { ...DEFAULT_APPEARANCE };
  for (const key of Object.keys(a)) {
    if (input[key] !== undefined) a[key] = input[key];
  }
  for (const [key, [lo, hi]] of Object.entries(RANGES))
    a[key] =
      typeof a[key] === "number" && Number.isFinite(a[key])
        ? Math.max(lo, Math.min(hi, a[key]))
        : DEFAULT_APPEARANCE[key];
  for (const key of ["skin", "outfit", "hairColor", "pantsColor", "shoeColor"])
    if (!/^#[0-9a-f]{6}$/i.test(a[key])) a[key] = DEFAULT_APPEARANCE[key];
  if (!HAIRSTYLES.includes(a.hair)) a.hair = "short";
  if (!["none", "stubble", "beard", "mustache"].includes(a.facialHair))
    a.facialHair = "none";
  if (!["masculine", "feminine"].includes(a.gender)) a.gender = "masculine";
  if (!["regular", "slim", "broad"].includes(a.build)) a.build = "regular";
  if (!["soft", "angular"].includes(a.face)) a.face = "soft";
  return a;
}
export function proportions(a) {
  const broad = a.build === "broad" ? 1.12 : a.build === "slim" ? 0.91 : 1;
  return {
    scale: a.height / 1.8,
    shoulder: 0.205 * a.shoulderWidth * broad,
    waist: 0.137 * a.waist * broad,
    hip: (a.gender === "feminine" ? 0.158 : 0.144) * broad,
    arm: 0.047 * (0.9 + a.muscle * 0.35) * broad,
    thigh: 0.08 * (0.93 + a.muscle * 0.18) * broad,
  };
}
