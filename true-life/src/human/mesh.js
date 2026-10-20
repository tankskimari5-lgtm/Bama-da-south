import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
export const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const gauss = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
export function patch(fn, columns = 24, rows = 16, { cut, flip = false } = {}) {
  const positions = [],
    uv = [],
    indices = [];
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= columns; i++) {
      const p = fn(i / columns, j / rows);
      positions.push(p.x ?? p[0], p.y ?? p[1], p.z ?? p[2]);
      uv.push(i / columns, j / rows);
    }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i,
        b = a + columns + 1;
      if (cut?.((i + 0.5) / columns, (j + 0.5) / rows)) continue;
      if (flip) indices.push(a, a + 1, b, b, a + 1, b + 1);
      else indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Periodic surfaces duplicate the UV seam. Average its normals so that a
  // frontal head seam cannot split the face's lighting into two halves.
  const n = g.attributes.normal;
  for (let row = 0; row <= rows; row++) {
    const a = row * (columns + 1),
      b = a + columns;
    const pa = V().fromBufferAttribute(g.attributes.position, a),
      pb = V().fromBufferAttribute(g.attributes.position, b);
    if (pa.distanceToSquared(pb) < 1e-12) {
      const normal = V()
        .fromBufferAttribute(n, a)
        .add(V().fromBufferAttribute(n, b))
        .normalize();
      n.setXYZ(a, normal.x, normal.y, normal.z);
      n.setXYZ(b, normal.x, normal.y, normal.z);
    }
  }
  return g;
}
const cubic = (a, b, c, d, t) =>
  0.5 *
  (2 * b +
    (-a + c) * t +
    (2 * a - 5 * b + 4 * c - d) * t * t +
    (-a + 3 * b - 3 * c + d) * t * t * t);
export function profileAt(profile, t) {
  const y = profile[0][0] + t * (profile.at(-1)[0] - profile[0][0]);
  let k = 0;
  while (k < profile.length - 2 && y > profile[k + 1][0]) k++;
  const f = (y - profile[k][0]) / (profile[k + 1][0] - profile[k][0]);
  const row = [y];
  for (let n = 1; n < 5; n++)
    row.push(
      cubic(
        profile[Math.max(0, k - 1)][n] || 0,
        profile[k][n] || 0,
        profile[k + 1][n] || 0,
        profile[Math.min(profile.length - 1, k + 2)][n] || 0,
        f,
      ),
    );
  return row;
}
export function loft(profile, { segments = 24, rows = 40, deform, cut } = {}) {
  return patch(
    (u, v) => {
      const [y, rx, rz, cx, cz] = profileAt(profile, v),
        a = u * Math.PI * 2;
      const p = V(
        cx + Math.sin(a) * Math.max(0.00005, rx),
        y,
        cz - Math.cos(a) * Math.max(0.00005, rz),
      );
      return deform ? deform(p, a, v) : p;
    },
    segments,
    rows,
    { cut },
  );
}
export function ovoid(center, radii, columns = 24, rows = 16, deform) {
  return patch(
    (u, v) => {
      const a = u * Math.PI * 2,
        b = (v - 0.5) * Math.PI,
        c = Math.cos(b);
      const p = V(
        center[0] + radii[0] * Math.sin(a) * c,
        center[1] + radii[1] * Math.sin(b),
        center[2] - radii[2] * Math.cos(a) * c,
      );
      return deform ? deform(p, u, v) : p;
    },
    columns,
    rows,
  );
}
export function strand(points, radius = 0.001, segments = 5) {
  const curve = new T.CatmullRomCurve3(
    points.map((p) => (p.isVector3 ? p : V(...p))),
  );
  const steps = Math.max(4, Math.ceil(points.length * 1.4)),
    frames = curve.computeFrenetFrames(steps, false);
  return patch(
    (u, v) => {
      const i = Math.min(steps, Math.round(v * steps)),
        p = curve.getPointAt(v),
        theta = u * Math.PI * 2,
        r = radius * (0.45 + 0.55 * Math.sin(v * Math.PI));
      return p
        .addScaledVector(frames.normals[i], Math.cos(theta) * r)
        .addScaledVector(frames.binormals[i], Math.sin(theta) * r);
    },
    segments,
    steps,
    { flip: true },
  );
}
export function merge(gs) {
  if (gs.length === 1) return gs[0];
  const result = mergeGeometries(gs, false);
  gs.forEach((g) => g.dispose());
  return result;
}
export function skinGeometry(g, rig, resolver) {
  const index = [],
    weight = [],
    p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const pos = V().fromBufferAttribute(p, i),
      w = resolver(pos),
      total = w.reduce((a, b) => a + b[1], 0) || 1;
    for (let k = 0; k < 4; k++) {
      index.push(w[k] ? rig.index[w[k][0]] : 0);
      weight.push(w[k] ? w[k][1] / total : 0);
    }
  }
  g.setAttribute("skinIndex", new T.Uint16BufferAttribute(index, 4));
  g.setAttribute("skinWeight", new T.Float32BufferAttribute(weight, 4));
  return g;
}
export function morph(g, names, fn) {
  const base = g.getAttribute("position"),
    targets = names.map((name) => {
      const arr = new Float32Array(base.array.length);
      for (let i = 0; i < base.count; i++) {
        const p = V().fromBufferAttribute(base, i),
          q = fn(p.clone(), name);
        arr.set([q.x, q.y, q.z], i * 3);
      }
      const a = new T.Float32BufferAttribute(arr, 3);
      a.name = name;
      return a;
    });
  g.morphAttributes.position = targets;
  g.morphTargetsRelative = false;
  return g;
}
export function addMesh(parent, g, m, name = "") {
  const o = new T.Mesh(g, m);
  o.name = name;
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
export function partitionGeometry(g, covered) {
  const p = g.attributes.position,
    index = g.index,
    visible = [],
    hidden = [];
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)],
      point = V();
    for (const id of ids) point.add(V().fromBufferAttribute(p, id));
    point.multiplyScalar(1 / 3);
    (covered(point) ? hidden : visible).push(...ids);
  }
  const make = (ids) => {
    if (!ids.length) return null;
    const clone = g.clone();
    clone.setIndex(ids);
    return clone;
  };
  const result = [make(visible), make(hidden)];
  g.dispose();
  return result;
}
