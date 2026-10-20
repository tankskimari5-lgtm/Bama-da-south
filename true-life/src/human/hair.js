import { V, patch, strand, merge } from "./mesh.js";
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function createHairGeometry(a, detail = "high") {
  const gs = [],
    random = rng(9382),
    quality = detail === "high" ? 1 : detail === "medium" ? 0.55 : 0.26;
  if (a.hair !== "none") {
    const style = a.hair,
      count = Math.round(
        (style === "buzz"
          ? 500
          : style === "afro"
            ? 420
            : style === "short"
              ? 500
              : style === "waves"
                ? 320
                : style === "braids"
                  ? 20
                  : style === "twists"
                    ? 65
                    : style === "locs"
                      ? 55
                      : 220) * quality,
      );
    for (let i = 0; i < count; i++) {
      const phi = i * 2.39996 + random() * 0.3,
        r = Math.sqrt((i + 0.5) / count),
        angle = phi;
      const x = Math.sin(angle) * 0.079 * r,
        z = 0.013 - Math.cos(angle) * 0.087 * r,
        y = 1.744 + Math.sqrt(Math.max(0, 1 - r * r)) * 0.075;
      const start = V(x, y, z),
        points = [start],
        length =
          style === "buzz"
            ? 0.005
            : style === "waves"
              ? 0.013
              : style === "afro"
                ? 0.048
                : style === "long"
                  ? 0.26
                  : style === "locs"
                    ? 0.21
                    : style === "twists"
                      ? 0.075
                      : style === "braids"
                        ? 0.24
                        : 0.012;
      const outward = V(x * 0.8, 0.045, z - 0.013).normalize();
      const n =
        style === "long" || style === "locs" || style === "braids" ? 10 : 7;
      for (let j = 1; j <= n; j++) {
        const t = j / n,
          p = start.clone();
        if (["long", "locs", "braids"].includes(style)) {
          p.addScaledVector(outward, Math.sin((t * Math.PI) / 2) * 0.024);
          p.y -= length * t * t;
          p.x += Math.sin(t * 3.5 + phi) * 0.006;
          p.z += 0.01 * t;
          if (start.z < 0) {
            p.z += 0.085 * t;
            p.x += (start.x < 0 ? -1 : 1) * 0.024 * t;
          }
          if (style === "braids") {
            p.x += Math.sin(t * 50 + phi) * 0.002;
            p.z += Math.cos(t * 50 + phi) * 0.002;
          }
        } else {
          p.addScaledVector(outward, length * t);
          const curl =
            style === "buzz" ? 0.0004 : style === "waves" ? 0.0017 : 0.0015;
          p.x += Math.sin(t * 9 + phi) * curl;
          p.z += Math.cos(t * 9 + phi) * curl;
          p.y += style === "waves" ? Math.sin(phi * 6 + t * 3) * 0.003 : 0;
        }
        points.push(p);
      }
      const radius =
        style === "braids"
          ? 0.005
          : style === "locs"
            ? 0.004
            : style === "twists"
              ? 0.003
              : style === "afro"
                ? 0.0017
                : style === "buzz"
                  ? 0.00055
                  : 0.00065;
      if (style === "braids" || style === "twists") {
        const strands = style === "braids" ? 3 : 2;
        for (let braid = 0; braid < strands; braid++) {
          const pts = points.map((p, i) =>
            p
              .clone()
              .add(
                V(
                  Math.sin(i * 2.5 + (braid * Math.PI * 2) / strands) * 0.0019,
                  0,
                  Math.cos(i * 2.5 + (braid * Math.PI * 2) / strands) * 0.0019,
                ),
              ),
          );
          gs.push(strand(pts, radius * 0.45, detail === "high" ? 5 : 3));
        }
      } else gs.push(strand(points, radius, detail === "high" ? 5 : 3));
    }
    // Dense scalp-following ribbons fill gaps between strands without a solid helmet silhouette.
    if (!["braids", "locs", "twists"].includes(style))
      for (let i = 0; i < Math.round(55 * quality); i++) {
        const angle = (i / Math.round(55 * quality)) * Math.PI * 2;
        gs.push(
          patch(
            (u, v) => {
              const t = v * 0.98,
                a = angle + (u - 0.5) * 0.14,
                x = Math.sin(a) * 0.079 * t,
                z = 0.014 - Math.cos(a) * 0.087 * t,
                y = 1.746 + Math.sqrt(Math.max(0, 1 - t * t)) * 0.075;
              return V(x, y, z);
            },
            3,
            12,
            { flip: true },
          ),
        );
      }
  }
  if (a.facialHair !== "none") {
    const beard = a.facialHair !== "mustache",
      count = Math.round((a.facialHair === "beard" ? 650 : 250) * quality);
    for (let i = 0; i < count; i++) {
      const x = (random() - 0.5) * 0.12,
        y = beard ? 1.57 + random() * 0.066 : 1.634 + random() * 0.008;
      if (Math.abs(x) < 0.026 && y < 1.63 && y > 1.614) continue;
      const z = -0.058 - Math.sqrt(Math.max(0, 1 - (x / 0.079) ** 2)) * 0.019;
      const len =
        a.facialHair === "stubble"
          ? 0.0015
          : a.facialHair === "mustache"
            ? 0.006
            : 0.009;
      gs.push(
        strand(
          [
            [x, y, z],
            [x, y - len * 0.6, z - 0.001],
            [x + len * 0.15, y - len, z - 0.002],
          ],
          a.facialHair === "stubble" ? 0.00045 : 0.00065,
          3,
        ),
      );
    }
  }
  return gs.length ? merge(gs) : null;
}
