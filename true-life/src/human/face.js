import { headPoint } from "./anatomy.js";
import {
  V,
  gauss,
  patch,
  ovoid,
  strand,
  merge,
  morph,
  addMesh,
} from "./mesh.js";
export function createFacialFeatures(a, detail = "high") {
  const eye = [],
    skin = [],
    crease = [],
    brows = [],
    lips = [],
    cornea = [];
  const hi = detail === "high",
    res = hi ? 28 : 16;
  for (const side of [-1, 1]) {
    const x = side * 0.032,
      y = 1.695,
      z = -0.066;
    const eyeball = patch(
      (u, v) => {
        const dx = (u - 0.5) * 0.027,
          dy = Math.sin(u * Math.PI) * (v * 2 - 1) * 0.0053 * a.eyeShape;
        return V(
          x + dx,
          y + dy,
          z - Math.sqrt(Math.max(0, 0.0135 * 0.0135 - dx * dx - dy * dy)),
        );
      },
      hi ? 48 : 28,
      hi ? 22 : 14,
    );
    const iris = patch(
      (u, v) => {
        const angle = u * Math.PI * 2,
          r = 0.0055 * v;
        return V(
          x + Math.cos(angle) * r,
          y + Math.sin(angle) * r,
          z - 0.0125 - Math.sqrt(Math.max(0, 1 - (r / 0.0135) ** 2)) * 0.0016,
        );
      },
      40,
      8,
      {
        flip: true,
        cut: (u, v) => {
          const angle = u * Math.PI * 2,
            dx = Math.cos(angle) * 0.0055 * v,
            dy = Math.sin(angle) * 0.0055 * v;
          return (
            Math.abs(dy) >
            0.0053 * a.eyeShape * Math.sqrt(Math.max(0, 1 - (dx / 0.0135) ** 2))
          );
        },
      },
    );
    const pupil = patch(
      (u, v) => {
        const angle = u * Math.PI * 2,
          r = 0.00225 * v;
        return V(x + Math.cos(angle) * r, y + Math.sin(angle) * r, z - 0.01435);
      },
      24,
      4,
      { flip: true },
    );
    cornea.push(ovoid([x, y, z - 0.0118], [0.0062, 0.0062, 0.0029], 20, 12));
    const eyelids = [];
    for (const upper of [true, false]) {
      const lid = patch(
        (u, v) => {
          const theta = u * Math.PI,
            px = x + Math.cos(theta) * 0.0138;
          const open =
            Math.sin(theta) * 0.0053 * a.eyeShape * (upper ? 1 : -0.85);
          const py = y + open;
          const outerY =
            py + (upper ? 1 : -1) * (0.006 + 0.002 * Math.sin(theta)) * v;
          const dz = Math.sqrt(
            Math.max(0, 0.0135 * 0.0135 - (px - x) ** 2 - open * open),
          );
          const inner = z - dz - 0.0005;
          const faceU =
            Math.asin(Math.max(-0.99, Math.min(0.99, px / 0.079))) /
            (Math.PI * 2);
          const outer =
            headPoint(
              a,
              (faceU + 1) % 1,
              Math.max(0, Math.min(1, (outerY - 1.552) / 0.267)),
            ).z - 0.0004;
          const pz =
            inner * (1 - v) + outer * v - 0.0008 * Math.sin(v * Math.PI);
          return V(px, outerY, pz);
        },
        hi ? 36 : 20,
        5,
        { flip: upper },
      );
      morph(lid, ["blink"], (p) => {
        const edge =
          1 - Math.min(1, Math.max(0, (Math.abs(p.y - y) - 0.006) / 0.006));
        p.y += (y - p.y) * edge * 0.98;
        const closedZ =
          z - Math.sqrt(Math.max(0, 0.0135 * 0.0135 - (p.x - x) ** 2)) - 0.002;
        p.z = p.z * (1 - edge) + closedZ * edge;
        return p;
      });
      eyelids.push(lid);
    }
    // Fine upper-lid fold and tear line follow the almond-shaped aperture.
    const lidline = [];
    for (let i = 0; i <= 20; i++) {
      const t = (i / 20) * Math.PI;
      lidline.push(
        V(
          x + Math.cos(t) * 0.0138,
          y + Math.sin(t) * 0.0053 * a.eyeShape + 0.005,
          -0.0725,
        ),
      );
    }
    skin.push(strand(lidline, 0.00055, 4));
    for (let i = 0; i < (hi ? 38 : 15); i++) {
      const u = i / (hi ? 37 : 14),
        xx = x + (u - 0.5) * 0.039,
        yy = 1.715 + Math.sin(u * Math.PI) * 0.004 + side * (u - 0.5) * 0.003;
      const zz = -0.081 + Math.abs(u - 0.5) * 0.009;
      brows.push(
        strand(
          [
            [xx, yy, zz],
            [xx + side * 0.0015, yy + 0.003, zz - 0.001],
            [xx + side * 0.003, yy + 0.004, zz],
          ],
          0.00033,
          3,
        ),
      );
    }
    eye.push({ side, eyeball, iris, pupil, lids: eyelids });
    // Ear helix, antihelix, tragus and concha; the helix is a shaped open fold.
    const ear = patch(
      (u, v) => {
        const theta = u * Math.PI * 2,
          rx = 0.0115 * (1 + 0.2 * Math.sin(theta)),
          ry = 0.027;
        return V(
          side * (0.077 + Math.sin(theta) * rx * v),
          1.669 + Math.cos(theta) * ry * v,
          -0.004 - 0.008 * (1 - v * v),
        );
      },
      hi ? 36 : 20,
      8,
      { flip: side < 0 },
    );
    skin.push(ear);
    const helix = [];
    for (let i = 0; i <= 30; i++) {
      const t = (i / 30) * Math.PI * 1.8 + 0.15;
      helix.push(
        V(
          side * (0.079 + Math.sin(t) * 0.0115),
          1.669 + Math.cos(t) * 0.026,
          -0.01 - 0.003 * Math.sin(t),
        ),
      );
    }
    skin.push(strand(helix, 0.0022, 6));
    const anti = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * Math.PI * 1.6 + 0.2;
      anti.push(
        V(
          side * (0.081 + Math.sin(t) * 0.005),
          1.67 + Math.cos(t) * 0.017,
          -0.012,
        ),
      );
    }
    skin.push(strand(anti, 0.0013, 5));
    skin.push(
      ovoid([side * 0.077, 1.66, -0.013], [0.0035, 0.005, 0.003], 12, 8),
    );
    crease.push(
      ovoid([side * 0.08, 1.668, -0.01], [0.0035, 0.009, 0.0008], 12, 8),
    );
    const nostril = patch(
      (u, v) => {
        const theta = u * Math.PI * 2,
          r = v;
        return V(
          side * 0.0105 * a.noseWidth + Math.cos(theta) * 0.0038 * r,
          1.649 + Math.sin(theta) * 0.0018 * r,
          -0.0955 + Math.cos(theta) * 0.001,
        );
      },
      20,
      4,
      { flip: true },
    );
    crease.push(nostril);
  }
  // The lips have a cupid's bow, philtrum and a dark narrow mouth aperture.
  for (const upper of [true, false]) {
    const lip = patch(
      (u, v) => {
        const x = (u - 0.5) * 0.052,
          shape = Math.max(0, 1 - (x / 0.027) ** 2),
          bow =
            0.0018 * (gauss(x, 0.006, 0.004) + gauss(x, -0.006, 0.004)) -
            0.001 * gauss(x, 0, 0.003);
        const mid = 1.622 + Math.abs(x) * 0.05;
        const y =
          mid +
          (upper ? 1 : -1) *
            shape *
            (upper ? 0.0038 + bow : 0.0055) *
            Math.sin((v * Math.PI) / 2);
        const z = -0.0795 - shape * (0.0045 * Math.sin(v * Math.PI) + 0.0015);
        return V(x, y, z);
      },
      hi ? 40 : 24,
      8,
      { flip: !upper },
    );
    morph(lip, ["smile", "frown", "talk"], (p, n) => {
      const corner = (Math.abs(p.x) / 0.026) ** 2;
      if (n === "smile") {
        p.y += corner * 0.005;
        p.x *= 1.08;
      }
      if (n === "frown") p.y -= corner * 0.004;
      if (n === "talk" && !upper) {
        p.y -= 0.009 * (1 - corner);
        p.z += 0.001;
      }
      return p;
    });
    lips.push(lip);
  }
  const mouth = [];
  for (let i = 0; i <= 18; i++) {
    const x = (i / 18 - 0.5) * 0.05;
    mouth.push(V(x, 1.622 + Math.abs(x) * 0.05, -0.081));
  }
  crease.push(strand(mouth, 0.00065, 5));
  skin.push(
    strand(
      [
        [-0.003, 1.633, -0.08],
        [-0.003, 1.64, -0.085],
        [-0.004, 1.645, -0.093],
      ],
      0.0006,
      5,
    ),
    strand(
      [
        [0.003, 1.633, -0.08],
        [0.003, 1.64, -0.085],
        [0.004, 1.645, -0.093],
      ],
      0.0006,
      5,
    ),
  );
  const mouthInterior = patch(
    (u, v) => {
      const x = (u - 0.5) * 0.049;
      return V(x, 1.622 + (v - 0.5) * 0.002 * (1 - (x / 0.026) ** 2), -0.0795);
    },
    24,
    6,
  );
  morph(mouthInterior, ["talk", "smile", "frown"], (p, n) => {
    const edge = 1 - (p.x / 0.026) ** 2;
    if (n === "talk") p.y -= ((1.623 - p.y) / 0.002) * 0.009 * edge;
    if (n === "smile") p.y += (1 - edge) * 0.005;
    if (n === "frown") p.y -= (1 - edge) * 0.004;
    return p;
  });
  return {
    mouthInterior,
    eyes: eye,
    skin: merge(skin),
    crease: merge(crease),
    brows: merge(brows),
    lips,
    cornea: merge(cornea),
  };
}
