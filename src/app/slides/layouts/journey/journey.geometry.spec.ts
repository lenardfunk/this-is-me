import {
  buildPath,
  cameraFor,
  catmullRomSegment,
  easeInOutCubic,
  pointAtLength,
  toPx,
  toStagePercent,
  worldHeight,
  type Pt,
  type Size,
} from './journey.geometry';

const SIZE: Size = [851, 577];
// station coordinates of the default deck (taken from the prototype)
const stations = [
  { at: [90, 94] as Pt },
  { at: [44, 83] as Pt, via: [[72, 89], [58, 86]] as Pt[] },
  { at: [80, 57] as Pt, via: [[54, 75], [68, 66]] as Pt[] },
  { at: [30, 46] as Pt, via: [[62, 56], [42, 52]] as Pt[] },
  { at: [39.5, 33] as Pt, via: [[34, 39]] as Pt[] },
];

describe('buildPath', () => {
  const model = buildPath(stations, SIZE);

  it('starts at the first station and ends at the last', () => {
    expect(pointAtLength(model, 0)).toEqual(toPx([90, 94], SIZE));
    const end = pointAtLength(model, model.total);
    expect(end[0]).toBeCloseTo(toPx([39.5, 33], SIZE)[0], 5);
    expect(end[1]).toBeCloseTo(toPx([39.5, 33], SIZE)[1], 5);
  });

  it('reaches every station at an increasing distance', () => {
    expect(model.stationLength).toHaveLength(5);
    expect(model.stationLength[0]).toBe(0);
    for (let i = 1; i < 5; i++) expect(model.stationLength[i]).toBeGreaterThan(model.stationLength[i - 1]);
    expect(model.stationLength[4]).toBeCloseTo(model.total, 5);
  });

  it('passes through each station position', () => {
    stations.forEach((s, i) => {
      const [px, py] = pointAtLength(model, model.stationLength[i]);
      const [ex, ey] = toPx(s.at, SIZE);
      expect(px).toBeCloseTo(ex, 3);
      expect(py).toBeCloseTo(ey, 3);
    });
  });

  it('produces one cubic segment per consecutive pair of control points', () => {
    // 5 stations + 7 waypoints = 12 control points -> 11 segments
    expect(model.d.match(/ C /g)).toHaveLength(11);
    expect(model.d.startsWith('M ')).toBe(true);
  });

  it('ignores waypoints of the first station', () => {
    const withVia = buildPath([{ at: [10, 10], via: [[50, 50]] }, { at: [90, 90] }], SIZE);
    const without = buildPath([{ at: [10, 10] }, { at: [90, 90] }], SIZE);
    expect(withVia.d).toBe(without.d);
  });

  it('clamps lengths outside the path', () => {
    expect(pointAtLength(model, -5)).toEqual(pointAtLength(model, 0));
    expect(pointAtLength(model, model.total + 100)).toEqual(pointAtLength(model, model.total));
  });

  it('a straight two-point path has the euclidean length', () => {
    const line = buildPath([{ at: [0, 0] }, { at: [100, 0] }], [200, 100]);
    expect(line.total).toBeCloseTo(200, 3);
    expect(pointAtLength(line, 100)[0]).toBeCloseTo(100, 3);
  });
});

describe('catmullRomSegment', () => {
  it('uses the end point as its own neighbour at the path ends', () => {
    const pts: Pt[] = [[0, 0], [6, 0]];
    const seg = catmullRomSegment(pts, 0);
    expect(seg.end).toEqual([6, 0]);
    expect(seg.c1).toEqual([1, 0]);
    expect(seg.c2).toEqual([5, 0]);
  });
});

describe('camera', () => {
  it('anchors the photo at the bottom of the canvas', () => {
    const wh = worldHeight(SIZE);
    expect(wh).toBeCloseTo(1084.8, 0);
    const [, bottom] = toStagePercent([50, 100], SIZE);
    expect(bottom).toBeCloseTo(100, 5);
    const [, top] = toStagePercent([50, 0], SIZE);
    expect(top).toBeLessThan(0);
  });

  it('zoom 1 shows the whole stage', () => {
    expect(cameraFor([50, 50], 1, SIZE)).toEqual({ s: 1, tx: 0, ty: 0 });
  });

  it('never shows area outside the photo when zoomed', () => {
    for (const at of [[0, 0], [100, 100], [90, 94], [9, 74], [39.5, 33]] as Pt[]) {
      const { s, tx, ty } = cameraFor(at, 1.9, SIZE);
      expect(tx).toBeGreaterThanOrEqual(100 - 100 * s);
      expect(tx).toBeLessThanOrEqual(0);
      expect(ty).toBeGreaterThanOrEqual(100 - 100 * s);
      expect(ty).toBeLessThanOrEqual(0);
    }
  });

  it('centres a point that is far from the edges', () => {
    const at: Pt = [50, 60];
    const { s, tx, ty } = cameraFor(at, 1.9, SIZE);
    const [x, y] = toStagePercent(at, SIZE);
    expect(x * s + tx).toBeCloseTo(50, 5);
    expect(y * s + ty).toBeCloseTo(45, 5);
  });
});

describe('easeInOutCubic', () => {
  it('maps 0 -> 0, 0.5 -> 0.5 and 1 -> 1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
    expect(easeInOutCubic(1)).toBe(1);
  });
});
