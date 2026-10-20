import { createImplicitShirt } from "./implicit.js";
import { V, loft, patch, strand, merge, gauss } from "./mesh.js";
import {
  createTorsoGeometry,
  createLegGeometry,
  createFootGeometry,
} from "./anatomy.js";
import { proportions } from "./config.js";
export function createClothingGeometry(a, detail = "high") {
  const p = proportions(a),
    shirt = createImplicitShirt(a, detail);
  const pants = [],
    seams = [],
    shoe = [],
    soles = [],
    laces = [];
  pants.push(
    loft(
      [
        [0.815, 0.018, 0.045, 0, 0.012],
        [0.85, p.hip * 0.92, 0.109, 0, 0.015],
        [0.92, p.hip * 1.1, 0.117, 0, 0.015],
        [0.975, p.hip * 1.08, 0.115, 0, 0.012],
        [1.01, p.waist * 1.12, 0.109, 0, 0.01],
      ],
      { segments: 40, rows: 12 },
    ),
  );
  for (const side of [-1, 1]) {
    const cx = side * 0.091;
    const g = loft(
      [
        [0.145, 0.045, 0.054, cx, 0.014],
        [0.24, 0.055, 0.066, cx, 0.025],
        [0.36, 0.064, 0.075, cx, 0.027],
        [0.46, 0.058, 0.065, cx, 0.008],
        [0.51, 0.056, 0.065, cx, 0],
        [0.58, 0.073, 0.078, cx, 0.006],
        [0.7, p.thigh * 1.05, 0.091, cx, 0.015],
        [0.86, p.thigh * 1.1, 0.104, cx, 0.018],
        [0.97, p.thigh * 0.9, 0.086, cx, 0.012],
      ],
      {
        segments: detail === "high" ? 36 : 18,
        rows: detail === "high" ? 60 : 32,
        deform: (q, t) => {
          q.z +=
            Math.cos(t) *
            (0.002 * Math.sin(q.y * 117 + q.x * 21) * gauss(q.y, 0.5, 0.055) +
              0.0015 * Math.sin(q.y * 103) * gauss(q.y, 0.17, 0.04));
          return q;
        },
      },
    );
    g.computeVertexNormals();
    pants.push(g);
    const outer = [];
    for (let i = 0; i <= 25; i++) {
      const t = i / 25,
        y = 0.12 + t * 0.83,
        rx = 0.043 + 0.04 * Math.sin(t * Math.PI * 0.8);
      outer.push(V(side * (0.091 + rx), y, 0.016));
    }
    seams.push(strand(outer, 0.0008, 4));
    // Back patch pockets and shaped pocket openings are actual garment surfaces.
    pants.push(
      patch(
        (u, v) =>
          V(
            side * 0.086 + (u - 0.5) * 0.069,
            0.82 + v * 0.105,
            0.022 +
              Math.sqrt(
                Math.max(
                  0,
                  1 - ((side * 0.086 + (u - 0.5) * 0.069) / (p.hip * 1.1)) ** 2,
                ),
              ) *
                0.118,
          ),
        10,
        12,
        { flip: true },
      ),
    );
    seams.push(
      strand(
        [
          [side * 0.045, 0.963, -0.087],
          [side * 0.076, 0.94, -0.094],
          [side * 0.12, 0.925, -0.086],
        ],
        0.001,
        4,
      ),
    );
    const sg = createFootGeometry(a, side, detail, true);
    shoe.push(sg);
    soles.push(
      loft(
        [
          [0.005, 0.043, 0.109, cx, -0.058],
          [0.011, 0.053, 0.127, cx, -0.061],
          [0.025, 0.053, 0.127, cx, -0.061],
          [0.034, 0.05, 0.122, cx, -0.059],
        ],
        { segments: detail === "high" ? 40 : 20, rows: 8 },
      ),
    );
    for (let i = 0; i < 5; i++) {
      const z = -0.103 + i * 0.016,
        y = 0.075 + Math.sin((i / 5) * Math.PI) * 0.009;
      laces.push(
        strand(
          [
            [cx - 0.024, y, z],
            [cx, y + 0.004, z + 0.007],
            [cx + 0.024, y, z + 0.012],
          ],
          0.0015,
          5,
        ),
        strand(
          [
            [cx + 0.024, y + 0.001, z],
            [cx, y + 0.005, z + 0.007],
            [cx - 0.024, y + 0.001, z + 0.012],
          ],
          0.0015,
          5,
        ),
      );
    }
    soles.push(
      patch(
        (u, v) =>
          V(
            cx + (u - 0.5) * 0.066,
            0.037 + v * 0.014,
            -0.185 + 0.003 * Math.cos((u - 0.5) * Math.PI),
          ),
        16,
        6,
      ),
    );
  }
  // Narrow collar and hem stitched in geometry.
  const collar = [];
  for (let i = 0; i <= 44; i++) {
    const t = (i / 44) * Math.PI * 2;
    collar.push(
      V(
        Math.sin(t) * 0.065,
        1.474 + Math.cos(t) * 0.001,
        0.016 - Math.cos(t) * 0.052,
      ),
    );
  }
  seams.push(strand(collar, 0.0026, 6));
  const hem = [];
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    hem.push(
      V(
        Math.sin(t) * (p.waist * 1.08 + 0.005),
        0.994,
        0.011 - Math.cos(t) * 0.1,
      ),
    );
  }
  seams.push(strand(hem, 0.001, 5));
  return {
    shirt,
    pants: merge(pants),
    seams: merge(seams),
    shoe: merge(shoe),
    soles: merge(soles),
    laces: merge(laces),
  };
}
