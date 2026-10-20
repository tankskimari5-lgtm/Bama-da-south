import {
  V,
  gauss,
  smooth,
  loft,
  patch,
  ovoid,
  strand,
  merge,
  morph,
  profileAt,
} from "./mesh.js";
import { proportions } from "./config.js";
export function headPoint(a, u, v) {
  const jaw = a.jawWidth * (a.face === "angular" ? 1.045 : 1);
  const p = proportions(a);
  const profile = [
    [1.552, 0.017 * jaw, 0.028, 0, -0.018],
    [1.563, 0.034 * jaw, 0.044, 0, -0.01],
    [1.584, 0.055 * jaw, 0.058, 0, 0],
    [1.61, 0.068 * jaw, 0.065, 0, 0.003],
    [1.641, 0.073, 0.077, 0, 0.003],
    [1.67, 0.079, 0.084, 0, 0.004],
    [1.695, 0.079, 0.087, 0, 0.006],
    [1.72, 0.077, 0.088, 0, 0.009],
    [1.746, 0.078, 0.087, 0, 0.013],
    [1.777, 0.069, 0.078, 0, 0.015],
    [1.801, 0.047, 0.057, 0, 0.015],
    [1.817, 0.015, 0.02, 0, 0.013],
    [1.819, 0.0002, 0.001, 0, 0.012],
  ];
  // Cubic anatomical sections, then facial landmarks sculpt the same continuous surface.
  const g = profileAt(profile, v),
    angle = u * Math.PI * 2,
    x = Math.sin(angle) * g[1],
    y = g[0],
    front = Math.max(0, Math.cos(angle));
  let z = g[4] - Math.cos(angle) * g[2];
  const f = front ** 10;
  const nose =
    gauss(x, 0, 0.012 * a.noseWidth) *
      gauss(y, 1.674, 0.032) *
      0.011 *
      a.noseProjection +
    gauss(x, 0, 0.015 * a.noseWidth) *
      gauss(y, 1.657, 0.012) *
      0.018 *
      a.noseProjection +
    0.006 *
      (gauss(x, 0.012 * a.noseWidth, 0.005) +
        gauss(x, -0.012 * a.noseWidth, 0.005)) *
      gauss(y, 1.652, 0.006);
  const cheek =
    0.0045 *
    (gauss(x, 0.048, 0.022) + gauss(x, -0.048, 0.022)) *
    gauss(y, 1.664, 0.025);
  const sockets =
    0.01 *
    (gauss(x, 0.032, 0.019) + gauss(x, -0.032, 0.019)) *
    gauss(y, 1.695, 0.01);
  const brow =
    0.0045 *
    (gauss(x, 0.031, 0.026) + gauss(x, -0.031, 0.026)) *
    gauss(y, 1.712, 0.007);
  const muzzle = 0.003 * gauss(x, 0, 0.032) * gauss(y, 1.623, 0.018),
    chin = 0.005 * gauss(x, 0, 0.031) * gauss(y, 1.574, 0.012);
  const fold =
    0.0016 *
    gauss(Math.abs(x), 0.014 + 0.018 * (1 - smooth(1.618, 1.65, y)), 0.0025) *
    gauss(y, 1.634, 0.018);
  z += f * (sockets + fold - nose - cheek - brow - muzzle - chin);
  return V(x, y, z);
}
export function createHumanHead(a, detail = "high") {
  const columns = detail === "high" ? 96 : detail === "medium" ? 64 : 36,
    rows = detail === "high" ? 108 : detail === "medium" ? 72 : 42;
  const g = patch((u, v) => headPoint(a, u, v), columns, rows, {
    cut: (u, v) => {
      const p = headPoint(a, u, v);
      if (Math.cos(u * Math.PI * 2) < 0.75) return false;
      return [-1, 1].some(
        (s) =>
          ((p.x - s * 0.032) / 0.0135) ** 2 +
            ((p.y - 1.695) / (0.0058 * a.eyeShape)) ** 2 <
          0.92,
      );
    },
  });
  return morph(g, ["smile", "frown", "talk"], (p, name) => {
    const front = Math.max(0, -p.z / 0.09) ** 4;
    if (name === "smile") {
      p.y +=
        0.0035 *
        gauss(Math.abs(p.x), 0.027, 0.016) *
        gauss(p.y, 1.627, 0.028) *
        front;
      p.z -=
        0.0018 * gauss(Math.abs(p.x), 0.045, 0.023) * gauss(p.y, 1.656, 0.018);
    }
    if (name === "frown")
      p.y -=
        0.0025 *
        gauss(Math.abs(p.x), 0.026, 0.02) *
        gauss(p.y, 1.625, 0.02) *
        front;
    return p;
  });
}
export function createTorsoGeometry(a, detail = "high", clothing = false) {
  const p = proportions(a),
    m = a.muscle,
    offset = clothing ? 0.0045 : 0;
  return loft(
    [
      [0.875, p.hip * 0.78, 0.075, 0, 0.02],
      [0.93, p.hip, 0.1, 0, 0.015],
      [0.995, p.waist * 1.06, 0.095, 0, 0.01],
      [1.07, p.waist, 0.083, 0, 0.004],
      [1.15, p.waist * 1.04, 0.089, 0, 0.007],
      [1.24, p.shoulder * 0.82, 0.101, 0, 0.014],
      [1.32, p.shoulder * 0.95, 0.109, 0, 0.015],
      [1.385, p.shoulder, 0.1, 0, 0.012],
      [1.425, p.shoulder * 0.88, 0.082, 0, 0.014],
      [1.46, p.shoulder * 0.6, 0.066, 0, 0.014],
      [1.493, 0.059, 0.047, 0, 0.017],
      [1.535, 0.045, 0.043, 0, 0.02],
      [1.588, 0.042, 0.042, 0, 0.019],
    ],
    {
      segments: detail === "high" ? 56 : 28,
      rows: detail === "high" ? 80 : 40,
      deform: (q, theta) => {
        const front = Math.max(0, Math.cos(theta)),
          back = Math.max(0, -Math.cos(theta));
        q.z -=
          front ** 5 *
          (0.008 *
            m *
            (gauss(q.x, 0.085, 0.055) + gauss(q.x, -0.085, 0.055)) *
            gauss(q.y, 1.325, 0.045) +
            0.004 *
              m *
              gauss(q.x, 0, 0.062) *
              (gauss(q.y, 1.2, 0.015) + gauss(q.y, 1.16, 0.018)));
        q.z += back ** 3 * 0.009 * m * gauss(q.y, 1.31, 0.09);
        if (clothing) {
          q.x += Math.sin(theta) * offset;
          q.z -= Math.cos(theta) * offset;
        }
        return q;
      },
    },
  );
}
export function createArmGeometry(a, side, detail = "high", clothing = false) {
  const p = proportions(a),
    r = p.arm,
    x = p.shoulder * side;
  const g = loft(
    [
      [0.805, r * 0.55, r * 0.51, x, 0.005],
      [0.85, r * 0.69, r * 0.58, x, -0.003],
      [0.93, r * 0.85, r * 0.69, x, -0.008],
      [1.02, r * 0.93, r * 0.82, x, -0.005],
      [1.095, r * 0.81, r * 0.79, x, 0.005],
      [1.125, r * 0.88, r * 0.88, x, 0.004],
      [1.2, r * 1.11, r * 1.02, x, 0],
      [1.29, r * 1.2, r * 1.12, x, 0.004],
      [1.36, r * 1.36, r * 1.23, x * 0.99, 0.011],
      [1.41, r * 0.94, r * 0.88, x * 0.94, 0.015],
      [1.434, r * 0.3, r * 0.4, x * 0.91, 0.015],
    ],
    {
      segments: detail === "high" ? 32 : 16,
      rows: detail === "high" ? 58 : 30,
      deform: (q, theta) => {
        q.z -=
          Math.max(0, Math.cos(theta)) ** 4 *
          0.006 *
          a.muscle *
          gauss(q.y, 1.24, 0.06);
        q.z +=
          Math.max(0, -Math.cos(theta)) ** 3 * 0.004 * gauss(q.y, 1.12, 0.018);
        return q;
      },
    },
  );
  return g;
}
export function createLegGeometry(a, side, detail = "high") {
  const p = proportions(a),
    x = side * 0.091,
    r = p.thigh;
  return loft(
    [
      [0.075, 0.034, 0.043, x, 0.012],
      [0.15, 0.038, 0.047, x, 0.014],
      [0.24, 0.05, 0.059, x, 0.025],
      [0.36, 0.06, 0.07, x, 0.027],
      [0.46, 0.052, 0.058, x, 0.008],
      [0.51, 0.05, 0.059, x, 0],
      [0.56, 0.061, 0.067, x, 0.006],
      [0.67, r * 0.91, 0.083, x, 0.015],
      [0.78, r, 0.092, x, 0.018],
      [0.88, r * 1.04, 0.096, x, 0.015],
      [0.97, r * 0.82, 0.077, x, 0.012],
    ],
    {
      segments: detail === "high" ? 36 : 18,
      rows: detail === "high" ? 64 : 32,
      deform: (q, theta) => {
        q.z -=
          Math.max(0, Math.cos(theta)) ** 5 * 0.005 * gauss(q.y, 0.51, 0.024);
        q.z +=
          Math.max(0, -Math.cos(theta)) ** 4 * 0.006 * gauss(q.y, 0.32, 0.08);
        return q;
      },
    },
  );
}
export function createHandGeometry(a, side, detail = "high") {
  const p = proportions(a),
    x = p.shoulder * side;
  const palm = loft(
    [
      [0.716, 0.032, 0.014, x, -0.006],
      [0.741, 0.037, 0.019, x, -0.004],
      [0.779, 0.033, 0.021, x, 0.001],
      [0.817, 0.025, 0.024, x, 0.003],
      [0.837, 0.025, 0.024, x, 0.003],
    ],
    {
      segments: detail === "high" ? 24 : 12,
      rows: 22,
      deform: (q, t) => {
        q.z -=
          Math.max(0, Math.cos(t)) ** 4 * 0.0015 * gauss(q.y, 0.757, 0.014);
        return q;
      },
    },
  );
  const fingers = [];
  for (let f = 0; f < 5; f++) {
    const thumb = f === 4,
      start =
        f < 4
          ? V(x + (f - 1.5) * 0.017, 0.733, -0.004)
          : V(x + side * 0.031, 0.782, -0.001);
    const length = thumb ? 0.052 : [0.061, 0.073, 0.069, 0.054][f];
    const end = start
      .clone()
      .add(V(thumb ? side * 0.034 : (f - 1.5) * 0.004, -length, -0.008));
    const rows = [
      [0, 0.001, 0.001, end.x, end.z],
      [0.08, 0.006, 0.0065, end.x, end.z],
      [0.38, 0.007, 0.007, start.x + (end.x - start.x) * 0.65, start.z - 0.005],
      [0.68, 0.008, 0.008, start.x + (end.x - start.x) * 0.25, start.z],
      [1, 0.0085, 0.009, start.x, start.z],
    ].map(([v, rx, rz, cx, cz]) => [end.y + v * length, rx, rz, cx, cz]);
    fingers.push({
      g: loft(rows, { segments: detail === "high" ? 12 : 8, rows: 20 }),
      finger: f,
      start,
      end,
      length,
    });
  }
  return { palm, fingers };
}
export function createFootGeometry(a, side, detail = "high", shoe = false) {
  const x = side * 0.091;
  return loft(
    [
      [0.006, 0.035, 0.073, x, -0.053],
      [0.017, 0.046, 0.114, x, -0.06],
      [0.041, 0.05, 0.119, x, -0.061],
      [0.067, 0.047, 0.109, x, -0.058],
      [0.089, 0.043, 0.081, x, -0.03],
      [0.112, 0.036, 0.051, x, 0.005],
      [0.16, 0.033, 0.043, x, 0.014],
    ],
    {
      segments: detail === "high" ? 32 : 16,
      rows: 32,
      deform: (q, theta) => {
        if (shoe) {
          q.x += Math.sin(theta) * 0.006;
          q.z -= Math.cos(theta) * 0.007;
          q.y += 0.004;
        } else if (q.z < -0.105 && q.y < 0.067) {
          // Connected toe contours retain one smooth forefoot surface.
          const spread = [-0.032, -0.014, 0.003, 0.019, 0.033];
          for (let toe = 0; toe < spread.length; toe++)
            q.z -=
              gauss(q.x - x, spread[toe], toe === 0 ? 0.009 : 0.006) *
              0.009 *
              gauss(q.y, 0.033, 0.019);
        }
        return q;
      },
    },
  );
}
