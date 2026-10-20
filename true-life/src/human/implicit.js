import * as T from "three";
import { profileAt } from "./mesh.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { proportions } from "./config.js";
const mix = (a, b, t) => a + (b - a) * t;
const smoothUnion = (a, b, k) => {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return mix(b, a, h) - k * h * (1 - h);
};
// A tetrahedral isosurface gives the shirt a single connected shoulder/armpit
// topology. The density field and extraction below are original code.
export function createImplicitShirt(a, detail) {
  const p = proportions(a),
    step = detail === "high" ? 0.01 : detail === "medium" ? 0.014 : 0.022;
  const torso = [
    [0.985, p.waist * 1.12, 0.106, 0, 0.01],
    [1.07, p.waist * 1.08, 0.099, 0, 0.008],
    [1.2, p.shoulder * 0.83, 0.11, 0, 0.012],
    [1.32, p.shoulder * 0.99, 0.119, 0, 0.016],
    [1.39, p.shoulder * 1.025, 0.106, 0, 0.013],
    [1.43, p.shoulder * 0.84, 0.083, 0, 0.014],
    [1.475, 0.06, 0.05, 0, 0.017],
  ];
  function field(x, y, z) {
    const t = Math.max(0, Math.min(1, (y - 0.985) / 0.49)),
      row = profileAt(torso, t),
      rz = row[2],
      rx = row[1];
    const chest =
      (Math.hypot(x / rx, (z - row[4]) / rz) - 1) * Math.min(rx, rz);
    let d = Math.max(chest, Math.max(0.985 - y, y - 1.475));
    for (const side of [-1, 1]) {
      const u = Math.max(0, Math.min(1, (y - 1.215) / 0.23)),
        radius =
          (0.069 + 0.009 * Math.sin(u * Math.PI)) *
          Math.sqrt(Math.max(0.008, 1 - Math.max(0, (y - 1.37) / 0.079) ** 2)) *
          (0.94 + a.muscle * 0.13);
      let arm =
        (Math.hypot(
          (x - side * p.shoulder) / radius,
          (z - 0.011) / (radius * 0.95),
        ) -
          1) *
        radius;
      arm = Math.max(arm, Math.max(1.215 - y, y - 1.449));
      d = smoothUnion(d, arm, 0.022);
    }
    const neck = (Math.hypot(x / 0.063, (z - 0.018) / 0.049) - 1) * 0.05;
    const neckHole = Math.max(neck, 1.453 - y);
    d = Math.max(d, -neckHole);
    return d;
  }
  const min = [-p.shoulder - 0.102, 0.97, -0.143],
    max = [p.shoulder + 0.102, 1.49, 0.16],
    size = max.map((v, k) => Math.ceil((v - min[k]) / step) + 1),
    [nx, ny, nz] = size,
    values = new Float32Array(nx * ny * nz),
    index = (x, y, z) => (z * ny + y) * nx + x;
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++)
        values[index(x, y, z)] = field(
          min[0] + x * step,
          min[1] + y * step,
          min[2] + z * step,
        );
  const offsets = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    tetra = [
      [0, 5, 1, 6],
      [0, 1, 2, 6],
      [0, 2, 3, 6],
      [0, 3, 7, 6],
      [0, 7, 4, 6],
      [0, 4, 5, 6],
    ],
    positions = [],
    normals = [],
    uv = [];
  function vertex(a, b, va, vb) {
    const t = va / (va - vb);
    return a.map((n, k) => mix(n, b[k], t));
  }
  function normal(p) {
    const e = 0.0003,
      n = new T.Vector3(
        field(p[0] + e, p[1], p[2]) - field(p[0] - e, p[1], p[2]),
        field(p[0], p[1] + e, p[2]) - field(p[0], p[1] - e, p[2]),
        field(p[0], p[1], p[2] + e) - field(p[0], p[1], p[2] - e),
      );
    return n.normalize();
  }
  function triangle(a, b, c) {
    const n = normal(a.map((v, i) => (v + b[i] + c[i]) / 3)),
      cross = new T.Vector3()
        .subVectors(new T.Vector3(...b), new T.Vector3(...a))
        .cross(
          new T.Vector3().subVectors(new T.Vector3(...c), new T.Vector3(...a)),
        );
    if (cross.dot(n) < 0) [b, c] = [c, b];
    for (const p of [a, b, c]) {
      const q = normal(p);
      positions.push(...p);
      normals.push(q.x, q.y, q.z);
      uv.push((p[0] + 0.4) / 0.8, (p[1] - 0.97) / 0.52);
    }
  }
  for (let z = 0; z < nz - 1; z++)
    for (let y = 0; y < ny - 1; y++)
      for (let x = 0; x < nx - 1; x++) {
        const vals = offsets.map(
          (o) => values[index(x + o[0], y + o[1], z + o[2])],
        );
        if (vals.every((v) => v >= 0) || vals.every((v) => v < 0)) continue;
        const points = offsets.map((o) => [
          min[0] + (x + o[0]) * step,
          min[1] + (y + o[1]) * step,
          min[2] + (z + o[2]) * step,
        ]);
        for (const ids of tetra) {
          const inside = ids.filter((i) => vals[i] < 0),
            outside = ids.filter((i) => vals[i] >= 0);
          if (inside.length === 0 || inside.length === 4) continue;
          const edge = (i, j) => vertex(points[i], points[j], vals[i], vals[j]);
          if (inside.length === 1) {
            const i = inside[0];
            triangle(
              edge(i, outside[0]),
              edge(i, outside[1]),
              edge(i, outside[2]),
            );
          } else if (inside.length === 3) {
            const i = outside[0];
            triangle(
              edge(i, inside[0]),
              edge(i, inside[1]),
              edge(i, inside[2]),
            );
          } else {
            const [i, j] = inside,
              [k, l] = outside,
              a = edge(i, k),
              b = edge(i, l),
              c = edge(j, k),
              d = edge(j, l);
            triangle(a, b, c);
            triangle(b, d, c);
          }
        }
      }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(Array.from({ length: positions.length / 3 }, (_, i) => i));
  const welded = mergeVertices(g, 0.00002);
  g.dispose();
  return welded;
}
