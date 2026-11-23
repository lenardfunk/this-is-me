/**
 * Pure geometry for the journey slide (no DOM): path building, distances along the path and
 * the camera that frames a point of the photo on the 1600×900 canvas.
 * All photo coordinates are percentages [x, y] of the photo unless noted otherwise.
 */

export type Pt = [number, number];
export type Size = [number, number];

export const CANVAS_W = 1600;
export const CANVAS_H = 900;
const SAMPLES_PER_SEGMENT = 32;

export interface PathStation {
  at: Pt;
  /** Waypoints before this station so the path follows the terrain. */
  via?: Pt[];
}

export interface PathModel {
  /** SVG path data in photo pixels. */
  d: string;
  /** Total polyline length (use as SVG `pathLength` so dash lengths match). */
  total: number;
  /** Distance along the path at which station k is reached. */
  stationLength: number[];
  /** Densely sampled points with their cumulative distance (for walker positions). */
  samples: { p: Pt; len: number }[];
}

/** Converts [x%, y%] to photo pixels. */
export const toPx = ([x, y]: Pt, [w, h]: Size): Pt => [(x * w) / 100, (y * h) / 100];

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Cubic Bézier control points of the Catmull-Rom segment between pts[i] and pts[i + 1]. */
export function catmullRomSegment(pts: Pt[], i: number): { c1: Pt; c2: Pt; end: Pt } {
  const p0 = pts[i - 1] ?? pts[i];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[i + 2] ?? p2;
  return {
    c1: [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
    c2: [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
    end: p2,
  };
}

const bezier = (p0: Pt, c1: Pt, c2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0],
    a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1],
  ];
};

export function buildPath(stations: PathStation[], imageSize: Size): PathModel {
  const pts: Pt[] = [];
  const stationPoint: number[] = [];
  stations.forEach((s, i) => {
    // The path starts at the first station, so leading waypoints are ignored.
    if (i > 0) (s.via ?? []).forEach((p) => pts.push(toPx(p, imageSize)));
    stationPoint.push(pts.length);
    pts.push(toPx(s.at, imageSize));
  });

  const f = (n: number) => Math.round(n * 100) / 100;
  let d = `M ${f(pts[0][0])},${f(pts[0][1])}`;
  const samples: PathModel['samples'] = [{ p: pts[0], len: 0 }];
  const cumulative = [0];
  for (let i = 0; i < pts.length - 1; i++) {
    const { c1, c2, end } = catmullRomSegment(pts, i);
    d += ` C ${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(end[0])},${f(end[1])}`;
    let last = pts[i];
    let len = cumulative[i];
    for (let k = 1; k <= SAMPLES_PER_SEGMENT; k++) {
      const p = bezier(pts[i], c1, c2, end, k / SAMPLES_PER_SEGMENT);
      len += dist(last, p);
      samples.push({ p, len });
      last = p;
    }
    cumulative.push(len);
  }
  return {
    d,
    total: cumulative[cumulative.length - 1],
    stationLength: stationPoint.map((i) => cumulative[i]),
    samples,
  };
}

/** Point (in photo pixels) at a distance along the path; clamped to the path ends. */
export function pointAtLength(model: PathModel, length: number): Pt {
  const { samples } = model;
  if (length <= 0) return samples[0].p;
  const last = samples[samples.length - 1];
  if (length >= last.len) return last.p;
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].len <= length) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const t = b.len === a.len ? 0 : (length - a.len) / (b.len - a.len);
  return [a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t];
}

/** Height of the photo when it fills the canvas width. */
export const worldHeight = ([w, h]: Size, canvasW = CANVAS_W) => (canvasW * h) / w;

/**
 * Photo percentage -> percentage of the stage. The photo fills the width and is anchored at the
 * bottom of the canvas (the sky at the top gets cropped).
 */
export function toStagePercent([x, y]: Pt, imageSize: Size, canvasH = CANVAS_H): Pt {
  const wh = worldHeight(imageSize);
  return [x, ((canvasH - wh + (y / 100) * wh) / canvasH) * 100];
}

export interface Camera {
  s: number;
  tx: number;
  ty: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Camera (zoom + translation in % of the stage) that centres `at` without showing outside the photo. */
export function cameraFor(at: Pt, zoom: number, imageSize: Size): Camera {
  const [x, y] = toStagePercent(at, imageSize);
  return {
    s: zoom,
    tx: clamp(50 - x * zoom, 100 - 100 * zoom, 0),
    ty: clamp(45 - y * zoom, 100 - 100 * zoom, 0),
  };
}

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
