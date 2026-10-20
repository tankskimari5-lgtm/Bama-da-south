import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
export const mat = (color, extra = {}) =>
  new T.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
export function box(parent, w, h, d, x, y, z, m, rotation = 0) {
  const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.rotation.y = rotation;
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
export function ellipsoid(parent, x, y, z, rx, ry, rz, m, detail = 12) {
  const o = new T.Mesh(
    new T.SphereGeometry(1, detail, Math.max(8, detail / 2)),
    m,
  );
  o.position.set(x, y, z);
  o.scale.set(rx, ry, rz);
  o.castShadow = true;
  parent.add(o);
  return o;
}
export function beam(parent, a, b, r, m, segments = 8) {
  const dir = b.clone().sub(a);
  const o = new T.Mesh(new T.CylinderGeometry(r, r, dir.length(), segments), m);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  o.castShadow = true;
  parent.add(o);
  return o;
}
// Elliptical ring surfaces provide smooth, shaped anatomy and body panels.
export function rings(rows, segments = 16) {
  const p = [],
    uv = [],
    idx = [];
  for (let j = 0; j < rows.length; j++) {
    const [y, rx, rz, cx = 0, cz = 0] = rows[j];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      p.push(cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz);
      uv.push(i / segments, j / (rows.length - 1));
    }
  }
  for (let j = 0; j < rows.length - 1; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i,
        b = a + segments + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export function surface(parent, rows, m, segments = 16) {
  const o = new T.Mesh(rings(rows, segments), m);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
export function proceduralTexture(type, color) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = color;
  x.fillRect(0, 0, 256, 256);
  let seed = 421;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 9000; i++) {
    const v = random();
    x.fillStyle = v > 0.5 ? "#ffffff0d" : "#00000012";
    x.fillRect(
      random() * 256,
      random() * 256,
      type === "fabric" ? 1 : 2,
      type === "wood" ? 40 : 2,
    );
  }
  if (type === "brick") {
    x.strokeStyle = "#d5c2a455";
    x.lineWidth = 2;
    for (let y = 0; y < 256; y += 24) {
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(256, y);
      x.stroke();
      for (let xx = y % 48 ? 0 : 32; xx < 256; xx += 64) {
        x.beginPath();
        x.moveTo(xx, y);
        x.lineTo(xx, y + 24);
        x.stroke();
      }
    }
  }
  if (type === "concrete") {
    x.strokeStyle = "#8e8f7b55";
    x.strokeRect(0, 0, 256, 256);
  }
  if (type === "wood") {
    x.strokeStyle = "#00000025";
    for (let k = 0; k < 256; k += 32) {
      x.beginPath();
      x.moveTo(k, 0);
      x.lineTo(k, 256);
      x.stroke();
    }
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}
export function sign(
  parent,
  text,
  x,
  y,
  z,
  width = 4,
  color = "#f5ead3",
  bg = "#25473d",
  rotation = 0,
) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 48px sans-serif";
  ctx.fillText(text, 256, 67, 490);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  const o = new T.Mesh(
    new T.PlaneGeometry(width, width / 4),
    new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }),
  );
  o.position.set(x, y, z);
  o.rotation.y = rotation;
  parent.add(o);
  return o;
}
// Merge static scene geometry by material; individual animated objects stay separate.
export function batchStatic(root) {
  root.updateMatrixWorld(true);
  const byMaterial = new Map();
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && o.material?.isMeshStandardMaterial && !o.userData.dynamic) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      const key = o.material.uuid;
      if (!byMaterial.has(key)) byMaterial.set(key, { m: o.material, gs: [] });
      byMaterial.get(key).gs.push(g);
      meshes.push(o);
    }
  });
  for (const o of meshes) o.removeFromParent();
  for (const { m, gs } of byMaterial.values()) {
    const g = mergeGeometries(gs, false);
    if (g) {
      const mesh = new T.Mesh(g, m);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
    for (const g of gs) g.dispose();
  }
}
export function worldMapped(material, scale = 1) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying vec3 vSurfaceWorld; varying vec3 vSurfaceNormal;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\nvSurfaceWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vSurfaceNormal=normalize(mat3(modelMatrix)*objectNormal);",
    );
    shader.fragmentShader =
      "varying vec3 vSurfaceWorld; varying vec3 vSurfaceNormal;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP\n vec3 n=abs(normalize(vSurfaceNormal)); vec2 uvw=n.y>n.x&&n.y>n.z?vSurfaceWorld.xz:(n.x>n.z?vSurfaceWorld.zy:vSurfaceWorld.xy); vec4 sampledDiffuseColor=texture2D(map,uvw*${Number(scale).toFixed(4)}); diffuseColor*=sampledDiffuseColor;\n#endif`,
    );
  };
  material.customProgramCacheKey = () => `world-mapped-${scale}`;
  return material;
}
export function batchLocalMeshes(root) {
  root.updateMatrix();
  const buckets = new Map();
  for (const child of [...root.children]) {
    if (
      !child.isMesh ||
      child.isSkinnedMesh ||
      Array.isArray(child.material) ||
      child.material.transparent
    )
      continue;
    child.updateMatrix();
    const g = child.geometry.index
      ? child.geometry.toNonIndexed()
      : child.geometry.clone();
    if (!g.getAttribute("uv"))
      g.setAttribute(
        "uv",
        new T.Float32BufferAttribute(
          new Float32Array(g.getAttribute("position").count * 2),
          2,
        ),
      );
    g.applyMatrix4(child.matrix);
    let bucket = buckets.get(child.material);
    if (!bucket)
      buckets.set(child.material, (bucket = { gs: [], objects: [] }));
    bucket.gs.push(g);
    bucket.objects.push(child);
  }
  for (const [material, { gs, objects }] of buckets) {
    const merged = mergeGeometries(gs, false);
    if (merged) {
      const mesh = new T.Mesh(merged, material);
      mesh.castShadow = objects.some((o) => o.castShadow);
      mesh.receiveShadow = objects.some((o) => o.receiveShadow);
      objects.forEach((o) => {
        o.removeFromParent();
        o.geometry.dispose();
      });
      root.add(mesh);
    }
    gs.forEach((g) => g.dispose());
  }
}
